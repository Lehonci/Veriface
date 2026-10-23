'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  Video,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Link as LinkIcon,
  Lock,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ZoomSetting } from '@/types';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [zoomUrl, setZoomUrl] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [history, setHistory] = useState<ZoomSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated]);

  async function fetchSettings() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings && data.settings.length > 0) {
        setHistory(data.settings);
        const active = data.settings.find((s: ZoomSetting) => s.is_active) || data.settings[0];
        setMeetingTitle(active.meeting_title);
        setZoomUrl(active.zoom_url);
        setPasscode(active.passcode || '');
        setIsActive(active.is_active);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle,
          zoomUrl,
          passcode,
          isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        fetchSettings();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(data.message || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: unknown) {
      setErrorMessage('Terjadi kesalahan koneksi.');
    } finally {
      setIsSaving(false);
    }
  }

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
    <div className="min-h-screen flex flex-col bg-background text-foreground bg-ambient-maroon">
      <Navbar showAdminLink={false} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-rose-300 hover:text-rose-100 transition-colors px-3 py-1.5 rounded-xl glass-panel-subtle border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard Audit</span>
          </Link>

          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-300">
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>Manajemen Link Zoom Dinamis</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pengaturan Link Zoom Meeting
          </h1>
          <p className="text-xs sm:text-sm text-rose-200/70 mt-1">
            Konfigurasikan URL dan kredensial Zoom wawancara kerja yang akan diberikan ke pelamar yang lulus verifikasi.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs sm:text-sm flex items-center gap-3 animate-fade-in shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Link Zoom aktif berhasil diperbarui dan siap digunakan oleh pelamar berikutnya.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs sm:text-sm flex items-center gap-3 animate-fade-in shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-white/[0.08] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <form onSubmit={handleSave} className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-semibold text-rose-200 mb-1.5">
                  Judul / Sesi Wawancara Kerja <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="cth. Wawancara Kerja Batch 1 - Software Engineering"
                    className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-200 mb-1.5">
                  URL Zoom Meeting Aktif <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    required
                    value={zoomUrl}
                    onChange={(e) => setZoomUrl(e.target.value)}
                    placeholder="https://us05web.zoom.us/j/81234567890?pwd=..."
                    className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] text-rose-300/50 mt-1">
                  Pastikan link mencakup parameter meeting ID dan password hash (pwd) agar pelamar langsung masuk ke Waiting Room.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-200 mb-1.5">
                  Passcode Meeting (Opsional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="cth. TECH2026"
                    className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-black/40 border border-white/[0.06]">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-rose-200 cursor-pointer">
                  Jadikan link ini sebagai <strong>Tujuan Utama Aktif</strong> saat ini
                </label>
              </div>

              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-rose-600 to-maroon-600 hover:from-rose-500 hover:to-maroon-500 text-white shadow-lg shadow-rose-950/80 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Link'}</span>
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] shadow-xl">
              <div className="flex items-center gap-2 mb-2 text-rose-300">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Cara Kerja Otomasi
                </h4>
              </div>
              <p className="text-xs text-rose-200/70 leading-relaxed">
                Saat pelamar menyelesaikan verifikasi 3D Liveness di browser mereka, backend API secara otomatis membaca konfigurasi aktif di atas dan menyematkan link Zoom ini ke dalam respon kelulusan.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] shadow-xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Riwayat Link Meeting</span>
              </h4>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      h.is_active
                        ? 'bg-rose-950/60 border-rose-500/40 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.05] text-rose-200/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate">{h.meeting_title}</span>
                      {h.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          AKTIF
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-rose-300/80 truncate">{h.zoom_url}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
