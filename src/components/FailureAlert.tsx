import React from 'react';
import { AlertOctagon, RefreshCw, HelpCircle, UserCheck, X } from 'lucide-react';

interface FailureAlertProps {
  title?: string;
  reason?: string;
  onRetry: () => void;
  canAppeal?: boolean;
  isRequestingAppeal?: boolean;
  onRequestAppeal?: () => void;
  isAuditLogged?: boolean;
}

export const FailureAlert: React.FC<FailureAlertProps> = ({
  title = 'Verifikasi Gagal: Indikasi Objek Tidak Asli',
  reason = 'Wajah tidak terdeteksi sebagai objek 3D alami. Terindikasi penggunaan foto cetak, layar perangkat, atau manipulasi kamera.',
  onRetry,
  canAppeal = false,
  isRequestingAppeal = false,
  onRequestAppeal,
  isAuditLogged = true,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in"
      onClick={onRetry}
      role="dialog"
      aria-modal="true"
      aria-labelledby="failure-modal-title"
    >
      <div
        className="relative w-full max-w-lg glass-panel p-7 sm:p-8 rounded-3xl border border-rose-300/70 shadow-[0_0_50px_rgba(225,29,72,0.18)] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onRetry}
          aria-label="Tutup notifikasi gagal"
          className="absolute top-4 right-4 p-2 rounded-full text-[#7A4B58] hover:text-[#2B0E17] hover:bg-[#FAF4F6] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-300 flex items-center justify-center text-rose-600 mb-4 shadow-md">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold mb-3">
          <span>Hasil Pemeriksaan Keamanan</span>
        </div>

        <h3
          id="failure-modal-title"
          className="text-xl sm:text-2xl font-bold text-[#2B0E17] mb-3 tracking-tight"
        >
          {title}
        </h3>

        <div className="p-4 rounded-2xl bg-[#FAF4F6] border border-[#7B2E46]/15 mb-6 text-left space-y-2.5">
          <p className="text-xs sm:text-sm text-[#6A2E3E] leading-relaxed font-medium">
            {reason}
          </p>
          <div className="flex items-start gap-2 pt-2 border-t border-[#7B2E46]/10 text-[11px] text-[#7A4B58]">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[#7B2E46] mt-0.5" />
            <span>
              {isAuditLogged
                ? 'Bukti snapshot & log audit anomali telah dicatat ke dashboard host secara otomatis.'
                : 'Pemindaian ditahan sementara agar Anda dapat menyesuaikan kondisi terlebih dahulu sebelum mencoba ulang.'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {canAppeal && onRequestAppeal && (
            <button
              type="button"
              onClick={onRequestAppeal}
              disabled={isRequestingAppeal}
              className="flex-1 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{isRequestingAppeal ? 'Mengirim...' : 'Ajukan Tinjauan Admin'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="flex-1 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-[#7B2E46] hover:bg-[#682238] border border-[#7B2E46] text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-[#7B2E46]/25"
          >
            <RefreshCw className="w-4 h-4 text-[#FFFDF9] shrink-0" />
            <span>Coba Ulangi Pemindaian</span>
          </button>
        </div>
      </div>
    </div>
  );
};
