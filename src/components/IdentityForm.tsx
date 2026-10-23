import React from 'react';
import { User, Mail, Briefcase, CheckCircle2, ArrowRight } from 'lucide-react';
import { ApplicantIdentity } from '@/types';

interface IdentityFormProps {
  identity: ApplicantIdentity;
  onChange: (updated: Partial<ApplicantIdentity>) => void;
  disabled?: boolean;
  onProceed?: () => void;
  isStreaming?: boolean;
  canProceed?: boolean;
}

export const IdentityForm: React.FC<IdentityFormProps> = ({
  identity,
  onChange,
  disabled = false,
  onProceed,
  isStreaming = false,
  canProceed = false,
}) => {
  const isComplete = Boolean(
    identity.fullName.trim() && identity.email.trim() && identity.jobPosition.trim()
  );

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Step Indicator (1 Identitas, 2 Kamera, 3 Selesai) */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold border border-white/20 shadow-sm">
            <span className="w-4 h-4 rounded-full bg-white text-rose-950 flex items-center justify-center text-[10px] font-black">
              1
            </span>
            <span>Identitas</span>
          </div>

          <div className="w-3 h-px bg-white/10" />

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              isStreaming
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                : 'bg-white/[0.02] text-rose-200/40 border-white/[0.05]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                isStreaming
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-white/10 text-rose-200/50'
              }`}
            >
              2
            </span>
            <span>Kamera</span>
          </div>

          <div className="w-3 h-px bg-white/10" />

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.02] text-rose-200/40 text-[11px] font-medium border border-white/[0.05]">
            <span className="w-4 h-4 rounded-full bg-white/10 text-rose-200/50 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Selesai</span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Konfirmasi Identitas</span>
            {isComplete && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          </h2>
          <p className="text-xs text-rose-200/60 mt-1">
            Lengkapi data pelamar untuk validasi sesi wawancara kerja online.
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-rose-200/80 mb-1.5">
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
            <label className="block text-xs font-semibold text-rose-200/80 mb-1.5">
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
            <label className="block text-xs font-semibold text-rose-200/80 mb-1.5">
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

      {/* Action Button & Note */}
      <div className="mt-8 space-y-3">
        {onProceed && (
          <button
            type="button"
            onClick={onProceed}
            disabled={!canProceed || disabled}
            className="w-full py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm text-rose-950 bg-white hover:bg-rose-100 transition-all shadow-xl shadow-black/40 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
          >
            <span>{isStreaming ? 'Verifikasi Liveness Wajah' : 'Lanjutkan ke Kamera'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        <p className="text-[11px] text-center text-rose-200/40">
          🔒 Data biometrik diproses aman di sisi klien (Client-Side Edge AI)
        </p>
      </div>
    </div>
  );
};
