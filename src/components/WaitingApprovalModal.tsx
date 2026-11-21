import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ShieldCheck, Clock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { VerificationSuccessPayload } from '@/types';

interface WaitingApprovalModalProps {
  verificationId: string;
  statusToken?: string;
  applicantName: string;
  mode: 'passed' | 'appeal';
  initialTimeoutSeconds: number;
  onApproved: (payload: VerificationSuccessPayload) => void;
  onRejected: (reason: string) => void;
  onCancel: () => void;
}

export const WaitingApprovalModal: React.FC<WaitingApprovalModalProps> = ({
  verificationId,
  statusToken,
  applicantName,
  mode,
  initialTimeoutSeconds,
  onApproved,
  onRejected,
  onCancel,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimeoutSeconds);
  const completedRef = useRef(false);

  const checkStatus = useCallback(async () => {
    if (completedRef.current) return;
    try {
      const headers: Record<string, string> = {};
      if (statusToken) {
        headers['x-status-token'] = statusToken;
      }
      const res = await fetch(
        `/api/verify/status?id=${encodeURIComponent(verificationId)}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
          headers,
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || completedRef.current) return;

      if (
        (data.adminDecision === 'ADMITTED' || data.adminDecision === 'AUTO_ADMITTED') &&
        data.payload
      ) {
        completedRef.current = true;
        onApproved(data.payload);
        return;
      }

      if (data.adminDecision === 'REMOVED') {
        completedRef.current = true;
        if (mode === 'appeal') {
          onRejected(
            data.timedOut
              ? 'Batas waktu peninjauan administrator berakhir. Demi keamanan sistem, akses ke ruang wawancara tetap ditolak.'
              : 'Administrator meninjau bukti visual Anda dan memutuskan untuk menolak akses masuk.'
          );
        } else {
          onRejected('Administrator/Host menolak akses masuk Anda pada tahap audit visual.');
        }
        return;
      }

      if (typeof data.remainingSeconds === 'number') {
        setRemainingSeconds(data.remainingSeconds);
      }
    } catch {
      // Abaikan error jaringan sesaat saat polling
    }
  }, [verificationId, statusToken, mode, onApproved, onRejected]);

  // Timer 1 detik agar tampilan countdown selalu responsif
  useEffect(() => {
    const tick = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Polling berkala setiap 2 detik (memicu evaluasi timeout di server)
  useEffect(() => {
    checkStatus();
    const poll = setInterval(() => {
      checkStatus();
    }, 2000);
    return () => clearInterval(poll);
  }, [checkStatus]);

  // Realtime listener agar keputusan Admin langsung terasa instan (< 1 detik)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`verif-wait-${verificationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'verifications',
          filter: `id=eq.${verificationId}`,
        },
        () => {
          checkStatus();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase?.removeChannel(channel);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [verificationId, checkStatus]);

  const progressPct = Math.max(
    0,
    Math.min(100, (remainingSeconds / Math.max(1, initialTimeoutSeconds)) * 100)
  );

  const isPassedMode = mode === 'passed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel p-8 rounded-3xl border border-[#7B2E46]/25 shadow-2xl text-center">
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-md ${
            isPassedMode
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-600'
              : 'bg-amber-50 border border-amber-300 text-amber-600'
          }`}
        >
          {isPassedMode ? (
            <ShieldCheck className="w-9 h-9 animate-pulse" />
          ) : (
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          )}
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 border ${
            isPassedMode
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {isPassedMode ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Model Liveness Valid &middot; Menunggu Host</span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pengajuan Tinjauan Manual Terkirim</span>
            </>
          )}
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-[#2B0E17] mb-2 tracking-tight">
          {isPassedMode
            ? `Halo ${applicantName}, Sebentar Lagi Masuk!`
            : 'Menunggu Peninjauan Administrator'}
        </h3>

        <p className="text-xs sm:text-sm text-[#6B3B49] mb-6 max-w-md mx-auto leading-relaxed">
          {isPassedMode
            ? 'Wajah 3D Anda telah terverifikasi valid. Kami sedang memberitahu Host/Admin untuk konfirmasi cepat. Jika Host belum merespons, Anda akan otomatis dialihkan ke Waiting Room Zoom.'
            : 'Notifikasi dan snapshot Anda sudah dikirim ke Host/Admin untuk pengecekan visual. Jika batas waktu berakhir tanpa persetujuan Host, akses tetap ditolak.'}
        </p>

        {/* Progress & Countdown Box */}
        <div className="p-4 rounded-2xl bg-[#FAF4F6] border border-[#7B2E46]/15 mb-6 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#7D5662] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#7B2E46] animate-spin" />
              {isPassedMode ? 'Pengalihan otomatis dalam:' : 'Batas waktu peninjauan:'}
            </span>
            <span className="font-mono text-sm font-black text-[#8A233E]">
              {remainingSeconds} detik
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white border border-[#7B2E46]/15 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                isPassedMode ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[11px] text-[#7A4B58]">
            {isPassedMode
              ? 'Notifikasi Desktop & Email sudah dikirim ke Host. Anda tidak perlu me-refresh halaman ini.'
              : 'Pastikan pencahayaan terang dan kamera stabil jika Anda ingin membatalkan dan memindai ulang.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 rounded-xl font-semibold text-xs text-[#7B2E46] bg-white hover:bg-[#FAF4F6] border border-[#7B2E46]/25 flex items-center justify-center gap-2 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Batalkan &amp; Pindai Ulang</span>
        </button>
      </div>
    </div>
  );
};
