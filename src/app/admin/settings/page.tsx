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
      if (data.success && data.settings) {
        setHistory(data.settings);
        const active = data.settings.find((s: ZoomSetting) => s.is_active);
        if (active) {
          setMeetingTitle(active.meeting_title);
          setZoomUrl(active.zoom_url);
          setPasscode(active.passcode || '');
          setIsActive(true);
        }
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
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(data.message || 'Gagal menyimpan konfigurasi Zoom.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setErrorMessage('Terjadi kesalahan koneksi.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ambient-maroon">
        <div className="flex flex-col items-center gap-3 p-8 glass-panel rounded-3xl border border-[#7B2E46]/15">
          <Lock className="w-8 h-8 text-[#7B2E46] animate-pulse" />
          <p className="text-xs text-[#7A4B58] font-medium">Memeriksa autentikasi administrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-ambient-maroon text-foreground relative overflow-x-hidden selection:bg-[#7B2E46]/20 selection:text-[#7B2E46]">
      {/* Background Ambient Glowing Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[25%] w-[50vw] h-[50vw] rounded-full bg-[#EBD8C7]/50 blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[#F5E2D3]/40 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-[#DFCEBD]/50 blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar showAdminLink={false} />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#7B2E46] hover:text-[#541B2B] transition-colors px-3 py-1.5 rounded-xl glass-panel-subtle border border-[#7B2E46]/15"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Audit</span>
            </Link>

            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#7B2E46]/10 border border-[#7B2E46]/20 text-xs font-semibold text-[#7B2E46]">
              <Video className="w-3.5 h-3.5 text-[#7B2E46]" />
              <span>Manajemen Link Zoom Dinamis</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2B0E17] tracking-tight">
              Pengaturan Link Zoom Meeting
            </h1>
            <p className="text-xs sm:text-sm text-[#6E4250] mt-1 font-medium">
              Konfigurasikan URL dan kredensial Zoom wawancara kerja yang akan diberikan ke pelamar yang lulus verifikasi.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 animate-fade-in shadow-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Link Zoom aktif berhasil diperbarui dan siap digunakan oleh pelamar berikutnya.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm flex items-center gap-3 animate-fade-in shadow-md">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-[#7B2E46]/12 shadow-xl relative overflow-hidden">
              <form onSubmit={handleSave} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs font-semibold text-[#4A1A28] mb-1.5">
                    Judul / Sesi Wawancara Kerja <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7B2E46]/60">
                      <FileText className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="cth. Wawancara Kerja Batch 1 - Software Engineering"
                      className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-[#9D7682]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A1A28] mb-1.5">
                    URL Zoom Meeting Aktif <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7B2E46]/60">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      required
                      value={zoomUrl}
                      onChange={(e) => setZoomUrl(e.target.value)}
                      placeholder="https://us05web.zoom.us/j/81234567890?pwd=..."
                      className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono placeholder:text-[#9D7682]"
                    />
                  </div>
                  <p className="text-[11px] text-[#7A4B58] mt-1 font-medium">
                    Pastikan link mencakup parameter meeting ID dan password hash (pwd) agar pelamar langsung masuk ke Waiting Room.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A1A28] mb-1.5">
                    Passcode Meeting (Opsional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7B2E46]/60">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="cth. TECH2026"
                      className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-[#9D7682]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7EFE8] border border-[#7B2E46]/15">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#7B2E46] rounded cursor-pointer"
                  />
                  <label htmlFor="isActiveToggle" className="text-xs text-[#2B0E17] font-medium cursor-pointer">
                    Jadikan link ini sebagai <strong>Tujuan Utama Aktif</strong> saat ini
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || isLoading}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#7B2E46] hover:bg-[#682238] text-white shadow-lg shadow-[#7B2E46]/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Link'}</span>
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="glass-panel p-6 rounded-3xl border border-[#7B2E46]/12 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-[#7B2E46]">
                  <Sparkles className="w-4 h-4 text-[#7B2E46]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Cara Kerja Otomasi
                  </h4>
                </div>
                <p className="text-xs text-[#6E4250] leading-relaxed font-medium">
                  Saat pelamar menyelesaikan verifikasi 3D Liveness di browser mereka, backend API secara otomatis membaca konfigurasi aktif di atas dan menyematkan link Zoom ini ke dalam respon kelulusan.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-3xl border border-[#7B2E46]/12 shadow-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7B2E46] mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#7B2E46]" />
                  <span>Riwayat Link Meeting</span>
                </h4>

                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        h.is_active
                          ? 'bg-[#F7EFE8] border-[#7B2E46]/30 text-[#2B0E17] shadow-sm'
                          : 'bg-white/60 border-[#7B2E46]/10 text-[#7A4B58]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold truncate">{h.meeting_title}</span>
                        {h.is_active && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                            AKTIF
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-[#7B2E46] truncate">{h.zoom_url}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
