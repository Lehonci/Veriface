'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { IdentityForm } from '@/components/IdentityForm';
import { CameraView } from '@/components/CameraView';
import { SuccessModal } from '@/components/SuccessModal';
import { FailureAlert } from '@/components/FailureAlert';
import { useCamera } from '@/hooks/useCamera';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { checkVirtualCamera } from '@/lib/cv/virtualCamera';
import { captureAndCropFaceSnapshot } from '@/lib/cv/cropFace';
import {
  ApplicantIdentity,
  VerificationSuccessPayload,
} from '@/types';
import { ShieldCheck, Video, AlertTriangle } from 'lucide-react';

export default function GatewayPage() {
  const [identity, setIdentity] = useState<ApplicantIdentity>({
    fullName: '',
    email: '',
    jobPosition: '',
  });

  const [virtualCamBlocked, setVirtualCamBlocked] = useState(false);
  const [virtualCamName, setVirtualCamName] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [successPayload, setSuccessPayload] = useState<VerificationSuccessPayload | null>(null);
  const [failureInfo, setFailureInfo] = useState<{ title: string; reason: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    videoRef,
    isStreaming,
    isLoading: isLoadingCamera,
    error: cameraError,
    startCamera,
  } = useCamera();

  useEffect(() => {
    async function runVirtualCamCheck() {
      const result = await checkVirtualCamera();
      if (result.isVirtual) {
        setVirtualCamBlocked(true);
        setVirtualCamName(result.deviceName || 'Virtual Camera Driver');
      }
    }
    runVirtualCamCheck();
  }, []);

  const {
    isModelLoading,
    modelError,
    faceDetected,
    currentVariance,
    currentLuminance,
    luminanceStatus,
    is3DLiveCurrent,
    isScanning,
    scanProgress,
    startLivenessScan,
    resetScan,
  } = useFaceLandmarker({
    videoRef,
    overlayCanvasRef: canvasRef,
    isStreaming,
    onLivenessComplete: handleLivenessComplete,
  });

  async function handleLivenessComplete(result: {
    passed: boolean;
    metrics: {
      depthVariance: number;
      luminanceScore: number;
      confidenceScore: number;
      sampleCount: number;
      failureReason?: string;
    };
  }) {
    setIsVerifying(true);

    try {
      if (result.passed) {
        const res = await fetch('/api/verify/pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: identity.fullName,
            email: identity.email,
            jobPosition: identity.jobPosition,
            depthVariance: result.metrics.depthVariance,
            luminanceScore: result.metrics.luminanceScore,
            confidenceScore: result.metrics.confidenceScore,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setSuccessPayload(data);
          setFailureInfo(null);
        } else {
          setFailureInfo({
            title: 'Gagal Memproses Verifikasi',
            reason: data.message || 'Terjadi kesalahan sistem.',
          });
        }
      } else {
        let snapshotBase64: string | null = null;
        if (videoRef.current) {
          try {
            const cropResult = await captureAndCropFaceSnapshot(videoRef.current);
            snapshotBase64 = cropResult.dataUrl;
          } catch (e) {
            console.warn('Snapshot capture failed:', e);
          }
        }

        const failReason =
          result.metrics.failureReason ||
          'Wajah tidak terdeteksi sebagai objek 3D asli (terindikasi foto/layar).';

        await fetch('/api/verify/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: identity.fullName,
            email: identity.email,
            jobPosition: identity.jobPosition,
            status: 'SPOOF_FAILED',
            failureReason: failReason,
            depthVariance: result.metrics.depthVariance,
            luminanceScore: result.metrics.luminanceScore,
            confidenceScore: result.metrics.confidenceScore,
            snapshotBase64,
          }),
        });

        setFailureInfo({
          title: 'Verifikasi Gagal: Terdeteksi Objek 2D / Spoofing',
          reason: failReason,
        });
      }
    } catch (err: unknown) {
      console.error('Error sending verification outcome:', err);
      setFailureInfo({
        title: 'Kesalahan Jaringan',
        reason: 'Gagal menghubungi server verifikasi. Silakan coba lagi.',
      });
    } finally {
      setIsVerifying(false);
    }
  }

  const handleStartVerification = async () => {
    if (!identity.fullName.trim() || !identity.email.trim() || !identity.jobPosition.trim()) {
      alert('Harap isi Nama Lengkap, Email, dan Posisi terlebih dahulu.');
      return;
    }

    const camCheck = await checkVirtualCamera();
    if (camCheck.isVirtual) {
      setVirtualCamBlocked(true);
      setVirtualCamName(camCheck.deviceName || 'Virtual Camera Driver');

      await fetch('/api/verify/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: identity.fullName,
          email: identity.email,
          jobPosition: identity.jobPosition,
          status: 'VIRTUAL_CAM_BLOCKED',
          failureReason: `Driver kamera virtual terdeteksi: ${camCheck.deviceName}`,
        }),
      });
      return;
    }

    if (luminanceStatus === 'TOO_DARK') {
      alert('Pencahayaan ruangan terlalu gelap. Silakan cari pencahayaan yang lebih terang.');
      return;
    }

    startLivenessScan();
  };

  const handleRetry = () => {
    setFailureInfo(null);
    resetScan();
  };

  const isFormValid = Boolean(
    identity.fullName.trim() &&
    identity.email.trim() &&
    identity.jobPosition.trim()
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center gap-6">
        <div className="text-center max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel-subtle border border-rose-500/20 text-rose-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>Identity Gateway Wawancara Kerja Online</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Pre-Screening Biometrik &{' '}
            <span className="bg-gradient-to-r from-rose-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
              Passive Liveness
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-rose-200/70 mt-2">
            Verifikasi identitas biometrik 3D sebelum dialihkan ke ruang resmi Zoom Meeting.
          </p>
        </div>

        {virtualCamBlocked && (
          <div className="w-full max-w-4xl glass-panel p-6 rounded-3xl border border-rose-600/80 bg-rose-950/80 shadow-[0_0_50px_rgba(225,29,72,0.3)] animate-shake">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/30 border border-rose-500/60 flex items-center justify-center text-rose-300 shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Akses Diblokir: Terdeteksi Kamera Virtual!
                </h3>
                <p className="text-xs sm:text-sm text-rose-200/90 mt-1">
                  Sistem mendeteksi penggunaan driver kamera virtual (
                  <strong className="text-white font-mono">{virtualCamName}</strong>). Harap gunakan
                  kamera webcam fisik asli perangkat Anda untuk melanjutkan wawancara kerja.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-4xl">
          <IdentityForm
            identity={identity}
            onChange={(updated) => setIdentity((prev) => ({ ...prev, ...updated }))}
            disabled={isScanning || isVerifying || Boolean(successPayload)}
          />
        </div>

        {!isStreaming && !virtualCamBlocked && (
          <div className="w-full max-w-4xl glass-panel p-8 rounded-3xl border border-white/[0.08] text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Aktifkan Kamera Webcam</h3>
              <p className="text-xs sm:text-sm text-rose-200/60 mt-1 max-w-md">
                Klik tombol di bawah untuk memberikan izin akses webcam dan memulai pemeriksaan lingkungan.
              </p>
            </div>
            <button
              onClick={() => startCamera()}
              disabled={isLoadingCamera || !isFormValid}
              className="px-8 py-3.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider bg-gradient-to-r from-rose-600 to-maroon-600 hover:from-rose-500 hover:to-maroon-500 text-white shadow-xl shadow-rose-950/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isLoadingCamera ? 'Membuka Kamera...' : 'Buka & Izinkan Kamera'}
            </button>
            {!isFormValid && (
              <p className="text-[11px] text-rose-300/50">
                * Harap lengkapi formulir identitas di atas terlebih dahulu.
              </p>
            )}
          </div>
        )}

        {isStreaming && !virtualCamBlocked && (
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            isStreaming={isStreaming}
            isLoadingCamera={isLoadingCamera}
            isModelLoading={isModelLoading}
            faceDetected={faceDetected}
            currentVariance={currentVariance}
            currentLuminance={currentLuminance}
            luminanceStatus={luminanceStatus}
            is3DLiveCurrent={is3DLiveCurrent}
            isScanning={isScanning || isVerifying}
            scanProgress={scanProgress}
            errorMessage={cameraError || modelError}
            onStartScan={handleStartVerification}
            canStartScan={isFormValid && luminanceStatus !== 'TOO_DARK'}
          />
        )}

        {failureInfo && (
          <div className="w-full max-w-4xl">
            <FailureAlert
              title={failureInfo.title}
              reason={failureInfo.reason}
              onRetry={handleRetry}
            />
          </div>
        )}

        {successPayload && <SuccessModal payload={successPayload} />}
      </main>

      <footer className="w-full py-6 glass-panel border-t border-white/[0.06] text-center text-xs text-rose-200/50 mt-auto">
        <p>
          &copy; {new Date().getFullYear()} Pre-Screening Identity Gateway &middot; TRPL Computer Vision Research
        </p>
      </footer>
    </div>
  );
}
