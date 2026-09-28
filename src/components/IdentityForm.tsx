import React from 'react';
import { User, Mail, Briefcase, Sparkles } from 'lucide-react';
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
  return (
    <div className="w-full glass-panel p-6 rounded-3xl border border-white/[0.08] shadow-2xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Data Identitas Pelamar
          </h3>
          <p className="text-xs text-rose-200/60">
            Kredensial wajib untuk validasi sesi wawancara online
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-rose-200/80 mb-1.5">
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
          <label className="block text-xs font-medium text-rose-200/80 mb-1.5">
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
          <label className="block text-xs font-medium text-rose-200/80 mb-1.5">
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
