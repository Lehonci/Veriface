import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
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
  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Step Indicator (1 Identitas, 2 Liveness, 3 Selesai) with subtle line connector */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex flex-col items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-white text-rose-950 flex items-center justify-center text-xs font-bold shadow-sm">
              1
            </span>
            <span className="text-[11px] font-medium text-white/90">Identitas</span>
          </div>

          <div className="flex-1 h-[1px] bg-white/10 -mt-4" />

          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                isStreaming
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-white/10 text-white/40'
              }`}
            >
              2
            </span>
            <span className="text-[11px] font-medium text-white/40">Liveness</span>
          </div>

          <div className="flex-1 h-[1px] bg-white/10 -mt-4" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-white/10 text-white/40 flex items-center justify-center text-xs font-medium">
              3
            </span>
            <span className="text-[11px] font-medium text-white/40">Selesai</span>
          </div>
        </div>

        {/* Section Heading matching Figma */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Detail undangan
          </h2>
          <p className="text-xs text-rose-200/60 mt-1">
            Masukkan data sesuai undangan dari HR.
          </p>
        </div>

        {/* Form Inputs matching Figma exactly */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-rose-200/80 mb-2">
              Nama lengkap
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Masukkan nama lengkap"
              className="glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-white/40 disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-rose-200/80">
                Email
              </label>
              {identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) && (
                <span className="text-[10px] text-rose-300 font-medium">
                  Harus format email (@...)
                </span>
              )}
            </div>
            <input
              type="email"
              required
              disabled={disabled}
              value={identity.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="Masukkan email"
              className={`glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-white/40 disabled:opacity-50 ${
                identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)
                  ? 'border-rose-400/80 focus:border-rose-400'
                  : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-rose-200/80 mb-2">
              Posisi / kode undangan
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.jobPosition}
              onChange={(e) => onChange({ jobPosition: e.target.value })}
              placeholder="Masukkan posisi / kode undangan"
              className="glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-white/40 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Action Button & Note matching Figma */}
      <div className="mt-8 space-y-3">
        {onProceed && (
          <button
            type="button"
            onClick={onProceed}
            disabled={!canProceed || disabled}
            className="w-full py-3.5 px-6 rounded-full font-semibold text-xs sm:text-sm text-rose-950 bg-white hover:bg-rose-50 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
          >
            <span>{isStreaming ? 'Mulai Pemindaian Liveness' : 'Lanjut ke pemindaian'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-center text-rose-200/50 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-300/60" />
          <span>Biometrik diproses lokal dan tidak disimpan sebagai video.</span>
        </div>
      </div>
    </div>
  );
};
