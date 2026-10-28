'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Trash2,
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
  const [auditFilter, setAuditFilter] = useState<'ACTIVE' | 'DECIDED' | 'ALL_RISK' | 'ALL'>('ACTIVE');

  // Load persisted decisions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('veriface_admitted_list');
        if (saved) setAdmittedList(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

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

  // Admin Profile Synced with Supabase
  const [adminProfile, setAdminProfile] = useState<{
    id?: string;
    email: string;
    full_name: string;
    role: string;
    last_login?: string | null;
  }>({
    email: 'muhammadbafqi@gmail.com',
    full_name: 'Muhammad Bafqi',
    role: 'Admin',
    last_login: null,
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const fetchAdminProfile = useCallback(async () => {
    try {
      let savedEmail = '';
      if (typeof window !== 'undefined') {
        const storedProfile = sessionStorage.getItem('admin_profile');
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile);
            setAdminProfile(parsed);
            savedEmail = parsed.email;
          } catch (e) {}
        }
        if (!savedEmail) {
          savedEmail = sessionStorage.getItem('admin_email') || '';
        }
      }

      const res = await fetch(`/api/admin/profile${savedEmail ? `?email=${encodeURIComponent(savedEmail)}` : ''}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.admin) {
        setAdminProfile(data.admin);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_profile', JSON.stringify(data.admin));
        }
      }
    } catch (err) {
      console.error('Failed to sync admin profile:', err);
    }
  }, []);

  const handleOpenEditProfile = () => {
    setEditFullName(adminProfile.full_name || '');
    setEditRole(adminProfile.role || '');
    setEditPassword('');
    setProfileMessage(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: adminProfile.id,
          email: adminProfile.email,
          full_name: editFullName || adminProfile.full_name,
          role: editRole || adminProfile.role,
          password: editPassword || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const updated = {
          ...adminProfile,
          full_name: editFullName || adminProfile.full_name,
          role: editRole || adminProfile.role,
        };
        setAdminProfile(updated);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_profile', JSON.stringify(updated));
        }
        setProfileMessage({ type: 'success', text: 'Profil administrator berhasil diperbarui!' });
        setTimeout(() => setIsEditingProfile(false), 800);
      } else {
        setProfileMessage({ type: 'error', text: data.error || 'Gagal memperbarui profil.' });
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Authentication Guard with Remembered Session support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('admin_auth');
      if (auth === 'true') {
        setIsAuthenticated(true);
        fetchAdminProfile();
        return;
      }

      // Check for persistent remembered session
      const savedSession = localStorage.getItem('veriface_admin_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
            sessionStorage.setItem('admin_auth', 'true');
            sessionStorage.setItem('admin_email', parsed.email);
            sessionStorage.setItem('admin_profile', JSON.stringify(parsed));
            setIsAuthenticated(true);
            fetchAdminProfile();
            return;
          }
        } catch (e) {}
      }

      router.push('/admin/login');
    }
  }, [router, fetchAdminProfile]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_email');
      sessionStorage.removeItem('admin_profile');
      localStorage.removeItem('veriface_admin_session');
      // veriface_saved_email remains saved so email is prefilled on login!
    }
    router.push('/admin/login');
  };

  // Fetch initial verifications & settings
  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/verifications?status=ALL&_t=${Date.now()}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.verifications) {
        setVerifications(data.verifications);
        // Only refresh currently open record if one was actively selected; do not auto-open detail view
        setSelectedRecord((prev) => (prev ? data.verifications.find((v: VerificationRecord) => v.id === prev.id) || null : null));
      }
    } catch (err) {
      console.error('Error fetching verifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

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
        setTimeout(() => setSaveSettingsSuccess(false), 4000);
        await fetchSettings();
      } else {
        alert(data.message || 'Gagal menyimpan pengaturan Zoom.');
      }
    } catch (e: any) {
      console.error('Save settings failed:', e);
      alert('Terjadi kesalahan koneksi saat menyimpan pengaturan.');
    }
  };

  // Dynamic KPI calculated purely from live database records + host decisions
  const totalVerifs = verifications.length;

  // All non-passed incidents entering the audit pool
  const auditQueueList = verifications.filter((v) => v.status !== 'PASSED');

  // Incidents that have NOT been decided yet (pending review)
  const activePendingQueue = auditQueueList.filter((v) => !admittedList[v.id]);
  const activeQueueCount = activePendingQueue.length;

  // Incidents decided by host
  const decidedList = auditQueueList.filter((v) => !!admittedList[v.id]);
  const decidedCount = decidedList.length;
  const removedCount = auditQueueList.filter((v) => admittedList[v.id] === 'REMOVED').length;
  const manuallyAdmittedCount = auditQueueList.filter((v) => admittedList[v.id] === 'ADMITTED').length;

  // Final count tallies (100% synchronized and mathematically sum to totalVerifs)
  const totalPassedCount = verifications.filter((v) => v.status === 'PASSED').length + manuallyAdmittedCount;
  // If host has made decisions, display blocked count reflects removed cases; otherwise all unreviewed violations are pending review
  const displayBlockedCount = decidedCount > 0 ? removedCount : 0;

  // Percentage calculations
  const passRate = totalVerifs > 0 ? ((totalPassedCount / totalVerifs) * 100).toFixed(1) : '0';
  const activeAuditRate = totalVerifs > 0 ? ((activeQueueCount / totalVerifs) * 100).toFixed(1) : '0';
  const blockedRate = totalVerifs > 0 ? ((displayBlockedCount / totalVerifs) * 100).toFixed(1) : '0';

  // Donut chart arc calculations (Circumference = 2 * PI * 38 = 238.76)
  const donutCirc = 238.76;
  const segPassed = totalVerifs > 0 ? (totalPassedCount / totalVerifs) * donutCirc : 0;
  const segReview = totalVerifs > 0 ? (activeQueueCount / totalVerifs) * donutCirc : 0;
  const segBlocked = totalVerifs > 0 ? (displayBlockedCount / totalVerifs) * donutCirc : 0;

  const displayedAuditList = verifications.filter((item) => {
    if (auditFilter === 'DECIDED') return !!admittedList[item.id];
    if (auditFilter === 'ALL_RISK') return item.status !== 'PASSED';
    if (auditFilter === 'ALL') return true;
    // Default 'ACTIVE': risk incidents that have NOT been decided yet
    return item.status !== 'PASSED' && !admittedList[item.id];
  });

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
    setAdmittedList((prev) => {
      const next = { ...prev };
      if (next[id] === decision) {
        delete next[id]; // Toggle off if clicked again to reset back to pending queue
      } else {
        next[id] = decision;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('veriface_admitted_list', JSON.stringify(next));
      }
      return next;
    });
  };

  const handleResetDecisions = () => {
    if (!confirm('Kembalikan semua keputusan manual ke antrean aktif?')) return;
    setAdmittedList({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('veriface_admitted_list');
    }
  };

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteRecord = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Apakah Anda yakin ingin menghapus data verifikasi ini?')) return;

    setIsDeleting(id);
    try {
      const res = await fetch(`/api/admin/verifications?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setVerifications((prev) => prev.filter((v) => v.id !== id));
        setAdmittedList((prev) => {
          const next = { ...prev };
          delete next[id];
          if (typeof window !== 'undefined') {
            localStorage.setItem('veriface_admitted_list', JSON.stringify(next));
          }
          return next;
        });
        if (selectedRecord?.id === id) {
          setSelectedRecord(null);
        }
      } else {
        alert(data.message || 'Gagal menghapus rekaman.');
      }
    } catch (err) {
      console.error('Failed to delete verification:', err);
      alert('Terjadi kesalahan saat menghapus rekaman.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Dynamic Realtime Notifications synchronized with live verification database & decisions
  const dynamicNotifications = useMemo(() => {
    // Show top recent verifications, prioritizing active unreviewed incidents
    const incidents = verifications.filter((v) => v.status !== 'PASSED' && !admittedList[v.id]);
    const others = verifications.filter((v) => !incidents.some((inc) => inc.id === v.id));
    const combined = [...incidents, ...others].slice(0, 6);

    return combined.map((item) => {
      const isPassed = item.status === 'PASSED';
      const isBlocked = item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';
      const decision = admittedList[item.id];

      let desc = item.failure_reason || (isPassed ? 'Verifikasi lolos (3D Live)' : 'Terdeteksi risiko foto/layar');
      if (decision === 'REMOVED') desc = 'Akses ditolak oleh host';
      if (decision === 'ADMITTED') desc = 'Diizinkan masuk oleh host';

      const timeFormatted = item.created_at
        ? new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Baru saja';

      return {
        id: item.id,
        record: item,
        name: item.full_name || 'Peserta',
        desc,
        time: `${timeFormatted} · ${item.job_position || item.email}`,
        type: isPassed ? 'passed' : isBlocked ? 'blocked' : 'warning',
        isPending: !isPassed && !decision,
      };
    });
  }, [verifications, admittedList]);

  const unreadCount = dynamicNotifications.filter((n) => n.isPending).length;

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

  // Export verification history to CSV with real browser download
  const handleExportCSV = () => {
    const recordsToExport = filteredHistory.length > 0 ? filteredHistory : verifications;

    if (recordsToExport.length === 0) {
      alert('Tidak ada data riwayat verifikasi untuk diekspor.');
      return;
    }

    const headers = [
      'ID Verifikasi',
      'Nama Lengkap',
      'Email',
      'Posisi Pekerjaan',
      'Status Verifikasi',
      'Keputusan Host',
      'Alasan / Catatan Deteksi',
      'Depth Variance',
      'Luminance Score (%)',
      'Confidence Score (%)',
      'Waktu Verifikasi',
      'Alamat IP',
      'Tautan Snapshot',
    ];

    const rows = recordsToExport.map((item) => {
      const decision = admittedList[item.id] || (item.status === 'PASSED' ? 'DISETUJUI_OTOMATIS' : 'BELUM_DIPUTUSKAN');
      const formattedDate = item.created_at
        ? new Date(item.created_at).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'medium',
          })
        : '-';

      const rowValues = [
        item.id,
        item.full_name || '-',
        item.email || '-',
        item.job_position || '-',
        item.status,
        decision,
        item.failure_reason || (item.status === 'PASSED' ? 'Liveness tervalidasi' : '-'),
        item.depth_variance !== null ? item.depth_variance.toString() : '-',
        item.luminance_score !== null ? `${item.luminance_score}%` : '-',
        item.confidence_score !== null ? `${item.confidence_score}%` : '-',
        formattedDate,
        item.ip_address || '127.0.0.1',
        item.snapshot_url || '-',
      ];

      return rowValues
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `veriface_laporan_riwayat_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                <h2 className="text-lg font-bold tracking-tight text-[#2B0E17]">Veriface</h2>
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
                onClick={() => {
                  setActiveTab('audit');
                  setSelectedRecord(null);
                }}
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
                  {activeQueueCount}
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
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#8A233E] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                  {getInitials(adminProfile.full_name)}
                </div>
                <div className="min-w-0 truncate">
                  <h4 className="text-xs font-bold text-[#2B0E17] truncate">{adminProfile.full_name}</h4>
                  <p className="text-[10px] text-[#8C3A50] truncate">{adminProfile.role || 'Administrator'}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col gap-6 overflow-x-hidden">
          
          {/* Top Actions Bar (Search bar removed per request) */}
          <div className="flex items-center justify-end gap-4 relative z-20">
            <div className="flex items-center gap-3">
              {/* Notification Popover Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowNotificationModal(!showNotificationModal)}
                  className="p-2.5 rounded-full bg-white border border-[#EEDDE2] text-[#6B4B55] hover:text-[#9E2648] hover:bg-[#FAF4F6] shadow-sm transition-all relative"
                  title="Notifikasi"
                >
                  <Bell className="w-4 h-4" />
                  {!notificationsRead && unreadCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#9E2648] absolute top-2 right-2 animate-pulse"></span>
                  )}
                </button>

                {/* Notification Dropdown Panel matching Figma Version 44 */}
                {showNotificationModal && (
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-3xl p-5 shadow-2xl border border-[#F0E4E7] z-50 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                      <div>
                        <h4 className="text-sm font-bold text-[#2B0E17]">Notifikasi</h4>
                        <p className="text-[11px] text-[#7D5662]">
                          {unreadCount > 0 ? `${unreadCount} insiden perlu tindakan` : `${dynamicNotifications.length} pembaruan terbaru`}
                        </p>
                      </div>
                      <button
                        onClick={() => setNotificationsRead(true)}
                        className="text-[11px] font-semibold text-[#9E2648] hover:underline"
                      >
                        Tandai dibaca
                      </button>
                    </div>

                    <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {dynamicNotifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400">
                          Belum ada notifikasi aktivitas.
                        </div>
                      ) : (
                        dynamicNotifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setShowNotificationModal(false);
                              setSelectedRecord(n.record);
                              setActiveTab('audit');
                            }}
                            className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#FAF4F6] transition-colors relative cursor-pointer"
                            title="Klik untuk membuka tinjauan"
                          >
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                              n.type === 'passed'
                                ? 'bg-[#EDF9F4] text-[#12B76A]'
                                : n.type === 'blocked'
                                ? 'bg-[#FEE4E2] text-[#F04438]'
                                : 'bg-[#FFF8E6] text-[#F79009]'
                            }`}>
                              {n.type === 'passed' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : n.type === 'blocked' ? (
                                <ShieldCheck className="w-4 h-4" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h5 className="text-xs font-bold text-[#2B0E17] truncate">{n.name}</h5>
                                {n.isPending && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FBECEF] text-[#9E2648]">Aktif</span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#7D5662] truncate">{n.desc}</p>
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">{n.time}</span>
                            </div>
                            {n.isPending && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#9E2648] shrink-0 mt-1.5"></span>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowNotificationModal(false);
                        setSelectedRecord(null);
                        setAuditFilter('ACTIVE');
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
                title={adminProfile.full_name}
                className="w-10 h-10 rounded-full bg-[#8A233E] text-white flex items-center justify-center font-bold text-xs shadow-sm hover:scale-105 transition-transform"
              >
                {getInitials(adminProfile.full_name)}
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
                  Selamat datang, {adminProfile.full_name}
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
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{totalPassedCount.toLocaleString('id-ID')}</h3>
                    <p className="text-[11px] font-medium text-[#12B76A] mt-0.5">{passRate}% success rate</p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setSelectedRecord(null);
                    setAuditFilter('ACTIVE');
                    setActiveTab('audit');
                  }}
                  className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 cursor-pointer hover:border-[#8A233E]/30 transition-all"
                  title="Klik untuk membuka Antrean Audit visual"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF8E6] text-[#F79009] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Perlu ditinjau</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{activeQueueCount}</h3>
                    <p className="text-[11px] font-medium text-[#F79009] mt-0.5">{activeQueueCount} kasus aktif</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FEE4E2] text-[#F04438] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Diblokir</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{displayBlockedCount}</h3>
                    <p className="text-[11px] font-medium text-[#F04438] mt-0.5">
                      {decidedCount > 0 ? `${removedCount} dikeluarkan host` : `${auditQueueList.length} pelanggaran terdeteksi`}
                    </p>
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
                          {/* Segment 1: Green (Berhasil) */}
                          {segPassed > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#12B76A"
                              strokeWidth="11"
                              strokeDasharray={`${segPassed} ${donutCirc - segPassed}`}
                              strokeDashoffset={0}
                              fill="transparent"
                              className="transition-all duration-500"
                            />
                          )}
                          {/* Segment 2: Amber (Perlu ditinjau) */}
                          {segReview > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#F79009"
                              strokeWidth="11"
                              strokeDasharray={`${segReview} ${donutCirc - segReview}`}
                              strokeDashoffset={-segPassed}
                              fill="transparent"
                              className="transition-all duration-500"
                            />
                          )}
                          {/* Segment 3: Red (Diblokir) */}
                          {segBlocked > 0 && (
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#F04438"
                              strokeWidth="11"
                              strokeDasharray={`${segBlocked} ${donutCirc - segBlocked}`}
                              strokeDashoffset={-(segPassed + segReview)}
                              fill="transparent"
                              className="transition-all duration-500"
                            />
                          )}
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
                      <span className="text-[#2B0E17] font-bold">{passRate}% ({totalPassedCount})</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F79009]" />
                        <span className="text-[#6B4B55]">Perlu ditinjau</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{activeAuditRate}% ({activeQueueCount})</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F04438]" />
                        <span className="text-[#6B4B55]">Diblokir</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">
                        {blockedRate}% ({displayBlockedCount})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Antrean Audit Terbaru */}
              <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Antrean audit terbaru</h3>
                    <p className="text-xs text-[#7D5662]">Insiden yang membutuhkan validasi manual ({activeQueueCount} aktif)</p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedRecord(null);
                      setAuditFilter('ACTIVE');
                      setActiveTab('audit');
                    }}
                    className="text-xs font-bold text-[#9E2648] hover:text-[#7A1934] flex items-center gap-1.5 transition-colors"
                  >
                    <span>Buka antrean lengkap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {activePendingQueue.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs bg-[#FAF4F6]/50 rounded-2xl border border-dashed border-[#F2E4E8]">
                      {decidedCount > 0 ? (
                        <div className="space-y-1.5">
                          <p className="font-semibold text-emerald-700">Semua insiden telah diselesaikan oleh host ({decidedCount} kasus).</p>
                          <button
                            onClick={() => {
                              setSelectedRecord(null);
                              setAuditFilter('DECIDED');
                              setActiveTab('audit');
                            }}
                            className="text-[11px] text-[#9E2648] hover:underline font-bold"
                          >
                            Lihat hasil keputusan di Audit visual &rarr;
                          </button>
                        </div>
                      ) : (
                        'Tidak ada insiden yang memerlukan validasi manual saat ini.'
                      )}
                    </div>
                  ) : (
                    activePendingQueue.slice(0, 5).map((item) => {
                      const decision = admittedList[item.id];
                      const isSuccess = item.status === 'PASSED';
                      const isBlocked = item.status === 'SPOOF_FAILED' || item.status === 'VIRTUAL_CAM_BLOCKED';

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedRecord(item);
                            setActiveTab('audit');
                          }}
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
                              <button
                                onClick={(e) => handleDeleteRecord(item.id, e)}
                                title="Hapus rekaman"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                              >
                                <Trash2 className="w-4 h-4" />
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
          {/* ========================================================================= */}
          {/* TAB 2: AUDIT VISUAL (Matching Figma Version 44) */}
          {/* ========================================================================= */}
          {activeTab === 'audit' && (
            selectedRecord ? (
              <div className="space-y-6">
                {/* Top bar: Kembali & Status Badge */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C3A50] hover:text-[#9E2648] transition-colors bg-white px-3.5 py-1.5 rounded-full border border-[#F2E4E8] shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Kembali</span>
                  </button>

                  {admittedList[selectedRecord.id] ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      admittedList[selectedRecord.id] === 'ADMITTED'
                        ? 'bg-[#EDF9F4] text-[#12B76A] border border-[#A6F4C5]'
                        : 'bg-[#FEE4E2] text-[#F04438] border border-[#FECDCA]'
                    }`}>
                      &bull; {admittedList[selectedRecord.id] === 'ADMITTED' ? 'Diizinkan masuk' : 'Akses ditolak'}
                    </span>
                  ) : selectedRecord.status === 'PASSED' ? (
                    <span className="px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-bold border border-[#A6F4C5]">
                      &bull; Berhasil
                    </span>
                  ) : selectedRecord.status === 'SPOOF_FAILED' || selectedRecord.status === 'VIRTUAL_CAM_BLOCKED' ? (
                    <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-bold border border-[#FECDCA]">
                      &bull; Diblokir
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[#FFF8E6] text-[#F79009] text-xs font-bold border border-[#FDE8B3]">
                      &bull; Perlu ditinjau
                    </span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
                    Tinjau verifikasi
                  </h1>
                  <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                    Validasi bukti visual dan metrik deteksi.
                  </p>
                </div>

                {/* 2-Column Inspection Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Snapshot bukti */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                    <h3 className="text-base font-bold text-[#2B0E17]">Snapshot bukti</h3>

                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#1E0D13] flex items-center justify-center border border-[#F2E4E8]">
                      {selectedRecord.snapshot_url ? (
                        <>
                          <Image
                            src={selectedRecord.snapshot_url}
                            alt={selectedRecord.full_name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-[#12B76A]/90 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
                            <ScanFace className="w-4 h-4" />
                            <span>Wajah terdeteksi</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-white/60">
                          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-[#F2D7DE] font-bold text-2xl mb-3 border border-white/15">
                            {selectedRecord.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-white">Tidak Ada Snapshot Bukti</p>
                          <p className="text-xs text-white/50 mt-1 max-w-xs">
                            Kandidat lolos uji biometrik tanpa insiden keamanan yang perlu direkam.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Candidate Profile & Metrics */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-6">
                    <div>
                      {/* Profile Header */}
                      <div className="flex items-center gap-3.5 pb-5 border-b border-[#F7ECEF]">
                        {selectedRecord.snapshot_url ? (
                          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                            <Image src={selectedRecord.snapshot_url} alt={selectedRecord.full_name} fill unoptimized className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#9E2648] font-bold text-sm flex items-center justify-center shrink-0 border border-[#F2D7DE]">
                            {selectedRecord.full_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-[#2B0E17] truncate">{selectedRecord.full_name}</h4>
                          <p className="text-xs text-[#7D5662] truncate">
                            {selectedRecord.id.substring(0, 16)} &middot; {selectedRecord.job_position}
                          </p>
                        </div>
                      </div>

                      {/* Details Table */}
                      <div className="divide-y divide-[#F7ECEF] text-xs">
                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Waktu verifikasi</span>
                          <span className="font-semibold text-[#2B0E17]">
                            {new Date(selectedRecord.created_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Hasil deteksi</span>
                          <span className="font-semibold text-[#2B0E17] text-right max-w-[200px] truncate">
                            {selectedRecord.failure_reason || (selectedRecord.status === 'PASSED' ? 'Verifikasi lolos (3D Live)' : 'Pemeriksaan lanjutan')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Depth variance</span>
                          <span className="font-semibold text-[#2B0E17]">
                            {selectedRecord.depth_variance?.toFixed(4) || '0.0028'} &middot;{' '}
                            <span className={(selectedRecord.depth_variance ?? 0) < 0.0012 ? 'text-red-500' : 'text-emerald-600'}>
                              {(selectedRecord.depth_variance ?? 0) < 0.0012 ? 'Rendah' : 'Optimal'}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Luminance</span>
                          <span className="font-semibold text-[#2B0E17]">
                            {Math.round(selectedRecord.luminance_score || 68)}% &middot;{' '}
                            <span className="text-emerald-600">Optimal</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Perangkat</span>
                          <span className="font-semibold text-[#2B0E17]">
                            {selectedRecord.user_agent?.includes('Windows')
                              ? 'Chrome • Windows 11'
                              : selectedRecord.user_agent?.includes('Mac')
                              ? 'Safari • macOS'
                              : 'Web Browser'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                          <span className="text-[#7D5662]">Alamat IP</span>
                          <span className="font-mono text-gray-500 text-[11px]">
                            {selectedRecord.ip_address || '127.0.0.1'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4 border-t border-[#F7ECEF]">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleDecision(selectedRecord.id, 'ADMITTED')}
                          className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            admittedList[selectedRecord.id] === 'ADMITTED'
                              ? 'bg-[#12B76A] text-white shadow-md shadow-[#12B76A]/20'
                              : 'bg-[#EDF9F4] text-[#12B76A] hover:bg-[#DDF4EA] border border-[#A6F4C5]'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Izinkan masuk</span>
                        </button>

                        <button
                          onClick={() => handleDecision(selectedRecord.id, 'REMOVED')}
                          className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            admittedList[selectedRecord.id] === 'REMOVED'
                              ? 'bg-[#F04438] text-white shadow-md shadow-[#F04438]/20'
                              : 'bg-[#FEE4E2] text-[#F04438] hover:bg-[#FCD4D0] border border-[#FECDCA]'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Tolak akses</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteRecord(selectedRecord.id)}
                        disabled={isDeleting === selectedRecord.id}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{isDeleting === selectedRecord.id ? 'Menghapus data...' : 'Hapus Rekaman Ini'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
                    <span>{activeQueueCount} kasus perlu tindakan</span>
                  </div>
                </div>

                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-xs font-medium text-[#7D5662]">Antrean aktif</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{activeQueueCount}</h3>
                    <p className="text-[11px] font-medium text-[#9E2648] mt-1">
                      {activePendingQueue.filter((v) => v.status === 'SPOOF_FAILED').length} terdeteksi pelanggaran belum diputuskan
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-xs font-medium text-[#7D5662]">Ditinjau hari ini</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{totalVerifs}</h3>
                    <p className="text-[11px] font-medium text-gray-400 mt-1">Total sesi terverifikasi</p>
                  </div>

                  <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-xs font-medium text-[#7D5662]">Keputusan manual</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{decidedCount}</h3>
                    <p className="text-[11px] font-medium text-gray-400 mt-1">{decidedCount} tindakan host diambil</p>
                  </div>
                </div>

                {/* Antrean Pemeriksaan Table */}
                <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F7ECEF]">
                    <div>
                      <h3 className="text-base font-bold text-[#2B0E17]">Antrean pemeriksaan</h3>
                      <p className="text-xs text-[#7D5662]">Diurutkan berdasarkan waktu masuk data</p>
                    </div>

                    {/* Filter Tabs matching count */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setAuditFilter('ACTIVE')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          auditFilter === 'ACTIVE'
                            ? 'bg-[#8A233E] text-white shadow-sm'
                            : 'bg-[#FAF4F6] text-[#7D5662] hover:bg-[#F2E4E8]'
                        }`}
                      >
                        Antrean aktif ({activeQueueCount})
                      </button>

                      <button
                        onClick={() => setAuditFilter('DECIDED')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          auditFilter === 'DECIDED'
                            ? 'bg-[#12B76A] text-white shadow-sm'
                            : 'bg-[#FAF4F6] text-[#7D5662] hover:bg-[#F2E4E8]'
                        }`}
                      >
                        Sudah diputuskan ({decidedList.length})
                      </button>

                      <button
                        onClick={() => setAuditFilter('ALL_RISK')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          auditFilter === 'ALL_RISK'
                            ? 'bg-[#F04438] text-white shadow-sm'
                            : 'bg-[#FAF4F6] text-[#7D5662] hover:bg-[#F2E4E8]'
                        }`}
                      >
                        Semua risiko ({auditQueueList.length})
                      </button>

                      <button
                        onClick={() => setAuditFilter('ALL')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          auditFilter === 'ALL'
                            ? 'bg-[#2B0E17] text-white shadow-sm'
                            : 'bg-[#FAF4F6] text-[#7D5662] hover:bg-[#F2E4E8]'
                        }`}
                      >
                        Semua sesi ({totalVerifs})
                      </button>

                      {decidedList.length > 0 && (
                        <button
                          onClick={handleResetDecisions}
                          title="Kembalikan semua keputusan host ke antrean aktif"
                          className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-dashed border-gray-300 transition-all flex items-center gap-1 ml-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset keputusan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {displayedAuditList.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        Tidak ada antrean pemeriksaan pada filter ini.
                      </div>
                    ) : (
                      displayedAuditList.map((item) => {
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

                              <button
                                onClick={(e) => handleDeleteRecord(item.id, e)}
                                title="Hapus rekaman"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )
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
                  onClick={handleExportCSV}
                  className="px-4 py-2 rounded-full bg-white border border-[#EEDDE2] hover:bg-[#FAF4F6] text-[#9E2648] text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  title="Unduh laporan CSV"
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
                        onClick={() => {
                          setSelectedRecord(item);
                          setActiveTab('audit');
                        }}
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

                          <button
                            onClick={(e) => handleDeleteRecord(item.id, e)}
                            title="Hapus rekaman"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleOpenEditProfile}
                    className="px-4 py-2.5 rounded-full bg-white border border-[#EEDDE2] hover:bg-[#FAF4F6] text-[#9E2648] text-xs font-bold shadow-sm transition-all"
                  >
                    Edit profil
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2.5 rounded-full bg-[#FAF4F6] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#F2D7DE] text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                    title="Keluar dari akun admin"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Profil Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Info Akun (7 Cols) */}
                <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#8A233E] text-white flex items-center justify-center font-bold text-lg shadow-md">
                      {getInitials(adminProfile.full_name)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#2B0E17]">{adminProfile.full_name}</h3>
                      <p className="text-xs text-[#7D5662]">{adminProfile.role || 'Host utama'}</p>
                    </div>
                  </div>

                  <div className="divide-y divide-[#F7ECEF] text-xs">
                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Nama lengkap</span>
                      <span className="font-semibold text-[#2B0E17]">{adminProfile.full_name}</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Email</span>
                      <span className="font-semibold font-mono text-[#2B0E17]">{adminProfile.email}</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Peran</span>
                      <span className="font-semibold text-[#2B0E17]">{adminProfile.role || 'Host &middot; Administrator'}</span>
                    </div>

                    <div className="py-3 flex justify-between">
                      <span className="text-[#7D5662]">Terakhir aktif</span>
                      <span className="font-semibold text-[#2B0E17]">
                        {adminProfile.last_login
                          ? new Date(adminProfile.last_login).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Hari ini'}
                      </span>
                    </div>
                  </div>

                  {/* Sesi Administrator & Logout Row */}
                  <div className="pt-3 border-t border-[#F7ECEF] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#2B0E17]">Sesi Administrator</h4>
                      <p className="text-[11px] text-[#7D5662]">Keluar dan akhiri sesi login Anda</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-xl bg-[#FEE4E2] hover:bg-[#FCD4D0] text-[#D92D20] text-xs font-bold flex items-center gap-1.5 transition-all border border-[#FECDCA]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log out</span>
                    </button>
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

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 shadow-2xl border border-[#F0E4E7] relative">
            <h3 className="text-lg font-bold text-[#2B0E17] mb-1">Edit Profil Administrator</h3>
            <p className="text-xs text-[#7D5662] mb-5">Perbarui informasi akun administrator di Supabase.</p>

            {profileMessage && (
              <div className={`p-3 mb-4 rounded-xl text-xs flex items-center gap-2 ${
                profileMessage.type === 'success' ? 'bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]' : 'bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA]'
              }`}>
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B4B55] mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#8A233E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B4B55] mb-1.5">Peran / Role</label>
                <input
                  type="text"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#8A233E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B4B55] mb-1.5">
                  Kata Sandi Baru <span className="font-normal text-gray-400">(Kosongkan jika tidak diubah)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#8A233E]"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="w-1/2 py-3 rounded-2xl font-semibold text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-1/2 py-3 rounded-2xl font-bold text-xs bg-[#8A233E] hover:bg-[#721A31] text-white shadow-md transition-all disabled:opacity-50"
                >
                  {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
