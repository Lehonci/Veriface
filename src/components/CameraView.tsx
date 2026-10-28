import React from 'react';
import {
  Sun,
  Layers,
  ShieldCheck,
  Loader2,
  Scan,
  ScanFace,
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
  hasAccessory?: boolean;
  accessoryDetails?: string[];
  accessoryReason?: string | null;
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
  hasAccessory = false,
  accessoryDetails = [],
  accessoryReason = null,
  isScanning,
  scanProgress,
  errorMessage,
  onStartCamera,
  onStartScan,
  canStartScan = true,
}) => {
  return (
    <div className="flex flex-col h-full justify-between">
      {/* Right Column Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#2B0E17] tracking-tight">
            Pratinjau verifikasi
          </h3>
        </div>

        {/* Status Pill in top right - Inverted to Maroon with Cream Text */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-colors ${
            hasAccessory
              ? 'bg-[#991B1B] text-white'
              : isStreaming
              ? faceDetected
                ? 'bg-[#15803D] text-white'
                : 'bg-[#B45309] text-white'
              : 'bg-[#7B2E46] text-[#FFFDF9]'
          }`}
        >
          {isStreaming ? (
            hasAccessory ? (
              <span>Atribut terdeteksi ({accessoryDetails.join(', ') || 'Kacamata'})</span>
            ) : faceDetected ? (
              <span>Siap scan</span>
            ) : (
              <span>Mencari wajah</span>
            )
          ) : (
            <span>Kamera belum aktif</span>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-[24px] overflow-hidden border border-[#7B2E46]/15 flex items-center justify-center bg-[#F5EAE1] shadow-xl">
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

        {/* Ambient Vignette during Streaming */}
        {isStreaming && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-15" />
        )}

        {/* Center Face Alignment Guide Oval (When Streaming) */}
        {isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div
              className={`w-[52%] h-[74%] sm:w-[46%] sm:h-[76%] rounded-[48%] border-2 border-dashed ${
                isScanning
                  ? 'border-rose-400 animate-pulse scale-[1.02] shadow-[0_0_25px_rgba(225,29,72,0.45)]'
                  : hasAccessory
                  ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                  : faceDetected
                  ? is3DLiveCurrent
                    ? 'border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                    : 'border-amber-400/80'
                  : 'border-white/40'
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 bg-black/60 backdrop-blur-md text-xs font-medium text-white/95">
              {isModelLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  <span>Memuat Face Mesh...</span>
                </>
              ) : isScanning ? (
                <>
                  <Scan className="w-3.5 h-3.5 text-rose-200 animate-spin" />
                  <span>Memindai Kedalaman ({scanProgress}%)...</span>
                </>
              ) : hasAccessory ? (
                <span className="text-rose-300 font-semibold">Lepas {accessoryDetails.join(' & ') || 'Kacamata'}</span>
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
                <span>Posisikan Wajah</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-xs text-rose-200">
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-mono text-[11px] font-semibold">{currentLuminance} Lux</span>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-xs text-rose-200">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[10px] text-rose-300/80 font-mono">σ²:</span>
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

        {/* When Camera is NOT streaming - Warm Cream Style with Deep Maroon Accents */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-20">
            {/* Soft Circular Glow Badge with ScanFace Icon */}
            <div className="w-16 h-16 rounded-full bg-[#7B2E46]/10 border border-[#7B2E46]/20 flex items-center justify-center text-[#7B2E46] mb-4 shadow-sm">
              <ScanFace className="w-7 h-7" />
            </div>

            <h4 className="text-base sm:text-lg font-bold text-[#2B0E17] tracking-tight">
              Kamera belum dimulai
            </h4>
            <p className="text-xs text-[#7A4B58] mt-1 max-w-xs font-medium">
              Lengkapi data diri untuk melanjutkan
            </p>

            {onStartCamera && (
              <button
                type="button"
                onClick={onStartCamera}
                disabled={isLoadingCamera || !canStartScan}
                className="mt-4 px-5 py-2.5 rounded-full font-semibold text-xs bg-[#7B2E46] hover:bg-[#682238] text-white shadow-md shadow-[#7B2E46]/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoadingCamera ? 'Membuka Kamera...' : 'Buka & Izinkan Kamera'}
              </button>
            )}

            {errorMessage && (
              <p className="text-xs text-[#B91C1C] mt-3 font-semibold">{errorMessage}</p>
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
      {isStreaming && (
        <div className="mt-4 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F5EAE1]/90 border border-[#7B2E46]/15">
          <div className="flex items-center gap-2.5 text-xs text-[#4A1A28] font-medium">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasAccessory ? 'bg-amber-600' : 'bg-[#7B2E46] animate-pulse'
              }`}
            />
            <span>
              {isScanning
                ? 'Tatap lurus ke kamera selama 2-3 detik secara alami.'
                : hasAccessory
                ? accessoryReason || 'Lepas kacamata atau masker penutup muka untuk melanjutkan verifikasi.'
                : faceDetected
                ? 'Wajah terdeteksi. Tekan tombol verifikasi untuk mulai memindai.'
                : 'Arahkan wajah Anda ke dalam oval panduan.'}
            </span>
          </div>

          {onStartScan && (
            <button
              type="button"
              onClick={onStartScan}
              disabled={isModelLoading || isScanning || !faceDetected || !canStartScan || hasAccessory}
              className="px-5 py-2 rounded-xl font-bold text-xs bg-[#7B2E46] hover:bg-[#682238] text-white shadow-md shadow-[#7B2E46]/20 flex items-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
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
      )}
    </div>
  );
};
