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
    // Only flag if active streaming video track is virtual
  }, []);

  const {
    isModelLoading,
    modelError,
    faceDetected,
    currentVariance,
    currentLuminance,
    luminanceStatus,
    is3DLiveCurrent,
    hasAccessory,
    accessoryDetails,
    accessoryReason,
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

        let failureTitle = 'Verifikasi Gagal: Terdeteksi Objek 2D / Spoofing';
        if (failReason.toLowerCase().includes('kacamata')) {
          failureTitle = 'Verifikasi Ditolak: Atribut Kacamata Terdeteksi';
        } else if (failReason.toLowerCase().includes('masker') || failReason.toLowerCase().includes('penutup')) {
          failureTitle = 'Verifikasi Ditolak: Atribut Masker / Penutup Muka Terdeteksi';
        }

        setFailureInfo({
          title: failureTitle,
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

  // Validate email strictly (must contain @ and dot domain, e.g. user@domain.com)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim());
  const isFullNameValid = identity.fullName.trim().length >= 2;
  const isPositionValid = identity.jobPosition.trim().length >= 2;

  const isFormValid = Boolean(
    isFullNameValid &&
    isEmailValid &&
    isPositionValid
  );

  const handleStartVerification = async () => {
    if (!isFullNameValid) {
      alert('Harap isi Nama Lengkap Anda dengan benar.');
      return;
    }
    if (!isEmailValid) {
      alert('Format email tidak valid. Email harus mengandung tanda @ dan domain yang sah (contoh: nama@gmail.com).');
      return;
    }
    if (!isPositionValid) {
      alert('Harap isi Posisi yang Dilamar');
      return;
    }

    // Check if the currently used camera track is actually a virtual camera
    let isVirtual = false;
    let trackLabel = '';
    if (videoRef.current && videoRef.current.srcObject) {
      const ms = videoRef.current.srcObject as MediaStream;
      const vt = ms.getVideoTracks()[0];
      if (vt) {
        trackLabel = vt.label;
        if (/obs|virtual|manycam|splitcam|vcam|droidcam|iriun|fake/i.test(trackLabel)) {
          isVirtual = true;
        }
      }
    }

    if (isVirtual) {
      setVirtualCamBlocked(true);
      setVirtualCamName(trackLabel || 'Virtual Camera Driver');

      await fetch('/api/verify/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: identity.fullName,
          email: identity.email,
          jobPosition: identity.jobPosition,
          status: 'VIRTUAL_CAM_BLOCKED',
          failureReason: `Driver kamera virtual terdeteksi: ${trackLabel}`,
        }),
      });
      return;
    }

    // Warning instead of strict blocking if lighting is low
    if (luminanceStatus === 'TOO_DARK') {
      console.warn('Low ambient light detected, proceeding with caution.');
    }

    startLivenessScan();
  };

  const handleProceedClick = () => {
    if (!isFullNameValid) {
      alert('Harap isi Nama Lengkap Anda terlebih dahulu.');
      return;
    }
    if (!isEmailValid) {
      alert('Format email tidak valid. Email harus mengandung tanda @ dan domain yang sah (contoh: nama@gmail.com).');
      return;
    }
    if (!isPositionValid) {
      alert('Harap isi Posisi yang Dilamar.');
      return;
    }

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
    <div className="min-h-screen flex flex-col bg-ambient-maroon text-foreground relative overflow-x-hidden selection:bg-[#7B2E46]/20 selection:text-[#7B2E46]">
      {/* Background Ambient Glowing Blobs for True Glassmorphism Refraction */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-[#EBD8C7]/50 blur-[150px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[#F5E2D3]/40 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-[#DFCEBD]/50 blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Floating Capsule Navbar */}
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center gap-8 sm:gap-10">
          {/* Centered Hero Section with Inverted Deep Wine & Crimson Headings */}
          <div className="text-center max-w-3xl pt-2 sm:pt-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-[#2B0E17] tracking-tight leading-[1.08]">
              Verifikasi identitas.
              <br />
              Masuk dengan percaya
              <br />
              diri.
            </h1>
            <p className="text-xs sm:text-sm text-[#6E4250] mt-4 max-w-lg mx-auto leading-relaxed font-medium">
              Satu langkah aman sebelum sesi interview Anda. Tanpa akun, tanpa instalasi,
              <br className="hidden sm:inline" /> selesai dalam hitungan detik.
            </p>
          </div>

          {/* Virtual Camera Warning Alert */}
          {virtualCamBlocked && (
            <div className="w-full max-w-5xl glass-panel p-5 rounded-2xl border border-rose-400 bg-rose-50/90 shadow-xl animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950">
                    Akses Diblokir: Terdeteksi Kamera Virtual!
                  </h3>
                  <p className="text-xs text-rose-900/90 mt-0.5">
                    Sistem mendeteksi penggunaan driver kamera virtual (
                    <strong className="text-rose-950 font-mono">{virtualCamName}</strong>). Harap gunakan
                    kamera webcam fisik asli perangkat Anda untuk melanjutkan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Desktop App Window (Frosted Cream macOS Style Frame) */}
          <div className="w-full max-w-5xl glass-panel rounded-[28px] border border-[#7B2E46]/12 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
  
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
                  hasAccessory={hasAccessory}
                  accessoryDetails={accessoryDetails}
                  accessoryReason={accessoryReason}
                  isScanning={isScanning || isVerifying}
                  scanProgress={scanProgress}
                  errorMessage={cameraError || modelError}
                  onStartCamera={startCamera}
                  onStartScan={handleStartVerification}
                  canStartScan={isFormValid}
                />
              </div>
            </div>
          </div>

          {/* Failure Alert Banner if any (aligned precisely with max-w-5xl) */}
          {failureInfo && (
            <div className="w-full max-w-5xl">
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
        <footer className="w-full py-6 text-center text-xs text-[#7A4B58] border-t border-[#7B2E46]/10 mt-auto">
          <p>
            Copyright &copy; {new Date().getFullYear()}, Key Pick Key Run, All Rights Reserved
          </p>
        </footer>
      </div>
    </div>
  );
}
