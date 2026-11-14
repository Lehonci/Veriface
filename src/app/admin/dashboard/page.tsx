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
  Trash2,
  ChevronDown,
  Calendar,
  Laptop,
  RotateCcw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatNotificationDesc(v: VerificationRecord): string {
  if (v.status === 'PASSED') {
    const conf = Math.round((v.confidence_score || 0.95) * 100);
    return `Lolos verifikasi liveness (${conf}% confidence)`;
  }
  if (v.status === 'VIRTUAL_CAM_BLOCKED') {
    return 'Kamera virtual (OBS/ManyCam) terdeteksi';
  }
  if (v.status === 'SPOOF_FAILED') {
    return v.failure_reason || 'Terindikasi foto cetak / layar perangkat';
  }
  return v.failure_reason || 'Verifikasi gagal';
}

function formatNotificationTime(isoString?: string): string {
  if (!isoString) return 'Baru saja';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Baru saja';
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  } catch {
    return 'Baru saja';
  }
}

function getNotificationType(status: string): 'passed' | 'blocked' {
  if (status === 'PASSED') return 'passed';
  return 'blocked';
}

interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: DropdownOption<T>[];
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

function CustomDropdown<T extends string>({
  value,
  onChange,
  options,
  icon,
  ariaLabel,
  className = '',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];
  const isFiltered = value !== 'ALL';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        aria-label={ariaLabel || selectedOption?.label}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-9 px-3.5 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-between gap-2.5 border select-none ${
          isFiltered
            ? 'bg-[#FBECEF] text-[#9E2648] border-[#9E2648]/40 shadow-sm font-semibold'
            : 'bg-white text-[#2B0E17] border-gray-200 hover:border-[#9E2648]/30 hover:bg-[#FAF4F6]'
        }`}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {icon && (
            <span className={isFiltered ? 'text-[#9E2648]' : 'text-gray-400'}>
              {icon}
            </span>
          )}
          <span>{selectedOption?.label}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#9E2648]' : 'text-gray-400'
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[170px] w-max max-w-[240px] bg-white rounded-2xl border border-[#F2E4E8] shadow-[0_12px_32px_rgba(43,14,23,0.12)] p-1.5 backdrop-blur-lg animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left select-none ${
                    isSelected
                      ? 'bg-[#FBECEF] text-[#9E2648] font-semibold'
                      : 'text-[#5A3843] hover:bg-[#FAF4F6] hover:text-[#2B0E17]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {opt.icon && (
                      <span className={isSelected ? 'text-[#9E2648]' : 'text-gray-400'}>
                        {opt.icon}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#9E2648] stroke-[2.5] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Real-time Notification state
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [notificationsRead, setNotificationsRead] = useState<boolean>(true);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    name: string;
    desc: string;
    time: string;
    type: 'passed' | 'blocked';
    record: VerificationRecord;
  } | null>(null);

  // Settings State matching Figma Version 44
  const [sessionName, setSessionName] = useState('Interview Batch Juni 2026');
  const [meetingUrl, setMeetingUrl] = useState('https://meet.example.com/interview-juni');
  const [autoRedirect, setAutoRedirect] = useState(true);
  const [blockVirtualCamera, setBlockVirtualCamera] = useState(true);
  const [autoAudit, setAutoAudit] = useState(true);
  const [saveFailSnapshot, setSaveFailSnapshot] = useState(true);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  // History Filter State
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [historyDeviceFilter, setHistoryDeviceFilter] = useState<'ALL' | 'INTERNAL' | 'EXTERNAL'>('ALL');
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
      let url = `/api/admin/verifications?status=ALL&_t=${Date.now()}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.verifications) {
        setVerifications(data.verifications);
        setSelectedRecord((prev) => prev || (data.verifications.length > 0 ? data.verifications[0] : null));
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

  // Audio chime generator using Web Audio API
  const playNotificationChime = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback might require user interaction in some browsers
    }
  }, []);

  // Handler for incoming verification record (real-time websocket or polling)
  const handleIncomingRecord = useCallback(
    (newRecord: VerificationRecord) => {
      setVerifications((prev) => {
        if (prev.some((v) => v.id === newRecord.id)) return prev;
        return [newRecord, ...prev];
      });

      setSelectedRecord((prev) => prev || newRecord);

      const timeStr = formatNotificationTime(newRecord.created_at);
      const descStr = formatNotificationDesc(newRecord);
      const typeStr = getNotificationType(newRecord.status);

      setUnreadIds((prev) => new Set(prev).add(newRecord.id));
      setNotificationsRead(false);
      setToastNotification({
        id: newRecord.id,
        name: newRecord.full_name,
        desc: descStr,
        time: timeStr,
        type: typeStr,
        record: newRecord,
      });

      playNotificationChime();
    },
    [playNotificationChime]
  );

  // Auto-dismiss floating toast after 6 seconds
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Realtime subscription via Supabase WebSocket
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('verifications-realtime-admin-v44')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'verifications' },
        (payload) => {
          const newRecord = payload.new as VerificationRecord;
          handleIncomingRecord(newRecord);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, handleIncomingRecord]);

  // Polling fallback (menjamin pembaruan real-time bekerja mulus bahkan dalam mode lokal / in-memory DB)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/verifications?status=ALL&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && Array.isArray(data.verifications)) {
          setVerifications((prev) => {
            const existingIds = new Set(prev.map((v) => v.id));
            const newIncoming = (data.verifications as VerificationRecord[]).filter((v) => !existingIds.has(v.id));
            if (newIncoming.length > 0) {
              newIncoming.forEach((rec) => {
                handleIncomingRecord(rec);
              });
              return [...newIncoming, ...prev];
            }
            return prev;
          });
        }
      } catch {
        // Silently ignore background polling exceptions
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, handleIncomingRecord]);

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
  const failedCount = verifications.filter((v) => v.status !== 'PASSED').length;
  const passRate = totalVerifs > 0 ? ((passedCount / totalVerifs) * 100).toFixed(1) : '0';
  const failRate = totalVerifs > 0 ? ((failedCount / totalVerifs) * 100).toFixed(1) : '0';
  const avgConfidence =
    totalVerifs > 0
      ? Math.round(
          (verifications.reduce((acc, v) => acc + (v.confidence_score || 0.95), 0) /
            totalVerifs) *
            100
        )
      : 95;

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

  const notificationsList = verifications.map((v) => ({
    id: v.id,
    name: v.full_name,
    desc: formatNotificationDesc(v),
    time: `${formatNotificationTime(v.created_at)} - ${v.job_position || 'Pelamar'}`,
    type: getNotificationType(v.status),
    record: v,
    isUnread: unreadIds.has(v.id),
  }));

  // Filtered History list
  const filteredHistory = verifications.filter((item) => {
    // 1. Pencarian teks (Nama, Email, Posisi, ID, Alasan)
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      const matchName = (item.full_name || '').toLowerCase().includes(q);
      const matchEmail = (item.email || '').toLowerCase().includes(q);
      const matchPos = (item.job_position || item.jobPosition || '').toLowerCase().includes(q);
      const matchId = (item.id || '').toLowerCase().includes(q);
      const matchReason = (item.failure_reason || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPos && !matchId && !matchReason) return false;
    }

    // 2. Filter Status: Berhasil vs Gagal (tidak ada lagi "perlu ditinjau")
    if (historyStatusFilter === 'PASSED') {
      if (item.status !== 'PASSED') return false;
    } else if (historyStatusFilter === 'FAILED') {
      if (item.status === 'PASSED') return false;
    }

    // 3. Filter Tanggal: Semua, Hari ini, 7 hari, 30 hari
    if (historyDateFilter !== 'ALL') {
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      const now = new Date();

      if (historyDateFilter === 'TODAY') {
        const isSameDay =
          itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear();
        if (!isSameDay) return false;
      } else if (historyDateFilter === '7DAYS') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        if (itemDate < sevenDaysAgo) return false;
      } else if (historyDateFilter === '30DAYS') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        if (itemDate < thirtyDaysAgo) return false;
      }
    }

    // 4. Filter Perangkat: Webcam Internal vs Eksternal USB / Virtual
    if (historyDeviceFilter !== 'ALL') {
      const isExternalOrVirtual =
        item.status === 'VIRTUAL_CAM_BLOCKED' ||
        Boolean(item.failure_reason && /kamera virtual|virtual|eksternal|usb|obs|manycam/i.test(item.failure_reason)) ||
        Boolean(item.user_agent && /obs|vcam|manycam|droidcam|iriun/i.test(item.user_agent));

      if (historyDeviceFilter === 'INTERNAL') {
        if (isExternalOrVirtual) return false;
      } else if (historyDeviceFilter === 'EXTERNAL') {
        if (!isExternalOrVirtual) return false;
      }
    }

    return true;
  });

  const hasActiveHistoryFilter =
    historyStatusFilter !== 'ALL' ||
    historyDateFilter !== 'ALL' ||
    historyDeviceFilter !== 'ALL' ||
    historySearchQuery.trim() !== '';

  const resetHistoryFilters = () => {
    setHistoryStatusFilter('ALL');
    setHistoryDateFilter('ALL');
    setHistoryDeviceFilter('ALL');
    setHistorySearchQuery('');
  };

  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      alert('Tidak ada data riwayat yang dapat diekspor.');
      return;
    }
    const headers = [
      'ID',
      'Nama Lengkap',
      'Email',
      'Posisi',
      'Status',
      'Keterangan',
      'Confidence Score',
      'Perangkat / User Agent',
      'Waktu Verifikasi',
    ];
    const rows = filteredHistory.map((item) => [
      `"${item.id}"`,
      `"${(item.full_name || '').replace(/"/g, '""')}"`,
      `"${(item.email || '').replace(/"/g, '""')}"`,
      `"${(item.job_position || item.jobPosition || '').replace(/"/g, '""')}"`,
      item.status === 'PASSED' ? 'Berhasil' : 'Verifikasi Gagal',
      `"${(item.failure_reason || (item.status === 'PASSED' ? 'Liveness tervalidasi' : '-')).replace(/"/g, '""')}"`,
      item.confidence_score ? `${Math.round(item.confidence_score * 100)}%` : '-',
      `"${(item.user_agent || 'Web Browser').replace(/"/g, '""')}"`,
      `"${new Date(item.created_at).toLocaleString('id-ID')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `veriface_riwayat_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  {failedCount}
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
                  title="Notifikasi"
                >
                  <Bell className="w-4 h-4" />
                  {!notificationsRead && unreadIds.size > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-[#9E2648] text-white text-[9px] font-bold absolute -top-1 -right-1 flex items-center justify-center animate-pulse shadow-sm">
                      {unreadIds.size > 9 ? '9+' : unreadIds.size}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel matching Figma Version 44 */}
                {showNotificationModal && (
                  <div className="absolute right-0 top-12 w-88 bg-white rounded-3xl p-5 shadow-2xl border border-[#F0E4E7] z-50 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                      <div>
                        <h4 className="text-sm font-bold text-[#2B0E17]">Notifikasi Real-time</h4>
                        <p className="text-[11px] text-[#7D5662]">
                          {notificationsList.length > 0
                            ? `${notificationsList.length} aktivitas verifikasi`
                            : 'Belum ada aktivitas'}
                        </p>
                      </div>
                      {unreadIds.size > 0 && (
                        <button
                          onClick={() => {
                            setNotificationsRead(true);
                            setUnreadIds(new Set());
                          }}
                          className="text-[11px] font-semibold text-[#9E2648] hover:underline"
                        >
                          Tandai dibaca
                        </button>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                      {notificationsList.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#7D5662]">
                          Belum ada aktivitas verifikasi baru.
                        </div>
                      ) : (
                        notificationsList.slice(0, 10).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setSelectedRecord(n.record);
                              setActiveTab('audit');
                              setShowNotificationModal(false);
                              setUnreadIds((prev) => {
                                const next = new Set(prev);
                                next.delete(n.id);
                                return next;
                              });
                            }}
                            className="flex items-start gap-3 p-2.5 rounded-2xl hover:bg-[#FAF4F6] transition-colors cursor-pointer relative group"
                          >
                            <div
                              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                n.type === 'passed'
                                  ? 'bg-[#EBF7EE] text-[#15803D]'
                                  : n.type === 'blocked'
                                  ? 'bg-[#FEE4E2] text-[#F04438]'
                                  : 'bg-[#FFF8E6] text-[#F79009]'
                              }`}
                            >
                              {n.type === 'passed' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : n.type === 'blocked' ? (
                                <ShieldCheck className="w-4 h-4" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-[#2B0E17] truncate">{n.name}</h5>
                              <p className="text-[11px] text-[#7D5662] truncate">{n.desc}</p>
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">{n.time}</span>
                            </div>
                            {n.isUnread && (
                              <span className="w-2 h-2 rounded-full bg-[#9E2648] shrink-0 mt-1.5 animate-pulse"></span>
                            )}
                          </div>
                        ))
                      )}
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
                    <p className="text-[11px] font-medium text-[#9E2648] mt-0.5">{totalVerifs} seluruh peserta</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EDF9F4] text-[#12B76A] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Berhasil lolos</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{passedCount.toLocaleString('id-ID')}</h3>
                    <p className="text-[11px] font-medium text-[#12B76A] mt-0.5">{passRate}% success rate</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FEE4E2] text-[#F04438] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Verifikasi gagal</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{failedCount.toLocaleString('id-ID')}</h3>
                    <p className="text-[11px] font-medium text-[#F04438] mt-0.5">{failRate}% dari total</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#9E2648] flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#7D5662]">Rata-rata akurasi</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-0.5">{avgConfidence}%</h3>
                    <p className="text-[11px] font-medium text-[#9E2648] mt-0.5">Model liveness ONNX</p>
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
                            strokeDashoffset={238.7 - (238.7 * failedCount) / (totalVerifs || 1)}
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
                        <span className="text-[#6B4B55]">Berhasil Lolos</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{passRate}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F04438]" />
                        <span className="text-[#6B4B55]">Verifikasi Gagal</span>
                      </div>
                      <span className="text-[#2B0E17] font-bold">{failRate}%</span>
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
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verifikasi gagal</span>
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
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-bold border border-[#FECDCA]">
                      &bull; Verifikasi gagal
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
                    <span>{failedCount} kasus terindikasi pelanggaran</span>
                  </div>
                </div>

                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-[24px] border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                    <p className="text-xs font-medium text-[#7D5662]">Antrean pelanggaran</p>
                    <h3 className="text-2xl font-black text-[#2B0E17] mt-1">{failedCount}</h3>
                    <p className="text-[11px] font-medium text-[#9E2648] mt-1">{failedCount} terdeteksi pelanggaran</p>
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
                              ) : (
                                <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold">
                                  &bull; Verifikasi gagal
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
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor laporan</span>
                </button>
              </div>

              {/* Filter Bar dengan Custom Dropdown Elegan */}
              <div className="bg-white p-4 rounded-2xl border border-[#F0E4E7] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Cari nama, ID, posisi, atau deteksi..."
                    className="w-full pl-10 pr-9 py-2 rounded-xl border border-gray-200 text-xs text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#9E2648] bg-[#FAF8F9]/50 transition-colors"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                      title="Hapus pencarian"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                  {/* Filter Status */}
                  <CustomDropdown<'ALL' | 'PASSED' | 'FAILED'>
                    value={historyStatusFilter}
                    onChange={setHistoryStatusFilter}
                    options={[
                      { value: 'ALL', label: 'Semua status' },
                      { value: 'PASSED', label: 'Berhasil' },
                      { value: 'FAILED', label: 'Verifikasi gagal' },
                    ]}
                    icon={<Filter className="w-3.5 h-3.5" />}
                  />

                  {/* Filter Tanggal */}
                  <CustomDropdown<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>
                    value={historyDateFilter}
                    onChange={setHistoryDateFilter}
                    options={[
                      { value: 'ALL', label: 'Semua tanggal' },
                      { value: 'TODAY', label: 'Hari ini' },
                      { value: '7DAYS', label: '7 hari terakhir' },
                      { value: '30DAYS', label: '30 hari terakhir' },
                    ]}
                    icon={<Calendar className="w-3.5 h-3.5" />}
                  />

                  {/* Filter Perangkat */}
                  <CustomDropdown<'ALL' | 'INTERNAL' | 'EXTERNAL'>
                    value={historyDeviceFilter}
                    onChange={setHistoryDeviceFilter}
                    options={[
                      { value: 'ALL', label: 'Semua perangkat' },
                      { value: 'INTERNAL', label: 'Webcam internal' },
                      { value: 'EXTERNAL', label: 'Eksternal USB' },
                    ]}
                    icon={<Laptop className="w-3.5 h-3.5" />}
                  />

                  {/* Reset Filters button if any active filter */}
                  {hasActiveHistoryFilter && (
                    <button
                      type="button"
                      onClick={resetHistoryFilters}
                      className="h-9 px-3 rounded-xl text-xs font-semibold text-[#9E2648] bg-[#FBECEF] hover:bg-[#F7D8E0] transition-colors flex items-center gap-1.5 border border-[#9E2648]/20 shrink-0"
                      title="Reset semua filter"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* List Aktivitas Terbaru */}
              <div className="bg-white p-6 rounded-[28px] border border-[#F0E4E7] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F7ECEF]">
                  <div>
                    <h3 className="text-base font-bold text-[#2B0E17]">Aktivitas terbaru</h3>
                    <p className="text-xs text-[#7D5662]">Riwayat verifikasi yang sesuai dengan filter</p>
                  </div>
                  <span className="text-xs font-bold text-[#9E2648] bg-[#FBECEF] px-2.5 py-1 rounded-full">
                    {filteredHistory.length} rekaman
                  </span>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#9E2648] flex items-center justify-center mb-3 border border-[#F2D7DE]">
                      <Filter className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[#2B0E17]">Tidak ada data yang sesuai</h4>
                    <p className="text-xs text-[#7D5662] mt-1 max-w-sm">
                      Tidak ditemukan riwayat verifikasi yang cocok dengan kriteria filter yang Anda pilih.
                    </p>
                    {hasActiveHistoryFilter && (
                      <button
                        onClick={resetHistoryFilters}
                        className="mt-4 px-4 py-2 rounded-xl bg-[#9E2648] text-white text-xs font-semibold hover:bg-[#851E3B] transition-colors flex items-center gap-2 shadow-sm shadow-[#9E2648]/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Semua Filter</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((item) => {
                      const isSuccess = item.status === 'PASSED';
                      const deviceLabel = item.user_agent?.includes('Windows')
                        ? 'Windows'
                        : item.user_agent?.includes('Mac')
                        ? 'macOS'
                        : item.user_agent?.includes('Android')
                        ? 'Android'
                        : item.user_agent?.includes('iPhone')
                        ? 'iOS'
                        : 'Webcam';

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedRecord(item);
                            setActiveTab('audit');
                          }}
                          className="p-4 rounded-2xl border border-[#F2E4E8] bg-white hover:bg-[#FDF9FA] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                              <p className="text-[11px] text-gray-400 font-mono">
                                {item.job_position || item.jobPosition || 'Pelamar'} • {deviceLabel}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                            <span className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })},{' '}
                              {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            <span className="text-xs text-[#7D5662] hidden md:inline-block max-w-[200px] truncate">
                              {isSuccess ? 'Liveness tervalidasi' : (item.failure_reason || 'Verifikasi tidak valid')}
                            </span>

                            {isSuccess ? (
                              <span className="px-3 py-1 rounded-full bg-[#EDF9F4] text-[#12B76A] text-xs font-semibold whitespace-nowrap">
                                &bull; Berhasil
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-[#FEE4E2] text-[#F04438] text-xs font-semibold whitespace-nowrap">
                                &bull; Verifikasi gagal
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
                )}
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
                      <span className="font-semibold font-mono text-[#2B0E17]">admin@veriface.id</span>
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

      {/* Real-time Floating Notification Toast */}
      {toastNotification && (
        <div
          onClick={() => {
            setSelectedRecord(toastNotification.record);
            setActiveTab('audit');
            setToastNotification(null);
          }}
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md border border-[#EEDDE2] p-4 rounded-3xl shadow-2xl cursor-pointer hover:scale-[1.02] transition-all animate-fade-in flex items-start gap-3.5"
        >
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
              toastNotification.type === 'passed'
                ? 'bg-[#EBF7EE] text-[#15803D]'
                : toastNotification.type === 'blocked'
                ? 'bg-[#FEE4E2] text-[#F04438]'
                : 'bg-[#FFF8E6] text-[#F79009]'
            }`}
          >
            {toastNotification.type === 'passed' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toastNotification.type === 'blocked' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9E2648]">
                Aktivitas Verifikasi Baru
              </span>
              <span className="text-[10px] text-gray-400 font-mono">{toastNotification.time}</span>
            </div>
            <h5 className="text-xs font-bold text-[#2B0E17] truncate mt-0.5">
              {toastNotification.name}
            </h5>
            <p className="text-[11px] text-[#7D5662] truncate">{toastNotification.desc}</p>
            <p className="text-[10px] text-[#9E2648] font-semibold mt-1">Klik untuk audit visual &rarr;</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
            className="text-gray-400 hover:text-gray-600 text-sm leading-none"
          >
            &times;
          </button>
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
