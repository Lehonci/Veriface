import React, { useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink, Copy, Check, Sparkles, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { VerificationSuccessPayload } from '@/types';

interface SuccessModalProps {
  payload: VerificationSuccessPayload;
  onClose?: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ payload }) => {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f43f5e', '#10b981', '#fbbf24', '#be123c', '#ffffff'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = payload.zoomUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [payload.zoomUrl]);

  const handleCopyName = () => {
    navigator.clipboard.writeText(payload.displayNameGuide);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel p-8 rounded-3xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/60 animate-bounce">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Biometrik 3D Terverifikasi Asli</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
          Verifikasi Identitas Berhasil!
        </h3>
        <p className="text-xs sm:text-sm text-rose-200/70 mb-6 max-w-sm mx-auto">
          Anda telah lolos uji *liveness* biometrik pasif dan diizinkan masuk ke ruang wawancara resmi.
        </p>

        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-left mb-6">
          <p className="text-[11px] font-semibold text-rose-300/80 uppercase tracking-wider mb-2">
            Penting: Ubah Nama Tampilan Zoom Anda Menjadi:
          </p>
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40">
            <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wide truncate">
              {payload.displayNameGuide}
            </span>
            <button
              onClick={handleCopyName}
              className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors shrink-0 flex items-center gap-1.5 text-xs font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
          {payload.passcode && (
            <p className="text-[11px] text-rose-200/60 mt-2">
              Passcode Meeting: <strong className="text-white font-mono">{payload.passcode}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={payload.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Zoom Meeting Sekarang</span>
          </a>

          <div className="flex items-center justify-center gap-2 text-xs text-rose-200/60">
            <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
            <span>Mengalihkan otomatis dalam <strong className="text-white font-mono">{countdown} detik</strong>...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
