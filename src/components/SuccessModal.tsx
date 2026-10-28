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
        colors: ['#7B2E46', '#10b981', '#fbbf24', '#be123c', '#EDE0D4'],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel p-8 rounded-3xl border border-emerald-600/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 mb-4 shadow-md animate-bounce">
          <ShieldCheck className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Biometrik 3D Terverifikasi Asli</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-[#2B0E17] mb-2 tracking-tight">
          Verifikasi Identitas Berhasil!
        </h3>
        <p className="text-xs sm:text-sm text-[#6B3B49] mb-6 max-w-sm mx-auto font-medium">
          Anda telah lolos uji *liveness* biometrik pasif dan diizinkan masuk ke ruang wawancara resmi.
        </p>

        <div className="p-4 rounded-2xl bg-[#F7EFE8] border border-[#7B2E46]/15 text-left mb-6">
          <p className="text-[11px] font-bold text-[#7B2E46] uppercase tracking-wider mb-2">
            Penting: Ubah Nama Tampilan Zoom Anda Menjadi:
          </p>
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-[#7B2E46]/20 shadow-sm">
            <span className="font-mono text-sm sm:text-base font-bold text-[#2B0E17] tracking-wide truncate">
              {payload.displayNameGuide}
            </span>
            <button
              onClick={handleCopyName}
              className="p-2 rounded-lg bg-[#7B2E46] hover:bg-[#682238] text-white transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-100">Tersalin</span>
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
            <p className="text-[11px] text-[#6B3B49] mt-2 font-medium">
              Passcode Meeting: <strong className="text-[#2B0E17] font-mono">{payload.passcode}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={payload.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Zoom Meeting Sekarang</span>
          </a>

          <div className="flex items-center justify-center gap-2 text-xs text-[#7A4B58] font-medium">
            <Clock className="w-3.5 h-3.5 text-[#7B2E46] animate-spin" />
            <span>Mengalihkan otomatis dalam <strong className="text-[#2B0E17] font-mono">{countdown} detik</strong>...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
