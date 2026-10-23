'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (
      (email === 'admin@company.com' && password === 'adminpassword123') ||
      (email && password.length >= 6)
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-ambient-maroon relative overflow-hidden">
      {/* Background Ambient Glowing Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[25%] w-[45vw] h-[45vw] rounded-full bg-rose-600/22 blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[10%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-maroon-700/25 blur-[130px]" />
      </div>

      <div className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-3xl border border-white/[0.12] shadow-2xl relative z-10 overflow-hidden">
        <div className="text-center mb-8">
          <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden shadow-xl shadow-rose-950/80 border border-rose-400/40 mb-4 bg-gradient-to-br from-rose-500/20 to-maroon-900/60 flex items-center justify-center p-2">
            <Image
              src="/logo.svg"
              alt="Identity Gateway Logo"
              width={48}
              height={48}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-semibold mb-2">
            <Sparkles className="w-3 h-3 text-rose-400" />
            <span>Host Portal Access</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Host & Admin Login</h2>
          <p className="text-xs text-rose-200/60 mt-1">
            Masuk untuk mengakses Dashboard Audit Visual & Pengaturan Zoom
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-rose-200/80 mb-1.5">
              Email Administrator
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-rose-300/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-rose-200/80 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-rose-300/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-xs sm:text-sm uppercase tracking-wider bg-gradient-to-r from-rose-600 to-maroon-600 hover:from-rose-500 hover:to-maroon-500 text-white shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            <span>{isLoading ? 'Memproses...' : 'Masuk Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
          <p className="text-[11px] text-rose-300/40">
            Demo Credentials: <code className="text-rose-200">admin@company.com</code> / <code className="text-rose-200">adminpassword123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
