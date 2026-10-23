import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  showAdminLink?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ showAdminLink = true }) => {
  return (
    <header className="w-full flex justify-center pt-6 pb-2 px-4 relative z-30">
      <nav className="glass-panel px-5 py-2.5 rounded-full border border-white/15 flex items-center justify-between max-w-2xl w-full shadow-2xl backdrop-blur-2xl bg-white/[0.04]">
        {/* Left: Brand Identity */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-md shadow-rose-950/80 border border-rose-400/30 group-hover:scale-105 transition-transform bg-gradient-to-br from-rose-500/20 to-maroon-900/60 flex items-center justify-center p-1">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={28}
              height={28}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
              Identity Gateway
            </span>
            <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 hidden sm:inline-block">
              Viskom
            </span>
          </div>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-rose-200/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Edge AI</span>
          </div>

          {showAdminLink && (
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-rose-950 bg-white hover:bg-rose-100 transition-all shadow-md shadow-white/10 active:scale-95"
            >
              <span>Dashboard Host</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};
