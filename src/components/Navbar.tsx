import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, Sparkles } from 'lucide-react';

interface NavbarProps {
  showAdminLink?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ showAdminLink = true }) => {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/[0.08] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-rose-950/60 border border-rose-400/30 group-hover:scale-105 transition-transform bg-gradient-to-br from-rose-500/20 to-maroon-900/60 flex items-center justify-center p-1">
            <Image
              src="/logo.svg"
              alt="Identity Gateway Logo"
              width={36}
              height={36}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
                Identity Gateway
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                3D Liveness
              </span>
            </div>
            <p className="text-[11px] text-rose-200/60 hidden sm:block">
              Pre-Screening Biometrik & Liveness Wawancara Online
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-rose-200/70">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">Client-Side Edge AI</span>
          </div>

          {showAdminLink && (
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-100 bg-gradient-to-r from-rose-900/60 to-maroon-900/80 hover:from-rose-800/80 hover:to-maroon-800 border border-rose-500/30 hover:border-rose-400/60 transition-all shadow-md shadow-rose-950/40"
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
