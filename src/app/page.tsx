'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { IdentityForm } from '@/components/IdentityForm';
import { CameraView } from '@/components/CameraView';
import { SuccessModal } from '@/components/SuccessModal';
import { FailureAlert } from '@/components/FailureAlert';
import { WaitingApprovalModal } from '@/components/WaitingApprovalModal';
import { useCamera } from '@/hooks/useCamera';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { checkVirtualCamera } from '@/lib/cv/virtualCamera';
import { captureAndCropFaceSnapshot } from '@/lib/cv/cropFace';
import {
  ApplicantIdentity,
  VerificationSuccessPayload,
} from '@/types';
import { AlertTriangle } from 'lucide-react';
import { initVerifaceEngine, VerifaceStatus } from '@/lib/verifaceEngine';
import { LandmarkPoint } from '@/lib/cv/depthVariance';

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
  const [failureInfo, setFailureInfo] = useState<{
    title: string;
    reason: string;
    verificationId?: string;
    statusToken?: string;
  } | null>(null);
  const [waitingModalState, setWaitingModalState] = useState<{
    verificationId: string;
    statusToken?: string;
    mode: 'passed' | 'appeal';
    initialTimeout: number;
  } | null>(null);
  const [isRequestingAppeal, setIsRequestingAppeal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const challengeTokenRef = useRef<string | null>(null);

  const {
    videoRef,
    isStreaming,
    isLoading: isLoadingCamera,
    error: cameraError,
    startCamera,
    activeDeviceLabel,
  } = useCamera();

  const issueFreshChallenge = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/verify/challenge', {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.challengeToken) {
        challengeTokenRef.current = data.challengeToken;
        return data.challengeToken as string;
      }
    } catch (err) {
      console.warn('Gagal mengambil token sesi scan:', err);
    }
    return null;
  }, []);

  // Prapemuatan model AI ONNX saat halaman dibuka
  useEffect(() => {
    initVerifaceEngine().catch((err) => {
      console.warn('Pre-warming Veriface ONNX Engine in background...', err);
    });
  }, []);

  // Terbitkan scan challenge saat kamera mulai aktif
  useEffect(() => {
    if (isStreaming && !challengeTokenRef.current) {
      issueFreshChallenge();
    }
  }, [isStreaming, issueFreshChallenge]);

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
    activeChallenge,
    startLivenessScan,
    resetScan,
    latestLandmarks,
  } = useFaceLandmarker({
    videoRef,
    overlayCanvasRef: canvasRef,
    isStreaming,
    activeDeviceLabel,
    onLivenessComplete: handleLivenessComplete,
  });

  async function handleLivenessComplete(result: {
    passed: boolean;
    status: VerifaceStatus;
    virtualCameraName?: string;
    metrics: {
      depthVariance: number;
      luminanceScore: number;
      confidenceScore: number;
      sampleCount: number;
      failureReason?: string;
    };
    activeLiveness?: {
      blinkDetected: boolean;
      turnRightDetected: boolean;
      turnLeftDetected: boolean;
    };
    latestLandmarks?: LandmarkPoint[];
    snapshotBase64?: string;
  }) {
    setIsVerifying(true);
    const activeChallenge = challengeTokenRef.current || (await issueFreshChallenge());
    challengeTokenRef.current = null;

    try {
      // 1. Jika HOLD_OCCLUSION: jangan catat sebagai insiden spoofing/pencahayaan — tahan & minta lepas atribut
      if (result.status === 'HOLD_OCCLUSION') {
        setFailureInfo({
          title: 'Pemindaian Ditahan: Lepas Masker atau Kacamata',
          reason:
            result.metrics.failureReason ||
            'Terdeteksi masker atau kacamata di wajah Anda. Harap lepas terlebih dahulu lalu pindai ulang.',
        });
        return;
      }

      let snapshotBase64: string | null = result.snapshotBase64 || null;
      if (!snapshotBase64 && videoRef.current) {
        try {
          const lms = result.latestLandmarks || latestLandmarks;
          const cropResult = await captureAndCropFaceSnapshot(videoRef.current, lms);
          snapshotBase64 = cropResult.dataUrl;
        } catch (e) {
          console.warn('Snapshot capture failed:', e);
        }
      }

      if (result.passed && result.status === 'PASSED') {
        const res = await fetch('/api/verify/pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            fullName: identity.fullName,
            email: identity.email,
            jobPosition: identity.jobPosition,
            depthVariance: result.metrics.depthVariance,
            luminanceScore: result.metrics.luminanceScore,
            confidenceScore: result.metrics.confidenceScore,
            snapshotBase64,
            challengeToken: activeChallenge,
            virtualCameraDetected: false,
            activeLiveness: result.activeLiveness,
          }),
        });

        const data: VerificationSuccessPayload & { message?: string } = await res.json();
        if (data.success) {
          setFailureInfo(null);
          if (data.requiresApproval && data.verificationId) {
            setWaitingModalState({
              verificationId: data.verificationId,
              statusToken: data.statusToken,
              mode: 'passed',
              initialTimeout: data.autoAdmitTimeout || 30,
            });
          } else {
            setSuccessPayload(data);
          }
        } else {
          setFailureInfo({
            title: 'Gagal Memproses Verifikasi',
            reason: data.message || 'Terjadi kesalahan sistem.',
          });
        }
      } else if (result.status === 'VIRTUAL_CAM_BLOCKED') {
        const camName = result.virtualCameraName || activeDeviceLabel || 'Virtual Camera Driver';
        setVirtualCamBlocked(true);
        setVirtualCamName(camName);

        await fetch('/api/verify/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            fullName: identity.fullName,
            email: identity.email,
            jobPosition: identity.jobPosition,
            status: 'VIRTUAL_CAM_BLOCKED',
            failureReason: result.metrics.failureReason || `Driver kamera virtual terdeteksi: ${camName}`,
            depthVariance: result.metrics.depthVariance,
            luminanceScore: result.metrics.luminanceScore,
            confidenceScore: result.metrics.confidenceScore,
            snapshotBase64,
            challengeToken: activeChallenge,
          }),
        }).catch(() => {});

        setFailureInfo({
          title: 'Akses Diblokir: Kamera Virtual Terdeteksi',
          reason: `Sistem mendeteksi perangkat kamera virtual (${camName}). Gunakan webcam fisik asli Anda.`,
        });
      } else if (result.status === 'HOLD_LIGHT') {
        const lightReason =
          result.metrics.failureReason ||
          'Pencahayaan ruangan terlalu redup. Silakan nyalakan lampu atau arahkan wajah ke sumber cahaya.';

        const failRes = await fetch('/api/verify/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            fullName: identity.fullName,
            email: identity.email,
            jobPosition: identity.jobPosition,
            status: 'POOR_LIGHTING',
            failureReason: lightReason,
            depthVariance: result.metrics.depthVariance,
            luminanceScore: result.metrics.luminanceScore,
            confidenceScore: result.metrics.confidenceScore,
            snapshotBase64,
            challengeToken: activeChallenge,
          }),
        });
        const failData = await failRes.json().catch(() => ({}));

        setFailureInfo({
          title: 'Verifikasi Ditolak: Pencahayaan Ruangan Kurang',
          reason: lightReason,
          verificationId: failData.verificationId,
          statusToken: failData.statusToken,
        });
      } else {
        const failReason =
          result.metrics.failureReason ||
          'Wajah tidak terdeteksi sebagai objek 3D asli (terindikasi foto/layar).';

        const failRes = await fetch('/api/verify/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
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
            challengeToken: activeChallenge,
          }),
        });
        const failData = await failRes.json().catch(() => ({}));

        setFailureInfo({
          title: 'Verifikasi Gagal: Terdeteksi Objek 2D / Spoofing',
          reason: failReason,
          verificationId: failData.verificationId,
          statusToken: failData.statusToken,
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

  const isFullNameValid = identity.fullName.trim().length > 1;
  const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(identity.email.trim());
  const isPositionValid = identity.jobPosition.trim().length > 1;
  const isFormValid = isFullNameValid && isEmailValid && isPositionValid;

  const handleStartVerification = async () => {
    setFailureInfo(null);
    setVirtualCamBlocked(false);

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
    if (hasAccessory) {
      alert(
        accessoryReason ||
          'Terdeteksi atribut pada wajah (kacamata atau masker). Harap lepas atribut terlebih dahulu untuk melanjutkan pemindaian.'
      );
      return;
    }
    if (!faceDetected) {
      alert('Wajah belum terdeteksi. Posisikan wajah Anda di dalam area panduan kamera.');
      return;
    }

    // Pastikan scan challenge tersedia sebelum verifikasi / pemblokiran kamera virtual
    if (!challengeTokenRef.current) {
      await issueFreshChallenge();
    }

    const ms = videoRef.current?.srcObject as MediaStream | null;
    const vt = ms?.getVideoTracks?.()[0];
    const vcamResult = await checkVirtualCamera(vt);

    if (vcamResult.isVirtual) {
      const detectedName = vcamResult.deviceName || activeDeviceLabel || vt?.label || 'Virtual Camera Driver';
      setVirtualCamBlocked(true);
      setVirtualCamName(detectedName);

      const failChallenge = challengeTokenRef.current || (await issueFreshChallenge());
      challengeTokenRef.current = null;

      await fetch('/api/verify/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          fullName: identity.fullName,
          email: identity.email,
          jobPosition: identity.jobPosition,
          status: 'VIRTUAL_CAM_BLOCKED',
          failureReason: `Driver kamera virtual terdeteksi: ${detectedName}`,
          challengeToken: failChallenge,
        }),
      }).catch(() => {});
      return;
    }

    // Jalankan pemindaian liveness multi-frame MediaPipe & voting ONNX Veriface Model
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
    setWaitingModalState(null);
    setVirtualCamBlocked(false);
    challengeTokenRef.current = null;
    if (isStreaming) {
      issueFreshChallenge();
    }
    resetScan();
  };

  const handleRequestAppeal = async () => {
    if (!failureInfo?.verificationId) return;
    setIsRequestingAppeal(true);
    try {
      const res = await fetch('/api/verify/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          verificationId: failureInfo.verificationId,
          statusToken: failureInfo.statusToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWaitingModalState({
          verificationId: failureInfo.verificationId,
          statusToken: failureInfo.statusToken,
          mode: 'appeal',
          initialTimeout: data.timeoutSeconds || 60,
        });
      }
    } catch (err) {
      console.error('Appeal request failed:', err);
    } finally {
      setIsRequestingAppeal(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-ambient-maroon text-foreground relative overflow-x-hidden selection:bg-[#7B2E46]/20 selection:text-[#7B2E46]">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-[#EBD8C7]/50 blur-[150px] animate-pulse-glow" />
        <div className="absolute top-[35%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-[#F5E2D3]/40 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[5%] w-[50vw] h-[50vw] rounded-full bg-[#DFCEBD]/50 blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center gap-8 sm:gap-10">
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

          <div className="w-full max-w-5xl glass-panel rounded-[28px] border border-[#7B2E46]/12 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-5 flex flex-col justify-between">
                <IdentityForm
                  identity={identity}
                  onChange={(updated) => setIdentity((prev) => ({ ...prev, ...updated }))}
                  disabled={isScanning || isVerifying || Boolean(successPayload) || Boolean(waitingModalState)}
                  onProceed={handleProceedClick}
                  isStreaming={isStreaming}
                  canProceed={isFormValid && (!isStreaming || (!hasAccessory && faceDetected))}
                  isScanning={isScanning || isVerifying}
                  hasAccessory={hasAccessory}
                  accessoryReason={accessoryReason}
                  faceDetected={faceDetected}
                />
              </div>

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
                  activeChallenge={activeChallenge}
                  errorMessage={cameraError || modelError}
                  onStartCamera={startCamera}
                  canStartScan={isFormValid}
                />
              </div>
            </div>
          </div>

          {failureInfo && !waitingModalState && !successPayload && (
            <FailureAlert
              title={failureInfo.title}
              reason={failureInfo.reason}
              onRetry={handleRetry}
              canAppeal={Boolean(failureInfo.verificationId) && !virtualCamBlocked}
              isRequestingAppeal={isRequestingAppeal}
              onRequestAppeal={handleRequestAppeal}
              isAuditLogged={Boolean(failureInfo.verificationId) || virtualCamBlocked}
            />
          )}

          {waitingModalState && (
            <WaitingApprovalModal
              verificationId={waitingModalState.verificationId}
              statusToken={waitingModalState.statusToken}
              applicantName={identity.fullName}
              mode={waitingModalState.mode}
              initialTimeoutSeconds={waitingModalState.initialTimeout}
              onApproved={(payload) => {
                setWaitingModalState(null);
                setFailureInfo(null);
                setSuccessPayload(payload);
              }}
              onRejected={(reason) => {
                const prevId = waitingModalState.verificationId;
                const prevSt = waitingModalState.statusToken;
                setWaitingModalState(null);
                setFailureInfo({
                  title: 'Verifikasi Ditolak oleh Administrator',
                  reason,
                  verificationId: prevId,
                  statusToken: prevSt,
                });
              }}
              onCancel={handleRetry}
            />
          )}

          {successPayload && <SuccessModal payload={successPayload} />}
        </main>

        <footer className="w-full py-6 text-center text-xs text-[#7A4B58] border-t border-[#7B2E46]/10 mt-auto">
          <p>
            Copyright &copy; {new Date().getFullYear()}, Veriface, All Rights Reserved
          </p>
        </footer>
      </div>
    </div>
  );
}
