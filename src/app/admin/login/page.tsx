'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@veriface.id');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetMessage('Harap masukkan alamat email yang valid.');
      return;
    }
    setResetStatus('sending');
    setTimeout(() => {
      setResetStatus('success');
      setResetMessage(`Tautan pemulihan kata sandi telah dikirim ke ${resetEmail}. Silakan periksa kotak masuk atau spam Anda.`);
    }, 800);
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

    // Accept both demo and realistic inputs
    if (
      email.includes('@') &&
      password.length >= 4
    ) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('admin_auth', 'true');
        sessionStorage.setItem('admin_email', email);
      }
      router.push('/admin/dashboard');
    } else {
      setError('Email atau kata sandi tidak valid.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F3F4] text-[#2D151E] flex flex-col justify-between p-6 sm:p-10 font-sans relative">
      {/* Top Header Bar matching Figma */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand Identity */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl bg-[#8A233E] text-white flex items-center justify-center shadow-md shadow-[#8A233E]/25 group-hover:scale-105 transition-transform">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#2B0E17]">Veriface</h2>
            <p className="text-[10px] tracking-widest uppercase font-semibold text-[#8C3A50]">Identity System</p>
          </div>
        </Link>

        {/* Right: Back to Applicant Portal */}
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#FAF4F6] text-[#8C3A50] hover:text-[#2B0E17] text-xs font-semibold shadow-sm border border-[#EEDDE2] transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Portal pelamar</span>
        </Link>
      </header>

      {/* Center White Login Card matching Figma */}
      <main className="w-full flex items-center justify-center py-8">
        <div className="w-full max-w-lg bg-white p-8 sm:p-10 rounded-[32px] border border-[#F0E4E7] shadow-[0_8px_40px_rgba(0,0,0,0.03)]">
          {/* Card Header */}
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

          {error && (
            <div className="p-3.5 mb-5 rounded-2xl bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email Administrator */}
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
                  placeholder="admin@veriface.id"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm text-[#2B0E17] placeholder:text-gray-400 focus:outline-none focus:border-[#8A233E] focus:ring-1 focus:ring-[#8A233E] transition-all"
                />
              </div>
            </div>

            {/* Input Kata Sandi */}
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

            {/* Remember Me Checkbox (Replaced 7 hari, 2FA removed) */}
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

            {/* Submit Button */}
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

      {/* Footer copyright */}
      <footer className="text-center text-xs text-[#721A31]">
        Copyright &copy; {new Date().getFullYear()}, Key Pick Key Run, All Rights Reserved
      </footer>

      {/* Forgot Password Modal Dialog */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 shadow-2xl border border-[#F0E4E7] relative">
            {/* Close button */}
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
                        placeholder="admin@verigate.id"
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
    </div>
  );
}
