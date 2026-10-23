'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { VerificationRecord } from '@/types';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Layers,
  Settings,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  UserCheck,
  UserX,
  LogOut,
  Maximize2,
  Lock,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<VerificationRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [admittedList, setAdmittedList] = useState<Record<string, 'ADMITTED' | 'REMOVED'>>({});
  const [modalSnapshot, setModalSnapshot] = useState<string | null>(null);

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

  // Fetch initial data
  const fetchVerifications = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/verifications?status=${statusFilter}`;
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
  }, [searchQuery, selectedRecord, statusFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVerifications();
    }
  }, [isAuthenticated, fetchVerifications]);

  // Supabase Realtime Subscription (WebSocket)
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('verifications-realtime-channel')
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

  // Compute KPI Stats
  const totalVerifs = verifications.length;
  const passedCount = verifications.filter((v) => v.status === 'PASSED').length;
  const spoofCount = verifications.filter((v) => v.status === 'SPOOF_FAILED').length;
  const virtualCamCount = verifications.filter((v) => v.status === 'VIRTUAL_CAM_BLOCKED').length;
  const passRate = totalVerifs > 0 ? Math.round((passedCount / totalVerifs) * 100) : 0;

  const chartData = [
    { name: 'Lolos (3D Live)', value: passedCount, color: '#10B981' },
    { name: 'Spoof Terdeteksi', value: spoofCount, color: '#EF4444' },
    { name: 'Virtual Cam Diblokir', value: virtualCamCount, color: '#F59E0B' },
  ].filter((d) => d.value > 0);

  const handleDecision = (id: string, decision: 'ADMITTED' | 'REMOVED') => {
    setAdmittedList((prev) => ({ ...prev, [id]: decision }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ambient-maroon">
        <div className="flex flex-col items-center gap-3 p-8 glass-panel rounded-3xl border border-white/10">
          <Lock className="w-8 h-8 text-rose-400 animate-pulse" />
          <p className="text-xs text-rose-200">Memeriksa autentikasi administrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-ambient-maroon text-foreground relative overflow-x-hidden">
      {/* Background Ambient Glowing Blobs for True Glassmorphism Refraction */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[25%] w-[50vw] h-[50vw] rounded-full bg-rose-600/18 blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-maroon-700/22 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-rose-900/25 blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar showAdminLink={false} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Dashboard Audit Visual Host
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-rose-200/70 mt-1">
              Pengawasan biometrik real-time & matching foto pelamar di Waiting Room Zoom
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-200 transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 text-rose-400" />
              <span>Pengaturan Zoom</span>
            </Link>

            <button
              onClick={fetchVerifications}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Verifications */}
          <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-200/60 font-medium">Total Permintaan</p>
              <h3 className="text-2xl font-black text-white mt-1">{totalVerifs}</h3>
              <p className="text-[11px] text-rose-300/50 mt-1">Sesi verifikasi pelamar</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-md">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Pass Rate */}
          <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-200/60 font-medium">Tingkat Kelulusan</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{passRate}%</h3>
              <p className="text-[11px] text-emerald-300/60 mt-1">{passedCount} terverifikasi 3D asli</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Spoofing Detected */}
          <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-200/60 font-medium">Spoofing Terdeteksi</p>
              <h3 className="text-2xl font-black text-rose-400 mt-1">{spoofCount}</h3>
              <p className="text-[11px] text-rose-300/50 mt-1">Foto 2D / Layar terblokir</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Virtual Cam Blocked */}
          <div className="glass-panel p-5 rounded-3xl border border-white/[0.08] flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-200/60 font-medium">Virtual Cam Diblokir</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">{virtualCamCount}</h3>
              <p className="text-[11px] text-amber-300/60 mt-1">OBS / ManyCam / Fake Cam</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Real-time Visual Inspection Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Verification Logs & Filter (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Filter Bar */}
            <div className="glass-panel p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-400/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, email, atau posisi pelamar..."
                  className="glass-input w-full pl-9 pr-3.5 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="glass-input px-3 py-2 rounded-xl text-xs bg-maroon-950 text-white w-full sm:w-auto"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PASSED">Lolos (3D Live)</option>
                  <option value="SPOOF_FAILED">Spoofing Terdeteksi</option>
                  <option value="VIRTUAL_CAM_BLOCKED">Virtual Cam</option>
                </select>
              </div>
            </div>

            {/* List of Recent Verifications */}
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {verifications.length === 0 ? (
                <div className="glass-panel p-8 rounded-2xl text-center text-rose-200/50 text-xs">
                  Tidak ada data verifikasi yang cocok.
                </div>
              ) : (
                verifications.map((item) => {
                  const isSelected = selectedRecord?.id === item.id;
                  const decision = admittedList[item.id];

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedRecord(item)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'glass-panel-active border-rose-500/60 shadow-lg shadow-rose-950/80 scale-[1.01]'
                          : 'glass-panel hover:bg-white/[0.04] border-white/[0.06]'
                      }`}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.snapshot_url ? (
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-black/60 shadow-sm">
                            <Image
                              src={item.snapshot_url}
                              alt={item.full_name}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-900/60 to-maroon-950 border border-rose-800/40 flex items-center justify-center text-rose-300 font-bold text-sm shrink-0 shadow-sm">
                            {item.full_name.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white truncate">
                              {item.full_name}
                            </h4>
                            {decision && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  decision === 'ADMITTED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                              >
                                {decision}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-rose-200/70 truncate">{item.job_position}</p>
                          <div className="flex items-center gap-3 text-[11px] text-rose-300/50 mt-1 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.created_at).toLocaleTimeString('id-ID')}
                            </span>
                            {item.depth_variance && (
                              <span>σ²: {Number(item.depth_variance).toFixed(5)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badge */}
                      <div className="shrink-0 text-right">
                        {item.status === 'PASSED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs font-semibold shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Lolos 3D</span>
                          </span>
                        ) : item.status === 'SPOOF_FAILED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40 text-xs font-semibold shadow-sm">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Spoofing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-sm">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Virtual Cam</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Visual Matching & Candidate Inspection Panel (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedRecord ? (
              <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] space-y-5 sticky top-24 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wider">
                    <Eye className="w-4 h-4 text-rose-400" />
                    <span>Panel Inspeksi Visual Biometrik</span>
                  </div>
                  <span className="text-[11px] font-mono text-rose-300/50">
                    ID: {selectedRecord.id.substring(0, 10)}
                  </span>
                </div>

                {/* Candidate Photo Snapshot (Matching Visual) */}
                <div className="flex flex-col items-center">
                  <div
                    onClick={() => selectedRecord.snapshot_url && setModalSnapshot(selectedRecord.snapshot_url)}
                    className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-rose-500/40 shadow-xl bg-black/80 flex items-center justify-center group cursor-pointer"
                  >
                    {selectedRecord.snapshot_url ? (
                      <Image
                        src={selectedRecord.snapshot_url}
                        alt={selectedRecord.full_name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="text-center p-4 text-rose-300/50 text-xs">
                        Foto snapshot tidak tersedia (Lolos langsung tanpa anomali)
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-[10px] text-white font-mono">Snapshot Audit</span>
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>

                  <h3 className="text-base font-extrabold text-white mt-3">
                    {selectedRecord.full_name}
                  </h3>
                  <p className="text-xs text-rose-300/80">
                    {selectedRecord.job_position} &middot;{' '}
                    <span className="font-mono text-rose-200/60">{selectedRecord.email}</span>
                  </p>
                </div>

                {/* Biometric Telemetry Breakdown */}
                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-black/40 border border-white/[0.06] text-xs">
                  <div>
                    <span className="text-rose-300/60 text-[11px] block">3D Z-Depth Variance</span>
                    <span className="font-mono font-bold text-white">
                      {selectedRecord.depth_variance
                        ? Number(selectedRecord.depth_variance).toFixed(6)
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-300/60 text-[11px] block">Luminance Ruangan</span>
                    <span className="font-mono font-bold text-white">
                      {selectedRecord.luminance_score
                        ? `${selectedRecord.luminance_score} Lux`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-300/60 text-[11px] block">Confidence Level</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {selectedRecord.confidence_score
                        ? `${Math.round(Number(selectedRecord.confidence_score) * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-300/60 text-[11px] block">Alamat IP Klien</span>
                    <span className="font-mono text-[11px] text-rose-200/80 truncate block">
                      {selectedRecord.ip_address || '127.0.0.1'}
                    </span>
                  </div>
                </div>

                {/* Failure Reason if failed */}
                {selectedRecord.failure_reason && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/40 text-xs text-rose-200">
                    <span className="font-bold text-rose-400 block mb-0.5">Catatan Anomali:</span>
                    {selectedRecord.failure_reason}
                  </div>
                )}

                {/* Host Action Buttons for Waiting Room Zoom Matching */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-rose-300/70 mb-2 font-medium">
                    Cocokkan dengan nama di Waiting Room Zoom:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDecision(selectedRecord.id, 'ADMITTED')}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-950/50"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Admit (Izinkan Masuk)</span>
                    </button>

                    <button
                      onClick={() => handleDecision(selectedRecord.id, 'REMOVED')}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-800/90 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-rose-950/50"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Remove (Keluarkan)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-8 rounded-3xl border border-white/[0.08] text-center text-rose-200/50 text-xs">
                Pilih salah satu baris log verifikasi untuk menginspeksi foto snapshot dan metrik biometrik.
              </div>
            )}

            {/* Quick Chart Analytics */}
            {chartData.length > 0 && (
              <div className="glass-panel p-5 rounded-3xl border border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">
                  Distribusi Hasil Verifikasi
                </h4>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#16080C',
                          borderColor: '#701235',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Snapshot Zoom Modal */}
        {modalSnapshot && (
          <div
            onClick={() => setModalSnapshot(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-lg w-full aspect-square rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
              <Image
                src={modalSnapshot}
                alt="Enlarged Snapshot"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
