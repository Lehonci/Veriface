import React from 'react';
import {
  Camera,
  Sun,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Scan,
  Video,
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
  onStartCamera?: () => void;
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
  onStartCamera,
  onStartScan,
  canStartScan = true,
}) => {
  let statusBorderColor = 'border-white/10';
  let statusGlowClass = '';
  let statusBadgeColor = 'bg-rose-950/70 text-rose-300 border-rose-800/40';

  if (!isStreaming) {
    statusBorderColor = 'border-white/10';
    statusBadgeColor = 'bg-white/5 text-rose-200/60 border-white/10';
  } else if (!faceDetected) {
    statusBorderColor = 'border-rose-900/50';
    statusBadgeColor = 'bg-rose-950/80 text-rose-300 border-rose-800/50';
  } else if (luminanceStatus === 'TOO_DARK') {
    statusBorderColor = 'border-amber-500/60';
    statusGlowClass = 'shadow-[0_0_35px_rgba(245,158,11,0.25)]';
    statusBadgeColor = 'bg-amber-950/80 text-amber-300 border-amber-500/40';
  } else if (isScanning) {
    statusBorderColor = 'border-rose-500';
    statusGlowClass = 'shadow-[0_0_45px_rgba(225,29,72,0.45)]';
    statusBadgeColor = 'bg-rose-900/90 text-rose-100 border-rose-400/70';
  } else if (is3DLiveCurrent) {
    statusBorderColor = 'border-emerald-500/70';
    statusGlowClass = 'shadow-[0_0_35px_rgba(16,185,129,0.3)]';
    statusBadgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
  } else {
    statusBorderColor = 'border-amber-500/50';
    statusBadgeColor = 'bg-amber-950/70 text-amber-300 border-amber-600/40';
  }

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Right Column Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Pemeriksaan Biometrik Wajah
          </h3>
          <p className="text-xs text-rose-200/60 mt-1">
            {isStreaming
              ? 'Posisikan wajah Anda tepat di dalam area panduan oval.'
              : 'Aktifkan kamera untuk memulai verifikasi liveness pasif.'}
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold backdrop-blur-md ${statusBadgeColor} transition-all`}
        >
          {isStreaming ? (
            faceDetected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Wajah Terdeteksi</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Mencari Wajah</span>
              </>
            )
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-400/50"></span>
              <span>Webcam Standby</span>
            </>
          )}
        </div>
      </div>

      {/* Main Large Viewport */}
      <div
        className={`relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-3xl overflow-hidden glass-panel border ${statusBorderColor} ${statusGlowClass} transition-all duration-500 flex items-center justify-center bg-black/60 shadow-2xl`}
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

        {/* Ambient Vignette Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50 pointer-events-none z-15" />

        {/* Corner Reticles */}
        <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-rose-500/80 rounded-tl-xl pointer-events-none z-20" />
        <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-rose-500/80 rounded-tr-xl pointer-events-none z-20" />
        <div className="absolute bottom-5 left-5 w-7 h-7 border-b-2 border-l-2 border-rose-500/80 rounded-bl-xl pointer-events-none z-20" />
        <div className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-rose-500/80 rounded-br-xl pointer-events-none z-20" />

        {/* Center Face Alignment Guide Oval */}
        {isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div
              className={`w-[54%] h-[72%] sm:w-[46%] sm:h-[76%] rounded-[48%] border-2 border-dashed ${
                isScanning
                  ? 'border-rose-400 animate-pulse scale-[1.02] shadow-[0_0_25px_rgba(225,29,72,0.45)]'
                  : faceDetected
                  ? is3DLiveCurrent
                    ? 'border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                    : 'border-amber-400/80'
                  : 'border-white/20'
              } transition-all duration-300 relative flex items-center justify-center`}
            >
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3.5 h-0.5 bg-rose-500/70" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3.5 h-0.5 bg-rose-500/70" />

              {isScanning && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_16px_#f43f5e] animate-scan-line" />
              )}
            </div>
          </div>
        )}

        {/* Top HUD Metrics when streaming */}
        {isStreaming && (
          <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-30">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-semibold ${statusBadgeColor}`}
            >
              {isModelLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  <span>Memuat Face Mesh...</span>
                </>
              ) : isScanning ? (
                <>
                  <Scan className="w-3.5 h-3.5 text-rose-200 animate-spin" />
                  <span>Memindai Kedalaman 3D ({scanProgress}%)...</span>
                </>
              ) : faceDetected ? (
                is3DLiveCurrent ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Wajah 3D Alami</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Menganalisis Kontur...</span>
                  </>
                )
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-rose-400" />
                  <span>Posisikan Wajah Anda</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 border border-white/10 backdrop-blur-md text-xs text-rose-200">
                <Sun
                  className={`w-3.5 h-3.5 ${
                    luminanceStatus === 'TOO_DARK' ? 'text-amber-400 animate-pulse' : 'text-amber-300'
                  }`}
                />
                <span className="font-mono text-[11px] font-semibold">{currentLuminance} Lux</span>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 border border-white/10 backdrop-blur-md text-xs text-rose-200">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[10px] text-rose-300/70 font-mono">σ²(z):</span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    currentVariance >= MIN_Z_VARIANCE_THRESHOLD ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {currentVariance.toFixed(5)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* When Camera is NOT streaming */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-maroon-900/40 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/60 mb-3">
              <Video className="w-8 h-8" />
            </div>
            <h4 className="text-base sm:text-lg font-bold text-white">Kamera Belum Aktif</h4>
            <p className="text-xs text-rose-200/60 max-w-xs mt-1 mb-4">
              Sistem membutuhkan izin webcam untuk memverifikasi liveness 3D pasif.
            </p>
            {onStartCamera && (
              <button
                type="button"
                onClick={onStartCamera}
                disabled={isLoadingCamera}
                className="px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider bg-white hover:bg-rose-100 text-rose-950 transition-all shadow-lg active:scale-95 disabled:opacity-40"
              >
                {isLoadingCamera ? 'Membuka Kamera...' : 'Buka & Izinkan Kamera'}
              </button>
            )}
            {errorMessage && (
              <p className="text-xs text-rose-400 mt-3 font-medium">{errorMessage}</p>
            )}
          </div>
        )}

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60 z-30">
            <div
              className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-emerald-400 transition-all duration-100 ease-out shadow-[0_0_12px_#f43f5e]"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Viewport Bottom Hint / Action */}
      <div className="mt-4 flex items-center justify-between gap-3 p-3.5 rounded-2xl glass-panel-subtle border border-white/[0.06]">
        <div className="flex items-center gap-2.5 text-xs text-rose-200/80">
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
          <span>
            {isScanning
              ? 'Tatap lurus ke kamera selama 2-3 detik secara alami.'
              : faceDetected
              ? 'Wajah terdeteksi. Tekan tombol verifikasi di samping untuk mulai memindai.'
              : isStreaming
              ? 'Arahkan wajah Anda ke dalam oval panduan.'
              : 'Aktifkan kamera untuk memulai pemeriksaan.'}
          </span>
        </div>

        {isStreaming && onStartScan && (
          <button
            type="button"
            onClick={onStartScan}
            disabled={isModelLoading || isScanning || !faceDetected || !canStartScan}
            className="px-5 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-rose-600 to-maroon-600 hover:from-rose-500 hover:to-maroon-500 text-white shadow-md shadow-rose-950/60 flex items-center gap-2 shrink-0 disabled:opacity-40 active:scale-95"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memindai...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mulai Scan 3D</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
