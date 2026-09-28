import React from 'react';
import {
  Camera,
  Sun,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Scan,
} from 'lucide-react';
import { MIN_Z_VARIANCE_THRESHOLD } from '@/lib/cv/depthVariance';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  isLoadingCamera: boolean;
  isModelLoading: boolean;
  faceDetected: boolean;
  currentVariance: number;
  currentLuminance: number;
  luminanceStatus: 'TOO_DARK' | 'OPTIMAL' | 'TOO_BRIGHT';
  is3DLiveCurrent: boolean;
  isScanning: boolean;
  scanProgress: number;
  errorMessage?: string | null;
  onStartScan?: () => void;
  canStartScan?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  isStreaming,
  isLoadingCamera,
  isModelLoading,
  faceDetected,
  currentVariance,
  currentLuminance,
  luminanceStatus,
  is3DLiveCurrent,
  isScanning,
  scanProgress,
  errorMessage,
  onStartScan,
  canStartScan = true,
}) => {
  let statusBorderColor = 'border-rose-900/40';
  let statusGlowClass = '';
  let statusBadgeColor = 'bg-rose-950/60 text-rose-300 border-rose-800/40';

  if (!faceDetected) {
    statusBorderColor = 'border-rose-900/50';
    statusBadgeColor = 'bg-rose-950/80 text-rose-300 border-rose-800/50';
  } else if (luminanceStatus === 'TOO_DARK') {
    statusBorderColor = 'border-amber-500/60';
    statusGlowClass = 'shadow-[0_0_30px_rgba(245,158,11,0.2)]';
    statusBadgeColor = 'bg-amber-950/80 text-amber-300 border-amber-500/40';
  } else if (isScanning) {
    statusBorderColor = 'border-rose-500';
    statusGlowClass = 'shadow-[0_0_40px_rgba(225,29,72,0.4)] animate-glow-maroon';
    statusBadgeColor = 'bg-rose-900/80 text-rose-100 border-rose-500/60';
  } else if (is3DLiveCurrent) {
    statusBorderColor = 'border-emerald-500/70';
    statusGlowClass = 'shadow-[0_0_30px_rgba(16,185,129,0.25)]';
    statusBadgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
  } else {
    statusBorderColor = 'border-amber-500/50';
    statusBadgeColor = 'bg-amber-950/70 text-amber-300 border-amber-600/40';
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Extra Large Camera Viewport */}
      <div
        className={`relative w-full max-w-4xl aspect-[4/3] sm:aspect-[16/10] md:aspect-[16/9] rounded-3xl overflow-hidden glass-panel ${statusBorderColor} ${statusGlowClass} transition-all duration-500 flex items-center justify-center`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
            isStreaming ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-15" />

        {/* 4 Cyber Corner Brackets */}
        <div className="absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 border-rose-500/70 rounded-tl-lg pointer-events-none z-20" />
        <div className="absolute top-5 right-5 w-8 h-8 border-t-2 border-r-2 border-rose-500/70 rounded-tr-lg pointer-events-none z-20" />
        <div className="absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 border-rose-500/70 rounded-bl-lg pointer-events-none z-20" />
        <div className="absolute bottom-5 right-5 w-8 h-8 border-b-2 border-r-2 border-rose-500/70 rounded-br-lg pointer-events-none z-20" />

        {/* Center Face Alignment Guide Oval */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className={`w-[52%] h-[68%] sm:w-[42%] sm:h-[72%] md:w-[36%] md:h-[76%] rounded-[48%] border-2 border-dashed ${
              isScanning
                ? 'border-rose-400 animate-pulse scale-[1.02]'
                : faceDetected
                ? is3DLiveCurrent
                  ? 'border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'border-amber-400/80'
                : 'border-white/20'
            } transition-all duration-300 relative flex items-center justify-center`}
          >
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-rose-500/60" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-rose-500/60" />

            {isScanning && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_12px_#f43f5e] animate-scan-line" />
            )}
          </div>
        </div>

        {/* Top Status HUD Bar */}
        <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-30">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md text-xs font-semibold ${statusBadgeColor} transition-all`}
          >
            {isModelLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                <span>Memuat MediaPipe Face Mesh...</span>
              </>
            ) : isScanning ? (
              <>
                <Scan className="w-3.5 h-3.5 text-rose-300 animate-spin" />
                <span>Memindai Kurvatur 3D ({scanProgress}%)...</span>
              </>
            ) : faceDetected ? (
              is3DLiveCurrent ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Wajah 3D Terdeteksi (Siap Verifikasi)</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Menganalisis Kedalaman...</span>
                </>
              )
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-rose-400" />
                <span>Arahkan Wajah ke Dalam Area Oval</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-xs text-rose-200">
              <Sun
                className={`w-3.5 h-3.5 ${
                  luminanceStatus === 'TOO_DARK' ? 'text-amber-400 animate-pulse' : 'text-yellow-400'
                }`}
              />
              <span className="font-mono text-[11px]">{currentLuminance} Lux</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-xs text-rose-200">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] text-rose-300/70">σ²(z):</span>
              <span
                className={`font-mono text-[11px] ${
                  currentVariance >= MIN_Z_VARIANCE_THRESHOLD ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {currentVariance.toFixed(5)}
              </span>
            </div>
          </div>
        </div>

        {(!isStreaming || isLoadingCamera) && (
          <div className="absolute inset-0 bg-maroon-950/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40">
            {isLoadingCamera ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                <p className="text-sm font-medium text-rose-200">Mengakses webcam perangkat...</p>
              </div>
            ) : errorMessage ? (
              <div className="flex flex-col items-center gap-3 max-w-md">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-white">Gagal Mengakses Kamera</h4>
                <p className="text-xs text-rose-200/70">{errorMessage}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-rose-200">Kamera belum diaktifkan</p>
                <p className="text-xs text-rose-200/50 max-w-xs">
                  Sistem memerlukan izin kamera untuk verifikasi biometrik pasif
                </p>
              </div>
            )}
          </div>
        )}

        {isScanning && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60 z-30">
            <div
              className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-emerald-400 transition-all duration-100 ease-out shadow-[0_0_8px_#f43f5e]"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-panel-subtle border border-white/[0.06]">
        <div className="flex items-center gap-3 text-xs text-rose-200/80">
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
          <span>
            {isScanning
              ? 'Tatap lurus ke kamera selama 2-3 detik, tidak perlu bergerak kaku.'
              : faceDetected
              ? 'Posisi wajah optimal. Klik tombol di samping untuk memulai verifikasi.'
              : 'Posisikan wajah Anda tepat di dalam area panduan oval.'}
          </span>
        </div>

        {onStartScan && (
          <button
            onClick={onStartScan}
            disabled={!isStreaming || isModelLoading || isScanning || !faceDetected || !canStartScan}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-maroon-600 hover:from-rose-500 hover:to-maroon-500 text-white shadow-lg shadow-rose-950/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-rose-600 disabled:hover:to-maroon-600 active:scale-95"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi ({scanProgress}%)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Mulai Verifikasi Liveness</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
