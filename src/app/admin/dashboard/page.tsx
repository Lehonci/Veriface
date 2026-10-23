'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { VerificationRecord, ZoomSetting } from '@/types';
import {
  LayoutDashboard,
  ScanFace,
  History,
  Settings,
  Search,
  Bell,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Maximize2,
  Clock,
  UserCheck,
  UserX,
  ExternalLink,
  RefreshCw,
  LogOut,
  Lock,
  Download,
  Filter,
  Check,
  Sparkles,
  Link as LinkIcon,
  Video,
  Save,
  CheckCheck,
  MoreHorizontal,
  ChevronLeft,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'riwayat' | 'pengaturan' | 'profil'>('dashboard');
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<VerificationRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [admittedList, setAdmittedList] = useState<Record<string, 'ADMITTED' | 'REMOVED'>>({});
  const [modalSnapshot, setModalSnapshot] = useState<string | null>(null);

  // Notification state
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [notificationsRead, setNotificationsRead] = useState<boolean>(false);

  // Settings State matching Figma Version 44
  const [sessionName, setSessionName] = useState('Interview Batch Juni 2026');
  const [meetingUrl, setMeetingUrl] = useState('https://meet.example.com/interview-juni');
  const [autoRedirect, setAutoRedirect] = useState(true);
  const [blockVirtualCamera, setBlockVirtualCamera] = useState(true);
  const [autoAudit, setAutoAudit] = useState(true);
  const [saveFailSnapshot, setSaveFailSnapshot] = useState(true);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  // History Filter State
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'REVIEW'>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Chart Time Range Filter: 'today' | '7days' | '30days'
  const [chartTimeRange, setChartTimeRange] = useState<'today' | '7days' | '30days'>('7days');

  // Authentication Guard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('admin_auth');
      if (auth !== 'true') {
        router.push('/admin/login');
      } else {
        setIsAuthenticated(true);
      }
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_email');
    }
    router.push('/admin/login');
  };

  // Fetch initial verifications & settings
  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/admin/verifications?status=ALL';
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.verifications) {
        setVerifications(data.verifications);
        if (!selectedRecord && data.verifications.length > 0) {
          setSelectedRecord(data.verifications[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching verifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedRecord]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings && data.settings.length > 0) {
        const active = data.settings.find((s: ZoomSetting) => s.is_active) || data.settings[0];
        setSessionName(active.meeting_title);
        setMeetingUrl(active.zoom_url);
      }
    } catch (err) {
      console.warn('Could not load settings:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchVerifications();
      fetchSettings();
    }
  }, [isAuthenticated, fetchVerifications]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('verifications-realtime-admin-v44')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'verifications' },
        (payload) => {
          const newRecord = payload.new as VerificationRecord;
          setVerifications((prev) => [newRecord, ...prev]);
          setSelectedRecord(newRecord);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle: sessionName,
          zoomUrl: meetingUrl,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSettingsSuccess(true);
        setTimeout(() => setSaveSettingsSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Save settings failed:', e);
    }
  };

  // Dynamic KPI calculated purely from live database records
  const totalVerifs = verifications.length;
  const passedCount = verifications.filter((v) => v.status === 'PASSED').length;
  const spoofCount = verifications.filter((v) => v.status === 'SPOOF_FAILED').length;
  const needReviewCount = verifications.filter((v) => v.status === 'VIRTUAL_CAM_BLOCKED' || v.status === 'POOR_LIGHTING').length;
  const passRate = totalVerifs > 0 ? ((passedCount / totalVerifs) * 100).toFixed(1) : '0';
  const needReviewRate = totalVerifs > 0 ? ((needReviewCount / totalVerifs) * 100).toFixed(1) : '0';
  const spoofRate = totalVerifs > 0 ? ((spoofCount / totalVerifs) * 100).toFixed(1) : '0';

  // Calculate chart dynamically from verifications created_at based on chartTimeRange
  const daysOfWeek = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const now = new Date();

  let activityData: { day: string; count: number }[] = [];

  if (chartTimeRange === 'today') {
    // 24 hours divided into 4-hour slots: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
    const todayStr = now.toISOString().split('T')[0];
    const todayVerifs = verifications.filter((v) => v.created_at && v.created_at.startsWith(todayStr));
    const slots = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Sekarang'];
    activityData = slots.map((slot, idx) => {
      let count = 0;
      if (idx === 6) {
        count = todayVerifs.length;
      } else {
        const hour = parseInt(slot.split(':')[0], 10);
        count = todayVerifs.filter((v) => {
          const vHour = new Date(v.created_at).getHours();
          return vHour >= hour && vHour < hour + 4;
        }).length;
      }
      return { day: slot, count };
    });
  } else if (chartTimeRange === '30days') {
    // 30 days grouped every 5 days
    activityData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (5 - i) * 5);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      // Count verifications around this period
      const count = verifications.filter((v) => {
        if (!v.created_at) return false;
        const vDate = new Date(v.created_at);
        const diffDays = Math.abs(Math.floor((vDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
        return diffDays <= 2;
      }).length;
      return { day: label, count };
    });
  } else {
    // Default 7 days
    activityData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayLabel = daysOfWeek[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      const count = verifications.filter((v) => v.created_at && v.created_at.startsWith(dateStr)).length;
      return { day: dayLabel, count };
    });
  }

  const handleDecision = (id: string, decision: 'ADMITTED' | 'REMOVED') => {
    setAdmittedList((prev) => ({ ...prev, [id]: decision }));
  };

  const notificationsList = [
    { id: 1, name: 'Nadia Rahmawati', desc: 'Depth variance rendah', time: '10:42:18 - REG-24031', type: 'warning' },
    { id: 2, name: 'Rizky Aditya', desc: 'Virtual camera terdeteksi', time: '10:38:51 - REG-24079', type: 'blocked' },
    { id: 3, name: 'Aulia Putri Maharani', desc: 'Luminance di bawah batas', time: '10:31:06 - REG-24074', type: 'warning' },
  ];

  // Filtered History list
  const filteredHistory = verifications.filter((item) => {
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      const matchName = item.full_name.toLowerCase().includes(q);
      const matchEmail = item.email.toLowerCase().includes(q);
      const matchPos = item.job_position.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPos) return false;
    }
    if (historyStatusFilter === 'PASSED') return item.status === 'PASSED';
    if (historyStatusFilter === 'FAILED') return item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';
    if (historyStatusFilter === 'REVIEW') return item.status === 'POOR_LIGHTING';
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F2F2]">
        <div className="flex flex-col items-center gap-3 p-8 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <Lock className="w-8 h-8 text-[#A02848] animate-pulse" />
          <p className="text-xs text-gray-500">Memeriksa autentikasi administrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F3F4] text-[#2D151E] flex flex-col font-sans relative">
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6">
        
        {/* Left Sidebar matching Figma Version 44 */}
        <aside className="w-64 bg-white rounded-[28px] p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#F0E4E7] shrink-0">
          <div>
            {/* Logo Brand Header */}
            <div className="flex items-center gap-3 pb-6 border-b border-[#F7ECEF]">
              <div className="w-11 h-11 rounded-2xl bg-[#9E2648] text-white flex items-center justify-center shadow-md shadow-[#9E2648]/25">
                <ScanFace className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#2B0E17]">VeriGate</h2>
                <p className="text-[10px] tracking-widest uppercase font-semibold text-[#8C3A50]">Identity System</p>
              </div>
            </div>

            {/* Nav Menu */}
            <nav className="mt-6 space-y-1.5">
              {/* Menu 1: Dashboard */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-[#FBECEF] text-[#9E2648]'
                    : 'text-[#6B4B55] hover:bg-[#FAF4F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </div>
              </button>

              {/* Menu 2: Audit visual */}
              <button
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-[#FBECEF] text-[#9E2648]'
                    : 'text-[#6B4B55] hover:bg-[#FAF4F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ScanFace className="w-4 h-4" />
                  <span>Audit visual</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F4DCE1] text-[#9E2648]">
                  {needReviewCount + spoofCount}
                </span>
              </button>

              {/* Menu 3: Riwayat */}
              <button
                onClick={() => setActiveTab('riwayat')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'riwayat'
                    ? 'bg-[#FBECEF] text-[#9E2648]'
                    : 'text-[#6B4B55] hover:bg-[#FAF4F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4" />
                  <span>Riwayat</span>
                </div>
              </button>

              {/* Menu 4: Pengaturan */}
              <button
                onClick={() => setActiveTab('pengaturan')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'pengaturan'
                    ? 'bg-[#FBECEF] text-[#9E2648]'
                    : 'text-[#6B4B55] hover:bg-[#FAF4F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4" />
                  <span>Pengaturan</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Bottom Sidebar User Pill */}
          <div className="space-y-3 pt-6 border-t border-[#F7ECEF]">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#8C3A50] hover:text-[#9E2648] hover:bg-[#FAF4F6] transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Portal verifikasi</span>
            </Link>

            {/* Admin Room Profile Pill (Clickable to Tab Profil) */}
            <div
              onClick={() => setActiveTab('profil')}
              className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'profil'
                  ? 'bg-[#FBECEF] border-[#9E2648]/40'
                  : 'bg-[#FAF4F6] border-[#F2E4E8] hover:bg-[#F7ECEF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8A233E] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  AR
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#2B0E17]">Admin Room</h4>
                  <p className="text-[10px] text-[#8C3A50]">Host &middot; Utama</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col gap-6 overflow-x-hidden">
          
          {/* Top Actions Bar (Search bar removed per request) */}
          <div className="flex items-center justify-end gap-4 relative z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={fetchVerifications}
                className="p-2.5 rounded-full bg-white border border-[#EEDDE2] text-[#6B4B55] hover:text-[#9E2648] hover:bg-[#FAF4F6] shadow-sm transition-all"
                title="Perbarui data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Notification Popover Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowNotificationModal(!showNotificationModal)}
                  className="p-2.5 rounded-full bg-white border border-[#EEDDE2] text-[#6B4B55] hover:text-[#9E2648] hover:bg-[#FAF4F6] shadow-sm transition-all relative"
                >
                  <Bell className="w-4 h-4" />
                  {!notificationsRead && (
                    <span className="w-2 h-2 rounded-full bg-[#9E2648] absolute top-2 right-2 animate-pulse"></span>
                  )}
                </button>

                {/* Notification Dropdown Panel matching Figma Version 44 */}
                {showNotificationModal && (
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-3xl p-5 shadow-2xl border border-[#F0E4E7] z-50 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                      <div>
                        <h4 className="text-sm font-bold text-[#2B0E17]">Notifikasi</h4>
                        <p className="text-[11px] text-[#7D5662]">3 pembaruan terbaru</p>
                      </div>
                      <button
                        onClick={() => setNotificationsRead(true)}
                        className="text-[11px] font-semibold text-[#9E2648] hover:underline"
                      >
                        Tandai dibaca
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {notificationsList.map((n) => (
                        <div key={n.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#FAF4F6] transition-colors relative">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            n.type === 'blocked' ? 'bg-[#FEE4E2] text-[#F04438]' : 'bg-[#FFF8E6] text-[#F79009]'
                          }`}>
                            {n.type === 'blocked' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-[#2B0E17] truncate">{n.name}</h5>
                            <p className="text-[11px] text-[#7D5662] truncate">{n.desc}</p>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">{n.time}</span>
                          </div>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9E2648] shrink-0 mt-1"></span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setShowNotificationModal(false);
                        setActiveTab('audit');
                      }}
                      className="w-full mt-4 py-2.5 rounded-2xl bg-[#FBECEF] hover:bg-[#F7DCE2] text-[#9E2648] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Buka Audit visual</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Avatar Button */}
              <button
                onClick={() => setActiveTab('profil')}
                className="w-10 h-10 rounded-full bg-[#8A233E] text-white flex items-center justify-center font-bold text-xs shadow-sm hover:scale-105 transition-transform"
              >
                AR
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: DASHBOARD (Active View) */}
          {/* ========================================================================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Greeting Hero Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                  Selamat datang, Admin
                </h1>
                <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                  Pantau aktivitas verifikasi identitas hari ini.
                </p>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FDF0F3] text-[#A02848] flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Total verifikasi</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{totalVerifs.toLocaleString('id-ID')}</h3>
                    <p className="text-[11px] font-medium text-[#9E2648] mt-0.5">+12,4% dari kemarin</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EDF9F4] text-[#12B76A] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Berhasil</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{passedCount.toLocaleString('id-ID')}</h3>
                    <p className="text-[11px] font-medium text-[#12B76A] mt-0.5">{passRate}% success rate</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF8E6] text-[#F79009] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Perlu ditinjau</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{needReviewCount}</h3>
                    <p className="text-[11px] font-medium text-[#F79009] mt-0.5">{needReviewCount} kasus</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FEE4E2] text-[#F04438] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Diblokir</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{spoofCount}</h3>
                    <p className="text-[11px] font-medium text-[#F04438] mt-0.5">{spoofRate}% dari total</p>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-[#2B0E17]">Aktivitas verifikasi</h3>
                      <p className="text-xs text-[#7D5662]">
                        {chartTimeRange === 'today'
                          ? 'Ringkasan proses sepanjang hari ini'
                          : chartTimeRange === '30days'
                          ? 'Ringkasan proses selama 30 hari terakhir'
                          : 'Ringkasan proses selama 7 hari terakhir'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#FAF4F6] p-1 rounded-full text-xs font-semibold">
                      <button
                        onClick={() => setChartTimeRange('today')}
                        className={`px-3 py-1 rounded-full transition-all ${
                          chartTimeRange === 'today'
                            ? 'bg-[#8A233E] text-white shadow-sm'
                            : 'text-[#7D5662] hover:text-[#2B0E17]'
                        }`}
                      >
                        Hari ini
                      </button>
                      <button
                        onClick={() => setChartTimeRange('7days')}
                        className={`px-3 py-1 rounded-full transition-all ${
                          chartTimeRange === '7days'
                            ? 'bg-[#8A233E] text-white shadow-sm'
                            : 'text-[#7D5662] hover:text-[#2B0E17]'
                        }`}
                      >
                        7 hari
                      </button>
                      <button
                        onClick={() => setChartTimeRange('30days')}
                        className={`px-3 py-1 rounded-full transition-all ${
                          chartTimeRange === '30days'
                            ? 'bg-[#8A233E] text-white shadow-sm'
                            : 'text-[#7D5662] hover:text-[#2B0E17]'
                        }`}
                      >
                        30 hari
                      </button>
                    </div>
                  </div>

                  <div className="h-60 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="maroonWave" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#A02848" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#A02848" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" stroke="#B08D96" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#B08D96" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#F0E4E7',
                            borderRadius: '16px',
                            fontSize: '12px',
                            color: '#2B0E17',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#9E2648"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#maroonWave)"
                          dot={{ r: 4, fill: '#FFFFFF', stroke: '#9E2648', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#9E2648' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Distribusi hasil</h3>
                    <p className="text-xs text-[#7D5662]">Semua verifikasi database</p>
                  </div>

                  <div className="relative w-44 h-44 mx-auto my-4 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" stroke="#F4EBEE" strokeWidth="11" fill="transparent" />
                      {totalVerifs > 0 && (
                        <>
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#12B76A"
                            strokeWidth="11"
                            strokeDasharray="238.7"
                            strokeDashoffset={238.7 - (238.7 * passedCount) / (totalVerifs || 1)}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#F04438"
                            strokeWidth="11"
                            strokeDasharray="238.7"
                            strokeDashoffset={238.7 - (238.7 * spoofCount) / (totalVerifs || 1)}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </>
                      )}
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-[#2B0E17]">{totalVerifs}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-semibold pt-2 border-t border-[#F7ECEF]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A]" />
                        <span className="text-[#6B4B55]">Berhasil</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{passRate}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F79009]" />
                        <span className="text-[#6B4B55]">Ditinjau</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{needReviewRate}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F04438]" />
                        <span className="text-[#6B4B55]">Diblokir</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{spoofRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Antrean Audit Terbaru */}
              <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Antrean audit terbaru</h3>
                    <p className="text-xs text-[#7D5662]">Insiden yang membutuhkan validasi manual</p>
                  </div>

                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-xs font-bold text-[#9E2648] hover:text-[#7A1934] flex items-center gap-1.5 transition-colors"
                  >
                    <span>Lihat semua</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {verifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Tidak ada catatan verifikasi.
                    </div>
                  ) : (
                    verifications.slice(0, 5).map((item) => {
                      const decision = admittedList[item.id];
                      const isSuccess = item.status === 'PASSED';
                      const isBlocked = item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedRecord(item)}
                          className="p-4 rounded-2xl border border-[#F2E4E8] bg-white hover:bg-[#FDF9FA] transition-all cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {item.snapshot_url ? (
                              <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                                <Image src={item.snapshot_url} alt={item.full_name} fill unoptimized className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-[#FAF0F2] text-[#9E2648] font-bold text-xs flex items-center justify-center shrink-0 border border-[#F2D7DE]">
                                {item.full_name.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-[#2B0E17] truncate">{item.full_name}</h4>
                                {decision && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    decision === 'ADMITTED' ? 'bg-[#EDF9F4] text-[#12B76A]' : 'bg-[#FEE4E2] text-[#F04438]'
                                  }`}>
                                    {decision}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#7D5662] truncate">
                                {item.job_position} &middot; <span className="text-gray-400 font-mono text-[11px]">{item.email}</span>
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-3">
                            <span className="text-[11px] font-mono text-gray-400 hidden sm:inline-block">
                              {new Date(item.created_at).toLocaleTimeString('id-ID')}
                            </span>

                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Berhasil</span>
                              </span>
                            ) : isBlocked ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verifikasi gagal</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8E6] text-[#F79009] text-xs font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Ditinjau</span>
                              </span>
                            )}

                            <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecision(item.id, 'ADMITTED');
                                }}
                                title="Admit / Izinkan"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecision(item.id, 'REMOVED');
                                }}
                                title="Keluarkan"
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: AUDIT VISUAL (Matching Figma Version 44) */}
          {/* ========================================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                    Audit visual
                  </h1>
                  <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                    Tinjau verifikasi yang membutuhkan keputusan manual.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse"></span>
                  <span>{needReviewCount + spoofCount} kasus perlu tindakan</span>
                </div>
              </div>

              {/* 3 Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                  <p className="text-xs font-medium text-[#7D5662]">Antrean aktif</p>
                  <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{needReviewCount + spoofCount}</h3>
                  <p className="text-[11px] font-medium text-[#9E2648] mt-1">{spoofCount} terdeteksi pelanggaran</p>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                  <p className="text-xs font-medium text-[#7D5662]">Ditinjau hari ini</p>
                  <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{totalVerifs}</h3>
                  <p className="text-[11px] font-medium text-gray-400 mt-1">Total sesi terverifikasi</p>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                  <p className="text-xs font-medium text-[#7D5662]">Keputusan manual</p>
                  <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{Object.keys(admittedList).length}</h3>
                  <p className="text-[11px] font-medium text-gray-400 mt-1">{Object.keys(admittedList).length} tindakan host diambil</p>
                </div>
              </div>

              {/* Antrean Pemeriksaan Table */}
              <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Antrean pemeriksaan</h3>
                    <p className="text-xs text-[#7D5662]">Diurutkan berdasarkan waktu masuk data</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF8E6] text-[#F79009] text-xs font-bold border border-[#FDE8B3]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Semua risiko ({verifications.length})</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {verifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Tidak ada antrean pemeriksaan.
                    </div>
                  ) : (
                    verifications.map((item) => {
                      const isBlocked = item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';
                      const isPassed = item.status === 'PASSED';
                      const decision = admittedList[item.id];
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedRecord(item)}
                          className="p-4 rounded-2xl border border-[#F2E4E8] bg-white hover:bg-[#FDF9FA] transition-all cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {item.snapshot_url ? (
                              <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                                <Image src={item.snapshot_url} alt={item.full_name} fill unoptimized className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-[#FAF0F2] text-[#9E2648] font-bold text-xs flex items-center justify-center shrink-0 border border-[#F2D7DE]">
                                {item.full_name.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-bold text-[#2B0E17]">{item.full_name}</h4>
                                {decision && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    decision === 'ADMITTED' ? 'bg-[#EDF9F4] text-[#12B76A]' : 'bg-[#FEE4E2] text-[#F04438]'
                                  }`}>
                                    {decision}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 font-mono">
                                {item.job_position} &middot; {item.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(item.created_at).toLocaleTimeString('id-ID')}
                            </span>

                            <span className="text-xs text-[#7D5662] max-w-xs truncate hidden sm:inline-block">
                              {item.failure_reason || (isPassed ? 'Verifikasi lolos (3D Live)' : 'Pemeriksaan lanjutan')}
                            </span>

                            {isPassed ? (
                              <span className="px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-semibold">
                                &bull; Berhasil
                              </span>
                            ) : isBlocked ? (
                              <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold">
                                &bull; Diblokir
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-[#FFF8E6] text-[#F79009] text-xs font-semibold">
                                &bull; Perlu ditinjau
                              </span>
                            )}

                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: RIWAYAT (Matching Figma Version 44) */}
          {/* ========================================================================= */}
          {activeTab === 'riwayat' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                    Riwayat verifikasi
                  </h1>
                  <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                    Rekam jejak seluruh aktivitas identitas dan keputusan audit.
                  </p>
                </div>

                <button
                  onClick={() => alert('Laporan riwayat CSV berhasil diekspor!')}
                  className="px-4 py-2 rounded-full bg-white border border-[#EEDDE2] hover:bg-[#FAF4F6] text-[#9E2648] text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor laporan</span>
                </button>
              </div>

              {/* Filter Bar matching Figma */}
              <div className="bg-white p-4 rounded-2xl border border-[#F0E4E7] shadow-sm flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Cari nama, ID, atau deteksi..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#9E2648]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#2B0E17] bg-white focus:outline-none"
                  >
                    <option value="ALL">Semua status</option>
                    <option value="PASSED">Berhasil</option>
                    <option value="FAILED">Verifikasi gagal</option>
                    <option value="REVIEW">Perlu ditinjau</option>
                  </select>

                  <select className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#2B0E17] bg-white focus:outline-none">
                    <option>Semua tanggal</option>
                    <option>Hari ini</option>
                    <option>7 hari terakhir</option>
                  </select>

                  <select className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#2B0E17] bg-white focus:outline-none">
                    <option>Semua perangkat</option>
                    <option>Webcam internal</option>
                    <option>Eksternal USB</option>
                  </select>
                </div>
              </div>

              {/* List Aktivitas Terbaru */}
              <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Aktivitas terbaru</h3>
                    <p className="text-xs text-[#7D5662]">Riwayat verifikasi yang sesuai dengan filter</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{filteredHistory.length} rekaman</span>
                </div>

                <div className="space-y-3">
                  {filteredHistory.map((item) => {
                    const isSuccess = item.status === 'PASSED';
                    const isBlocked = item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedRecord(item)}
                        className="p-4 rounded-2xl border border-[#F2E4E8] bg-white hover:bg-[#FDF9FA] transition-all cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {item.snapshot_url ? (
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                              <Image src={item.snapshot_url} alt={item.full_name} fill unoptimized className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-[#FAF0F2] text-[#9E2648] font-bold text-xs flex items-center justify-center shrink-0 border border-[#F2D7DE]">
                              {item.full_name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-[#2B0E17]">{item.full_name}</h4>
                            <p className="text-[11px] text-gray-400 font-mono">2307411028 - REG-24031</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-8">
                          <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(item.created_at).toLocaleTimeString('id-ID')}
                          </span>

                          <span className="text-xs text-[#7D5662]">
                            {isSuccess ? 'Liveness tervalidasi' : (item.failure_reason || 'Depth variance rendah')}
                          </span>

                          {isSuccess ? (
                            <span className="px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-semibold">
                              &bull; Berhasil
                            </span>
                          ) : isBlocked ? (
                            <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold">
                              &bull; Verifikasi gagal
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-[#FFF8E6] text-[#F79009] text-xs font-semibold">
                              &bull; Perlu ditinjau
                            </span>
                          )}

                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PENGATURAN (Matching Figma Version 44) */}
          {/* ========================================================================= */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                    Pengaturan
                  </h1>
                  <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                    Kelola sesi interview dan kebijakan verifikasi.
                  </p>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2.5 rounded-full bg-[#8A233E] hover:bg-[#721A31] text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan perubahan</span>
                </button>
              </div>

              {saveSettingsSuccess && (
                <div className="p-4 rounded-2xl bg-[#EDF9F4] border border-[#A6F4C5] text-[#027A48] text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-sm">
                  <CheckCheck className="w-4 h-4" />
                  <span>Pengaturan sesi interview dan kebijakan berhasil disimpan!</span>
                </div>
              )}

              {/* 2-Column Grid matching Figma Version 44 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Column 1: Sesi interview aktif */}
                <div className="bg-white p-6 sm:p-8 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FDF0F3] text-[#A02848] flex items-center justify-center shrink-0">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#2B0E17]">Sesi interview aktif</h3>
                      <p className="text-xs text-[#7D5662]">Tautan tujuan setelah pelamar berhasil diverifikasi.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#2B0E17] mb-1.5">Nama sesi</label>
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="Interview Batch Juni 2026"
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#9E2648]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#2B0E17] mb-1.5">Tautan ruang meeting</label>
                      <input
                        type="text"
                        value={meetingUrl}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                        placeholder="https://meet.example.com/interview-juni"
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs sm:text-sm text-[#2B0E17] font-mono focus:outline-none focus:border-[#9E2648]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#2B0E17]">Alihkan otomatis</h4>
                        <p className="text-[11px] text-[#7D5662]">Arahkan pelamar setelah verifikasi berhasil</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoRedirect}
                        onChange={(e) => setAutoRedirect(e.target.checked)}
                        className="w-5 h-5 accent-[#12B76A] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Kebijakan verifikasi */}
                <div className="bg-white p-6 sm:p-8 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF8E6] text-[#F79009] flex items-center justify-center shrink-0">
                      <ScanFace className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#2B0E17]">Kebijakan verifikasi</h3>
                      <p className="text-xs text-[#7D5662]">Atur respons sistem terhadap hasil pemeriksaan.</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                      <div>
                        <h4 className="text-xs font-bold text-[#2B0E17]">Blokir kamera virtual</h4>
                        <p className="text-[11px] text-[#7D5662]">Tolak sumber OBS, ManyCam, dan SplitCam</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={blockVirtualCamera}
                        onChange={(e) => setBlockVirtualCamera(e.target.checked)}
                        className="w-5 h-5 accent-[#12B76A] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                      <div>
                        <h4 className="text-xs font-bold text-[#2B0E17]">Audit otomatis</h4>
                        <p className="text-[11px] text-[#7D5662]">Kirim anomali ke antrean pemeriksaan</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoAudit}
                        onChange={(e) => setAutoAudit(e.target.checked)}
                        className="w-5 h-5 accent-[#12B76A] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#2B0E17]">Simpan bukti gagal</h4>
                        <p className="text-[11px] text-[#7D5662]">Simpan snapshot terkompresi untuk audit</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={saveFailSnapshot}
                        onChange={(e) => setSaveFailSnapshot(e.target.checked)}
                        className="w-5 h-5 accent-[#12B76A] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PROFIL ADMINISTRATOR (Matching Figma Version 44) */}
          {/* ========================================================================= */}
          {activeTab === 'profil' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                    Profil administrator
                  </h1>
                  <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                    Informasi akun dan akses ruang interview Anda.
                  </p>
                </div>

                <button
                  onClick={() => alert('Mode edit profil dibuka')}
                  className="px-5 py-2.5 rounded-full bg-white border border-[#EEDDE2] hover:bg-[#FAF4F6] text-[#9E2648] text-xs font-bold shadow-sm transition-all"
                >
                  Edit profil
                </button>
              </div>

              {/* 2-Column Profil Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Info Akun (7 Cols) */}
                <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#8A233E] text-white flex items-center justify-center font-bold text-lg shadow-md">
                      AR
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#2B0E17]">Admin Room</h3>
                      <p className="text-xs text-[#7D5662]">Host utama</p>
                    </div>
                  </div>

                  <div className="divide-y divide-[#F7ECEF] text-xs">
                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Nama lengkap</span>
                      <span className="font-semibold text-[#2B0E17]">Admin Room</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Email</span>
                      <span className="font-semibold font-mono text-[#2B0E17]">admin@verigate.id</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Peran</span>
                      <span className="font-semibold text-[#2B0E17]">Host &middot; Administrator</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Terakhir aktif</span>
                      <span className="font-semibold text-[#2B0E17]">Hari ini, 10:48</span>
                    </div>
                  </div>
                </div>

                {/* Akses dan Keamanan (5 Cols) */}
                <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-5 flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-[#FDF0F3] text-[#A02848] flex items-center justify-center mb-3">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Akses dan keamanan</h3>
                    <p className="text-xs text-[#7D5662]">Ringkasan keamanan akun administrator.</p>

                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#7D5662]">Autentikasi dua langkah</span>
                        <span className="font-semibold text-[#12B76A]">Aktif</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7D5662]">Sesi aktif</span>
                        <span className="font-semibold text-[#2B0E17]">1 perangkat</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7D5662]">Perubahan kata sandi</span>
                        <span className="font-semibold text-gray-500">32 hari lalu</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => alert('Manajemen keamanan akun dibuka')}
                    className="w-full py-3 rounded-2xl bg-[#FAF4F6] hover:bg-[#FBECEF] text-[#9E2648] text-xs font-bold flex items-center justify-center gap-2 transition-colors mt-4"
                  >
                    <span>Kelola keamanan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Snapshot Modal */}
      {modalSnapshot && (
        <div
          onClick={() => setModalSnapshot(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-md w-full aspect-square rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
            <Image src={modalSnapshot} alt="Snapshot Audit" fill unoptimized className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
