import React from 'react';
import Link from 'next/link';
import { ShieldCheck, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  showAdminLink?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ showAdminLink = true }) => {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/[0.08] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-maroon-700 flex items-center justify-center shadow-lg shadow-rose-900/40 border border-rose-400/30 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
                Identity Gateway
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Edge AI
              </span>
            </div>
            <p className="text-xs text-rose-200/60 hidden sm:block">
              Pre-Screening Biometrik & Liveness Wawancara Online
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-rose-200/70">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Client-Side Engine Active</span>
          </div>

          {showAdminLink && (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-500/50 transition-all shadow-sm"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-rose-400" />
              <span>Dashboard Host</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
