import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ApplicantIdentity } from '@/types';

interface IdentityFormProps {
  identity: ApplicantIdentity;
  onChange: (updated: Partial<ApplicantIdentity>) => void;
  disabled?: boolean;
  onProceed?: () => void;
  isStreaming?: boolean;
  canProceed?: boolean;
  isEmailValid?: boolean;
}

export const IdentityForm: React.FC<IdentityFormProps> = ({
  identity,
  onChange,
  disabled = false,
  onProceed,
  isStreaming = false,
  canProceed = false,
  isEmailValid = identity.email?.toLowerCase().endsWith('@gmail.com')
}) => {
  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Step Indicator (1 Identitas, 2 Liveness, 3 Selesai) with subtle line connector */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex flex-col items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-[#7B2E46] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#7B2E46]/25">
              1
            </span>
            <span className="text-[11px] font-semibold text-[#2B0E17]">Identitas</span>
          </div>

          <div className="flex-1 h-[1px] bg-[#7B2E46]/20 -mt-4" />

          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                isStreaming
                  ? 'bg-[#7B2E46] text-white font-bold shadow-md shadow-[#7B2E46]/25'
                  : 'bg-[#7B2E46]/10 text-[#7B2E46]/50'
              }`}
            >
              2
            </span>
            <span className={`text-[11px] font-medium ${isStreaming ? 'text-[#2B0E17]' : 'text-[#7B2E46]/50'}`}>
              Verifikasi
            </span>
          </div>

          <div className="flex-1 h-[1px] bg-[#7B2E46]/20 -mt-4" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-[#7B2E46]/10 text-[#7B2E46]/50 flex items-center justify-center text-xs font-medium">
              3
            </span>
            <span className="text-[11px] font-medium text-[#7B2E46]/50">Selesai</span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-[#2B0E17] tracking-tight">
            Data Diri Pelamar
          </h2>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A1A28] mb-2">
              Nama lengkap
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Kyryll Chudomirovich Flins"
              className="glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-[#9D7682] disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[#4A1A28]">
                Email
              </label>
              {identity.email && !identity.email.toLowerCase().endsWith('@gmail.com') && (
                <span className="text-[10px] text-[#B91C1C] font-semibold">
                  Harus format email (@gmail.com)
                </span>
              )}
            </div>
            <input
              type="email"
              required
              pattern="^[^\s@]+@gmail\.com$"
              disabled={disabled}
              value={identity.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="chudomirovich@gmail.com"
              className={`glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-[#9D7682] disabled:opacity-50 ${
                identity.email && !identity.email.toLowerCase().endsWith('@gmail.com')
                  ? 'border-red-500 focus:border-red-600'
                  : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A1A28] mb-2">
              Posisi yang Dilamar
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={identity.jobPosition}
              onChange={(e) => onChange({ jobPosition: e.target.value })}
              placeholder="Software Engineer"
              className="glass-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm placeholder:text-[#9D7682] disabled:opacity-50"
            />
          </div>
        </div>
      </div>
      
      {/* Action CTA Button */}
      <div className="mt-8 space-y-3">
        {onProceed && (
          <button
            type="button"
            onClick={onProceed}
            disabled={!canProceed || disabled || !isEmailValid}
            className="w-full py-3.5 px-6 rounded-full font-semibold text-xs sm:text-sm text-white bg-[#7B2E46] hover:bg-[#682238] transition-all shadow-lg shadow-[#7B2E46]/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
          >
            <span>{isStreaming ? 'Mulai Pemindaian Liveness' : 'Lanjut ke pemindaian'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
