'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ScanFace,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  KeyRound,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Password reset completion modal state (saat membuka tautan reset dari email)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [supabaseRecoveryActive, setSupabaseRecoveryActive] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [completeStatus, setCompleteStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('resetToken');
    if (tokenParam) {
      setResetToken(tokenParam);
      return;
    }

    // Dukung juga tautan recovery bawaan Supabase Auth (#access_token=...&type=recovery atau ?code=...)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashType = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const codeParam = searchParams.get('code');

    if (isSupabaseConfigured && supabase) {
      if (hashType === 'recovery' && accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error: sessErr }) => {
            if (!sessErr) {
              setSupabaseRecoveryActive(true);
            }
          });
      } else if (codeParam) {
        supabase.auth.exchangeCodeForSession(codeParam).then(({ data, error: codeErr }) => {
          if (!codeErr && data?.session) {
            setSupabaseRecoveryActive(true);
          }
        });
      }
    }
  }, []);

  const handleCompleteResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleteMessage(null);

    if (newPassword.length < 8) {
      setCompleteStatus('error');
      setCompleteMessage('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setCompleteStatus('error');
      setCompleteMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setCompleteStatus('saving');

    try {
      if (resetToken) {
        const res = await fetch('/api/admin/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetToken, newPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setCompleteStatus('error');
          setCompleteMessage(data.message || 'Gagal memperbarui kata sandi.');
          return;
        }
        if (data.email) {
          setEmail(data.email);
        }
      } else if (supabaseRecoveryActive && supabase) {
        const { data: userData, error: updateErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateErr) {
          setCompleteStatus('error');
          setCompleteMessage(updateErr.message || 'Gagal memperbarui kata sandi.');
          return;
        }
        if (userData?.user?.email) {
          setEmail(userData.user.email);
        }
      }

      setResetToken(null);
      setSupabaseRecoveryActive(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setCompleteStatus('idle');
      setError(null);
      setSuccessNotice('Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.');

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin/login');
      }
    } catch {
      setCompleteStatus('error');
      setCompleteMessage('Gagal menghubungi server saat menyimpan kata sandi baru.');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetMessage('Harap masukkan alamat email yang valid.');
      return;
    }
    setResetStatus('sending');
    setResetMessage('');

    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setResetStatus('success');
        setResetMessage(
          data.message || `Tautan pemulihan kata sandi telah dikirim ke ${resetEmail}.`
        );
      } else {
        setResetStatus('error');
        setResetMessage(
          data.message || 'Gagal mengirim tautan pemulihan kata sandi.'
        );
      }
    } catch {
      setResetStatus('error');
      setResetMessage('Gagal menghubungi server pemulihan kata sandi.');
    }
  };

  const handleOpenForgotPassword = () => {
    setResetEmail(email || '');
    setResetStatus('idle');
    setResetMessage(null);
    setIsForgotPasswordOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(data.message || 'Email atau kata sandi administrator tidak valid.');
        setIsLoading(false);
        return;
      }

      const params =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const nextParam = params?.get('next') || '';
      const safeNext =
        nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? nextParam
          : '/admin/dashboard';

      router.push(safeNext);
      router.refresh();
    } catch {
      setError('Gagal menghubungi server autentikasi.');
      setIsLoading(false);
    }
  };

  const isResetModalVisible = Boolean(resetToken) || supabaseRecoveryActive;

  return (
    <div className="min-h-screen bg-[#F8F3F4] text-[#2D151E] flex flex-col justify-between p-6 sm:p-10 font-sans relative">
      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl bg-[#8A233E] text-white flex items-center justify-center shadow-md shadow-[#8A233E]/25 group-hover:scale-105 transition-transform">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#2B0E17]">Veriface</h2>
            <p className="text-[10px] tracking-widest uppercase font-semibold text-[#8C3A50]">Identity System</p>
          </div>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#FAF4F6] text-[#8C3A50] hover:text-[#2B0E17] text-xs font-semibold shadow-sm border border-[#EEDDE2] transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Portal pelamar</span>
        </Link>
      </header>

      {/* Center White Login Card */}
      <main className="w-full flex items-center justify-center py-8">
        <div className="w-full max-w-lg bg-white p-8 sm:p-10 rounded-[32px] border border-[#F0E4E7] shadow-[0_8px_40px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#8A233E] flex items-center justify-center shrink-0 border border-[#F2D7DE]">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#2B0E17] tracking-tight">
                Masuk ke Portal Admin
              </h1>
              <p className="text-xs sm:text-sm text-[#7D5662] mt-0.5">
                Gunakan kredensial host atau auditor Veriface Anda.
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-[#F7ECEF] mb-6" />

          {successNotice && (
            <div className="p-3.5 mb-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 mb-5 rounded-2xl bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#6B4B55] mb-2">
                Email administrator
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#8A233E] focus:ring-1 focus:ring-[#8A233E] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#6B4B55]">
                  Kata sandi
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgotPassword}
                  className="text-xs font-semibold text-[#8A233E] hover:underline"
                >
                  Lupa kata sandi?
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#8A233E] focus:ring-1 focus:ring-[#8A233E] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="rememberMeCheckbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-[#8A233E] rounded cursor-pointer"
              />
              <label
                htmlFor="rememberMeCheckbox"
                className="text-xs text-[#6B4B55] font-medium cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-bold text-xs sm:text-sm bg-[#8A233E] hover:bg-[#721A31] text-white shadow-md shadow-[#8A233E]/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 mt-4"
            >
              <span>{isLoading ? 'Memproses...' : 'Masuk ke Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="text-center text-xs text-[#721A31]">
        Copyright &copy; {new Date().getFullYear()}, Veriface, All Rights Reserved
      </footer>

      {/* Forgot Password Modal Dialog */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 shadow-2xl border border-[#F0E4E7] relative">
            <button
              onClick={() => setIsForgotPasswordOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {resetStatus === 'success' ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[#2B0E17] mb-2">
                  Tautan Pemulihan Terkirim
                </h3>
                <p className="text-xs sm:text-sm text-[#6B4B55] leading-relaxed mb-6">
                  {resetMessage}
                </p>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#8A233E] hover:bg-[#721A31] text-white shadow-md transition-all active:scale-98"
                >
                  Kembali ke Login
                </button>
              </div>
            ) : (
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#8A233E] flex items-center justify-center mb-4 border border-[#F2D7DE]">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#2B0E17]">
                  Atur Ulang Kata Sandi
                </h3>
                <p className="text-xs sm:text-sm text-[#7D5662] mt-1 mb-5">
                  Masukkan email administrator yang terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
                </p>

                {resetMessage && (
                  <div className="p-3 mb-4 rounded-xl bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resetMessage}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B4B55] mb-2">
                      Email administrator
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="nama@gmail.com"
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#8A233E] focus:ring-1 focus:ring-[#8A233E] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(false)}
                      className="w-1/2 py-3.5 rounded-2xl font-semibold text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={resetStatus === 'sending'}
                      className="w-1/2 py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#8A233E] hover:bg-[#721A31] text-white shadow-md transition-all active:scale-98 disabled:opacity-50"
                    >
                      {resetStatus === 'sending' ? 'Mengirim...' : 'Kirim Tautan'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set New Password Modal Dialog (saat pengguna mengklik tautan reset di email) */}
      {isResetModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 shadow-2xl border border-[#F0E4E7] relative">
            <button
              type="button"
              onClick={() => {
                setResetToken(null);
                setSupabaseRecoveryActive(false);
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, '', '/admin/login');
                }
              }}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#8A233E] flex items-center justify-center mb-4 border border-[#F2D7DE]">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#2B0E17]">
              Buat Kata Sandi Baru
            </h3>
            <p className="text-xs sm:text-sm text-[#7D5662] mt-1 mb-5">
              Masukkan kata sandi baru minimal 8 karakter untuk akun administrator Anda.
            </p>

            {completeMessage && (
              <div className="p-3 mb-4 rounded-xl bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{completeMessage}</span>
              </div>
            )}

            <form onSubmit={handleCompleteResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B4B55] mb-1.5">
                  Kata sandi baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-11 pr-11 py-3 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#8A233E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B4B55] mb-1.5">
                  Ulangi kata sandi baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Konfirmasi kata sandi baru"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] focus:outline-none focus:border-[#8A233E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={completeStatus === 'saving'}
                className="w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#8A233E] hover:bg-[#721A31] text-white shadow-md transition-all disabled:opacity-50"
              >
                {completeStatus === 'saving' ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
