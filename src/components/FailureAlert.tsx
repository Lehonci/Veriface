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
    <div className="w-full glass-panel p-6 rounded-3xl border border-rose-500/40 shadow-[0_0_40px_rgba(225,29,72,0.25)] animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white tracking-tight">{title}</h4>
            <p className="text-xs sm:text-sm text-rose-200/80 mt-1 max-w-xl">{reason}</p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-rose-300/60">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>
                Bukti snapshot & log audit anomali telah dicatat ke dashboard host secara otomatis.
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onRetry}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-950 hover:bg-rose-900 border border-rose-800/60 text-white flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
          <span>Coba Ulangi Pemindaian</span>
        </button>
      </div>
    </div>
  );
};
