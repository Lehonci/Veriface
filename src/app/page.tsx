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
import { AlertTriangle } from 'lucide-react';

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

  const isFormValid = Boolean(
    identity.fullName.trim() &&
    identity.email.trim() &&
    identity.jobPosition.trim()
  );

  const handleStartVerification = async () => {
    if (!isFormValid) {
      alert('Harap lengkapi Nama Lengkap, Email, dan Posisi terlebih dahulu.');
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

  const handleProceedClick = () => {
    if (!isStreaming) {
      startCamera();
    } else {
      handleStartVerification();
    }
  };

  const handleRetry = () => {
    setFailureInfo(null);
    resetScan();
  };

  return (
    <div className="min-h-screen flex flex-col bg-ambient-maroon text-foreground relative overflow-x-hidden selection:bg-rose-500/30 selection:text-rose-200">
      {/* Background Ambient Glowing Blobs for True Glassmorphism Refraction */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-rose-600/25 blur-[150px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-maroon-700/28 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-rose-950/40 blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Floating Capsule Navbar */}
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center gap-8 sm:gap-12">
          {/* Centered Hero Section */}
          <div className="text-center max-w-3xl pt-2 sm:pt-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
              Verifikasi identitas.
              <br />
              <span className="bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
                Masuk dengan percaya diri.
              </span>
            </h1>
            <p className="text-xs sm:text-base text-rose-200/70 mt-4 max-w-xl mx-auto leading-relaxed">
              Sistem pre-screening biometrik 3D liveness detection untuk wawancara kerja online yang aman, cepat, dan terpercaya.
            </p>
          </div>

          {/* Virtual Camera Warning Alert */}
          {virtualCamBlocked && (
            <div className="w-full max-w-6xl glass-panel p-6 rounded-3xl border border-rose-600/80 bg-rose-950/90 shadow-[0_0_50px_rgba(225,29,72,0.35)] animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/30 border border-rose-500/60 flex items-center justify-center text-rose-300 shrink-0 shadow-lg">
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

          {/* Main Desktop App Window (Figma 2-Column macOS Style Frame) */}
          <div className="w-full max-w-6xl glass-panel rounded-[32px] border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.7)] p-6 sm:p-10 relative overflow-hidden backdrop-blur-3xl bg-white/[0.04]">
            {/* macOS Window Title Bar */}
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-white/[0.08]">
              {/* 3 Window Control Dots */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20 inline-block shadow-sm"></span>
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20 inline-block shadow-sm"></span>
                <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20 inline-block shadow-sm"></span>
              </div>

              {/* Title in center */}
              <div className="hidden sm:block text-xs font-mono font-medium text-rose-200/50">
                Identity Gateway &middot; Pre-Screening Liveness Session
              </div>

              {/* Status pill on right */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-semibold text-rose-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Gateway</span>
              </div>
            </div>

            {/* 2-Column Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Left Column: Form & Stepper (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <IdentityForm
                  identity={identity}
                  onChange={(updated) => setIdentity((prev) => ({ ...prev, ...updated }))}
                  disabled={isScanning || isVerifying || Boolean(successPayload)}
                  onProceed={handleProceedClick}
                  isStreaming={isStreaming}
                  canProceed={isFormValid}
                />
              </div>

              {/* Right Column: Prominent Spotlight Camera Viewport (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between">
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
                  onStartCamera={startCamera}
                  onStartScan={handleStartVerification}
                  canStartScan={isFormValid && luminanceStatus !== 'TOO_DARK'}
                />
              </div>
            </div>
          </div>

          {/* Failure Alert Banner if any */}
          {failureInfo && (
            <div className="w-full max-w-6xl">
              <FailureAlert
                title={failureInfo.title}
                reason={failureInfo.reason}
                onRetry={handleRetry}
              />
            </div>
          )}

          {/* Success Modal Overlay */}
          {successPayload && <SuccessModal payload={successPayload} />}
        </main>

        {/* Footer */}
        <footer className="w-full py-6 text-center text-xs text-rose-200/40 border-t border-white/[0.06] mt-auto">
          <p>
            &copy; {new Date().getFullYear()} Pre-Screening Identity Gateway &middot; TRPL Computer Vision Research
          </p>
        </footer>
      </div>
    </div>
  );
}
