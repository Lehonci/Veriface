import React from 'react';
import { AlertOctagon, RefreshCw, HelpCircle } from 'lucide-react';

interface FailureAlertProps {
  title?: string;
  reason?: string;
  onRetry: () => void;
}

export const FailureAlert: React.FC<FailureAlertProps> = ({
  title = 'Verifikasi Gagal: Indikasi Objek Tidak Asli',
  reason = 'Wajah tidak terdeteksi sebagai objek 3D alami. Terindikasi penggunaan foto cetak, layar perangkat, atau manipulasi kamera.',
  onRetry,
}) => {
  return (
    <div className="w-full glass-panel p-6 sm:p-8 rounded-[28px] border border-rose-300 shadow-xl shadow-rose-900/5 animate-fade-in bg-[#FFFDFB]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <h4 className="text-base sm:text-lg font-bold text-[#2B0E17] tracking-tight">{title}</h4>
            <p className="text-xs sm:text-sm text-[#6A2E3E] leading-relaxed font-medium">{reason}</p>
            <div className="flex items-center gap-1.5 pt-1.5 text-[11px] text-[#7A4B58]">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[#7B2E46]" />
              <span>
                Bukti snapshot & log audit anomali telah dicatat ke dashboard host secara otomatis.
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onRetry}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-[#7B2E46] hover:bg-[#682238] border border-[#7B2E46] text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-[#7B2E46]/25 shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-[#FFFDF9]" />
          <span>Coba Ulangi Pemindaian</span>
        </button>
      </div>
    </div>
  );
};
