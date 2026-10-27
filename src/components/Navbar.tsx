import React from 'react';
import Link from 'next/link';
import { ArrowRight, ScanFace } from 'lucide-react';

interface NavbarProps {
  showAdminLink?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ showAdminLink = true }) => {
  return (
    <header className="w-full flex justify-center pt-8 pb-3 px-4 relative z-30">
      <nav className="navbar-glass px-6 py-2.5 rounded-full flex items-center justify-between max-w-lg w-full shadow-2xl">
        {/* Left: Brand Identity (VeriGate with ScanFace Icon) */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white/90 group-hover:scale-105 transition-transform shadow-inner">
            <ScanFace className="w-4 h-4" />
          </div>
          <span className="font-semibold text-base sm:text-lg tracking-tight text-white">
            Veriface
          </span>
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center">
          {showAdminLink && (
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-rose-950 bg-white hover:bg-rose-50 transition-all shadow-md active:scale-95"
            >
              <span>Portal admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};
