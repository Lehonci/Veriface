import React from 'react';
import { User, Mail, Briefcase, Sparkles, CheckCircle2 } from 'lucide-react';
import { ApplicantIdentity } from '@/types';

interface IdentityFormProps {
  identity: ApplicantIdentity;
  onChange: (updated: Partial<ApplicantIdentity>) => void;
  disabled?: boolean;
}

export const IdentityForm: React.FC<IdentityFormProps> = ({
  identity,
  onChange,
  disabled = false,
}) => {
  const isComplete = Boolean(
    identity.fullName.trim() && identity.email.trim() && identity.jobPosition.trim()
  );

  return (
    <div className="w-full glass-panel p-6 sm:p-7 rounded-3xl border border-white/[0.08] shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-rose-500/25">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between gap-4 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-maroon-900/40 border border-rose-500/30 flex items-center justify-center text-rose-300 shadow-md shadow-rose-950/40">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Data Identitas Pelamar</span>
              {isComplete && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-fade-in" />
              )}
            </h3>
            <p className="text-xs text-rose-200/60">
              Kredensial wajib untuk validasi sesi wawancara online
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 hidden sm:inline-block">
          Langkah 1 dari 2
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        <div>
          <label className="block text-xs font-semibold text-rose-200/90 mb-1.5">
            Nama Lengkap <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="cth. Budi Santoso"
              className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-rose-300/30 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-rose-200/90 mb-1.5">
            Email Pelamar <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              disabled={disabled}
              value={identity.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="cth. budi.santoso@email.com"
              className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-rose-300/30 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-rose-200/90 mb-1.5">
            Posisi / Kode Undangan <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400/60">
              <Briefcase className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.jobPosition}
              onChange={(e) => onChange({ jobPosition: e.target.value })}
              placeholder="cth. Frontend Dev / INV-01"
              className="glass-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm placeholder:text-rose-300/30 disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
