import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import {
  calculateFaceDepthVariance,
  aggregateMultiFrameLiveness,
  DepthAnalysisResult,
  LandmarkPoint,
} from '@/lib/cv/depthVariance';
import { calculateLuminanceFromVideo, LuminanceResult } from '@/lib/cv/luminance';
import { checkFacialAccessories, FacialAccessoryCheckResult } from '@/lib/cv/facialAccessories';
import { checkVirtualCamera } from '@/lib/cv/virtualCamera';
import {
  ActiveChallengeStep,
  ActiveChallengeTracker,
  ActiveLivenessStatus,
  computeHeadYawRatio,
  createActiveChallengeTracker,
  getChallengeFailureDetail,
  HEAD_YAW_CENTER_THRESHOLD,
  updateActiveChallengeTracker,
} from '@/lib/cv/activeLiveness';
import {
  evaluateVideoFrame,
  getActiveThresholdValue,
  VerifaceResult,
  VerifaceStatus,
} from '@/lib/verifaceEngine';

export interface UseFaceLandmarkerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  activeDeviceLabel?: string | null;
  onLivenessComplete?: (result: {
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
    activeLiveness: {
      blinkDetected: boolean;
      turnRightDetected: boolean;
      turnLeftDetected: boolean;
    };
    latestLandmarks: LandmarkPoint[];
    snapshotBase64?: string;
  }) => void;
}

export interface UseFaceLandmarkerReturn {
  isModelLoading: boolean;
  modelError: string | null;
  faceDetected: boolean;
  currentVariance: number;
  currentLuminance: number;
  luminanceStatus: 'TOO_DARK' | 'OPTIMAL' | 'TOO_BRIGHT';
  is3DLiveCurrent: boolean;
  hasAccessory: boolean;
  accessoryDetails: string[];
  accessoryReason: string | null;
  isScanning: boolean;
  scanProgress: number;
  activeChallenge: ActiveLivenessStatus | null;
  startLivenessScan: () => void;
  resetScan: () => void;
  latestLandmarks: LandmarkPoint[];
}

const FRONTAL_MIN_MS = 1100;
const FRONTAL_MAX_WAIT_MS = 2200;
const ACTIVE_CHALLENGE_TIMEOUT_MS = 20000;
const ONNX_SAMPLE_INTERVAL_MS = 450;

function getChallengeProgress(step: ActiveChallengeStep, elapsed: number): number {
  switch (step) {
    case 'FRONTAL_CALIBRATION':
      return Math.min(24, Math.round((elapsed / FRONTAL_MIN_MS) * 24));
    case 'BLINK':
      return 30;
    case 'TURN_RIGHT':
      return 55;
    case 'TURN_LEFT':
      return 80;
    case 'RETURN_CENTER':
      return 95;
  }
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useFaceLandmarker({
  videoRef,
  overlayCanvasRef,
  isStreaming,
  activeDeviceLabel,
  onLivenessComplete,
}: UseFaceLandmarkerOptions): UseFaceLandmarkerReturn {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [faceDetected, setFaceDetected] = useState(false);
  const [currentVariance, setCurrentVariance] = useState(0);
  const [currentLuminance, setCurrentLuminance] = useState(60);
  const [luminanceStatus, setLuminanceStatus] = useState<'TOO_DARK' | 'OPTIMAL' | 'TOO_BRIGHT'>('OPTIMAL');
  const [is3DLiveCurrent, setIs3DLiveCurrent] = useState(false);

  // Facial accessory state
  const [hasAccessory, setHasAccessory] = useState(false);
  const [accessoryDetails, setAccessoryDetails] = useState<string[]>([]);
  const [accessoryReason, setAccessoryReason] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeChallenge, setActiveChallenge] = useState<ActiveLivenessStatus | null>(null);
  const [latestLandmarks, setLatestLandmarks] = useState<LandmarkPoint[]>([]);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<DepthAnalysisResult[]>([]);
  const accessoryBufferRef = useRef<FacialAccessoryCheckResult[]>([]);
  const scanStartTimeRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const luminanceSamplesRef = useRef<number[]>([]);
  const challengeTrackerRef = useRef<ActiveChallengeTracker>(createActiveChallengeTracker());
  const latestLandmarksRef = useRef<LandmarkPoint[]>([]);

  // Multi-frame ONNX voting refs (Plot Hole #8)
  const onnxSamplesRef = useRef<VerifaceResult[]>([]);
  const onnxInFlightPromiseRef = useRef<Promise<VerifaceResult | null> | null>(null);
  const lastOnnxSampleTimeRef = useRef<number>(0);

  // Filter log benign INFO XNNPACK dari MediaPipe WebAssembly agar tidak memicu pop-up merah Next.js Dev Error
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (
        msg.includes('INFO: Created TensorFlow Lite XNNPACK delegate') ||
        msg.includes('XNNPACK delegate for CPU')
      ) {
        console.info(...args);
        return;
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initModel() {
      setIsModelLoading(true);
      setModelError(null);

      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        if (!isMounted) return;

        const faceLandmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }
        );

        if (isMounted) {
          landmarkerRef.current = faceLandmarker;
          setIsModelLoading(false);
        }
      } catch (err: unknown) {
        console.error('Error initializing MediaPipe FaceLandmarker:', err);
        if (isMounted) {
          setModelError('Gagal memuat modul Computer Vision. Pastikan koneksi internet stabil.');
          setIsModelLoading(false);
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  const finalizeScan = useCallback(
    async (
      video: HTMLVideoElement,
      liveTrackLabel: string,
      landmarks: LandmarkPoint[],
      timedOut: boolean
    ) => {
      if (onnxInFlightPromiseRef.current) {
        await onnxInFlightPromiseRef.current;
      }
      if (onnxSamplesRef.current.length === 0 && !timedOut && landmarks.length >= 400) {
        try {
          const finalSample = await evaluateVideoFrame(video, liveTrackLabel, landmarks);
          onnxSamplesRef.current.push(finalSample);
        } catch (err) {
          console.warn('Evaluasi akhir model ONNX gagal:', err);
        }
      }

      const mediaStream = video.srcObject as MediaStream | null;
      const activeTrack = mediaStream?.getVideoTracks?.()[0];
      const vcamCheck = await checkVirtualCamera(activeTrack);
      const onnxSamples = onnxSamplesRef.current;
      const aggregated = aggregateMultiFrameLiveness(sampleBufferRef.current);

      const avgLuminance =
        luminanceSamplesRef.current.length > 0
          ? luminanceSamplesRef.current.reduce((a, b) => a + b, 0) /
            luminanceSamplesRef.current.length
          : 60;

      const accessoryCount = accessoryBufferRef.current.filter((a) => a.hasAccessory).length;
      const hasPersistentAccessory =
        accessoryCount / (accessoryBufferRef.current.length || 1) >= 0.5;
      const mostFrequentReason = accessoryBufferRef.current.find((a) => a.reason)?.reason;

      const scores = onnxSamples
        .map((s) => s.livenessScore)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const lumas = onnxSamples
        .map((s) => s.luma)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

      const medianLiveness =
        scores.length > 0 ? computeMedian(scores) : aggregated.averageConfidence;
      const finalLuma =
        lumas.length > 0
          ? Math.round(computeMedian(lumas) * 10) / 10
          : Math.round(avgLuminance * 10) / 10;

      const lightHoldCount = onnxSamples.filter((s) => s.status === 'HOLD_LIGHT').length;
      const occHoldCount = onnxSamples.filter((s) => s.status === 'HOLD_OCCLUSION').length;
      const vcamBlockedSample = onnxSamples.find((s) => s.status === 'VIRTUAL_CAM_BLOCKED');

      const activeThreshold = getActiveThresholdValue();
      const tracker = challengeTrackerRef.current;
      const activeCompleted =
        !timedOut &&
        tracker.blinkDetected &&
        tracker.turnRightDetected &&
        tracker.turnLeftDetected;

      let finalStatus: VerifaceStatus = 'SPOOF_FAILED';
      let finalFailureReason: string | undefined = undefined;
      let virtualCameraName: string | undefined = undefined;

      if (vcamBlockedSample || vcamCheck.isVirtual) {
        finalStatus = 'VIRTUAL_CAM_BLOCKED';
        virtualCameraName =
          vcamCheck.deviceName || liveTrackLabel || 'Virtual Camera Driver';
        finalFailureReason =
          vcamBlockedSample?.message ||
          `Driver kamera virtual terdeteksi: ${virtualCameraName}`;
      } else if (onnxSamples.length > 0 && lightHoldCount / onnxSamples.length >= 0.5) {
        finalStatus = 'HOLD_LIGHT';
        finalFailureReason =
          onnxSamples.find((s) => s.status === 'HOLD_LIGHT')?.message ||
          'Pencahayaan ruangan terlalu redup. Pindah ke area yang lebih terang.';
      } else if (
        hasPersistentAccessory ||
        (onnxSamples.length > 0 && occHoldCount / onnxSamples.length >= 0.5)
      ) {
        finalStatus = 'HOLD_OCCLUSION';
        finalFailureReason =
          mostFrequentReason ||
          'Terdeteksi atribut pada wajah (kacamata/masker). Harap lepas atribut terlebih dahulu.';
      } else if (!activeCompleted) {
        finalStatus = 'SPOOF_FAILED';
        finalFailureReason = getChallengeFailureDetail(tracker);
      } else if (scores.length > 0) {
        if (medianLiveness >= activeThreshold) {
          finalStatus = 'PASSED';
        } else {
          finalStatus = 'SPOOF_FAILED';
          finalFailureReason = `Terdeteksi indikasi foto cetak atau layar perangkat (Median ${onnxSamples.length} frame: ${(medianLiveness * 100).toFixed(1)}% < ambang ${(activeThreshold * 100).toFixed(1)}%).`;
        }
      } else {
        finalStatus = 'SPOOF_FAILED';
        finalFailureReason =
          'Model AI Liveness belum siap atau gagal dimuat di browser. Muat ulang halaman dan coba kembali.';
      }

      const passingSampleWithSnap =
        finalStatus === 'PASSED'
          ? [...onnxSamples]
              .filter(
                (s) =>
                  Boolean(s.snapshotBase64) &&
                  typeof s.livenessScore === 'number' &&
                  s.livenessScore >= activeThreshold
              )
              .sort((a, b) => (b.livenessScore ?? 0) - (a.livenessScore ?? 0))[0]
          : undefined;

      const bestSnapshot =
        passingSampleWithSnap?.snapshotBase64 ||
        [...onnxSamples].reverse().find((s) => Boolean(s.snapshotBase64))?.snapshotBase64;

      const reportedConfidence =
        finalStatus === 'PASSED' && typeof passingSampleWithSnap?.livenessScore === 'number'
          ? Math.max(medianLiveness, passingSampleWithSnap.livenessScore)
          : medianLiveness;

      setActiveChallenge(null);

      if (onLivenessComplete) {
        onLivenessComplete({
          passed: finalStatus === 'PASSED',
          status: finalStatus,
          virtualCameraName,
          metrics: {
            depthVariance: aggregated.medianVariance,
            luminanceScore: finalLuma,
            confidenceScore: scores.length > 0 ? reportedConfidence : 0,
            sampleCount: Math.max(sampleBufferRef.current.length, onnxSamples.length),
            failureReason: finalStatus === 'PASSED' ? undefined : finalFailureReason,
          },
          activeLiveness: {
            blinkDetected: tracker.blinkDetected,
            turnRightDetected: tracker.turnRightDetected,
            turnLeftDetected: tracker.turnLeftDetected,
          },
          latestLandmarks: landmarks,
          snapshotBase64: bestSnapshot,
        });
      }
    },
    [onLivenessComplete]
  );

  const runDetection = useCallback(() => {
    if (
      !landmarkerRef.current ||
      !videoRef.current ||
      !isStreaming ||
      videoRef.current.readyState < 2
    ) {
      animationFrameIdRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const video = videoRef.current;
    const nowInMs = performance.now();

    try {
      const results: FaceLandmarkerResult = landmarkerRef.current.detectForVideo(
        video,
        nowInMs
      );

      if (overlayCanvasRef?.current) {
        const canvas = overlayCanvasRef.current;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const lumaRes: LuminanceResult = calculateLuminanceFromVideo(video);
          setCurrentLuminance(lumaRes.score);
          setLuminanceStatus(lumaRes.status);
          luminanceSamplesRef.current.push(lumaRes.score);

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
            ctx.shadowColor = 'rgba(225, 29, 72, 0.6)';
            ctx.shadowBlur = 4;

            for (let i = 0; i < landmarks.length; i += 3) {
              const pt = landmarks[i];
              const px = pt.x * canvas.width;
              const py = pt.y * canvas.height;
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        }
      }

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0] as LandmarkPoint[];
        setFaceDetected(true);
        setLatestLandmarks(landmarks);
        latestLandmarksRef.current = landmarks;

        const depthAnalysis = calculateFaceDepthVariance(landmarks);
        setCurrentVariance(depthAnalysis.variance);
        setIs3DLiveCurrent(depthAnalysis.is3DLive);

        // Check facial accessories (glasses, sunglasses, mask, coverings)
        const accessoryResult = checkFacialAccessories(landmarks, video);
        setHasAccessory(accessoryResult.hasAccessory);
        setAccessoryDetails(accessoryResult.accessoryDetails);
        setAccessoryReason(accessoryResult.reason || null);

        if (isScanningRef.current) {
          const yaw = computeHeadYawRatio(landmarks);
          const isFrontal = Math.abs(yaw) <= HEAD_YAW_CENTER_THRESHOLD;

          // Sampel geometri kedalaman, oklusi & ONNX hanya saat posisi wajah menghadap depan
          if (Math.abs(yaw) <= 0.24) {
            sampleBufferRef.current.push(depthAnalysis);
            accessoryBufferRef.current.push(accessoryResult);
          }

          const mediaStream = video.srcObject as MediaStream | null;
          const activeTrack = mediaStream?.getVideoTracks?.()[0];
          const liveTrackLabel = activeDeviceLabel || activeTrack?.label || '';

          if (
            isFrontal &&
            (challengeTrackerRef.current.step === 'FRONTAL_CALIBRATION' ||
              challengeTrackerRef.current.step === 'RETURN_CENTER' ||
              onnxSamplesRef.current.length < 3) &&
            !onnxInFlightPromiseRef.current &&
            nowInMs - lastOnnxSampleTimeRef.current >= ONNX_SAMPLE_INTERVAL_MS
          ) {
            lastOnnxSampleTimeRef.current = nowInMs;
            const promise = evaluateVideoFrame(video, liveTrackLabel, landmarks)
              .then((res) => {
                onnxSamplesRef.current.push(res);
                return res;
              })
              .catch((err) => {
                console.warn('Sampling frame ONNX gagal:', err);
                return null;
              })
              .finally(() => {
                if (onnxInFlightPromiseRef.current === promise) {
                  onnxInFlightPromiseRef.current = null;
                }
              });
            onnxInFlightPromiseRef.current = promise;
          }

          const elapsed = nowInMs - (scanStartTimeRef.current || nowInMs);
          const calibrationReady =
            elapsed >= FRONTAL_MIN_MS &&
            (onnxSamplesRef.current.length >= 2 || elapsed >= FRONTAL_MAX_WAIT_MS);

          const challengeStatus = updateActiveChallengeTracker(
            challengeTrackerRef.current,
            landmarks,
            calibrationReady
          );
          setActiveChallenge(challengeStatus);

          const activeAllDone =
            challengeStatus.step === 'RETURN_CENTER' &&
            challengeStatus.blinkDetected &&
            challengeStatus.turnRightDetected &&
            challengeStatus.turnLeftDetected &&
            isFrontal;
          const timedOut = elapsed >= ACTIVE_CHALLENGE_TIMEOUT_MS;

          setScanProgress(
            activeAllDone ? 100 : getChallengeProgress(challengeStatus.step, elapsed)
          );

          if (activeAllDone || timedOut) {
            isScanningRef.current = false;
            setIsScanning(false);
            void finalizeScan(video, liveTrackLabel, landmarks, timedOut);
          }
        }
      } else {
        setFaceDetected(false);
        setIs3DLiveCurrent(false);
        setHasAccessory(false);
        setAccessoryDetails([]);
        setAccessoryReason(null);

        if (isScanningRef.current) {
          const elapsed = nowInMs - (scanStartTimeRef.current || nowInMs);
          if (elapsed >= ACTIVE_CHALLENGE_TIMEOUT_MS) {
            isScanningRef.current = false;
            setIsScanning(false);
            const mediaStream = video.srcObject as MediaStream | null;
            const activeTrack = mediaStream?.getVideoTracks?.()[0];
            const liveTrackLabel = activeDeviceLabel || activeTrack?.label || '';
            void finalizeScan(video, liveTrackLabel, latestLandmarksRef.current, true);
          }
        }
      }
    } catch (err) {
      console.warn('MediaPipe detection frame error:', err);
    }

    animationFrameIdRef.current = requestAnimationFrame(runDetection);
  }, [isStreaming, activeDeviceLabel, finalizeScan, overlayCanvasRef, videoRef]);

  useEffect(() => {
    if (isStreaming && !isModelLoading && landmarkerRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(runDetection);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isStreaming, isModelLoading, runDetection]);

  const startLivenessScan = useCallback(() => {
    sampleBufferRef.current = [];
    accessoryBufferRef.current = [];
    luminanceSamplesRef.current = [];
    onnxSamplesRef.current = [];
    onnxInFlightPromiseRef.current = null;
    lastOnnxSampleTimeRef.current = 0;
    const tracker = createActiveChallengeTracker();
    challengeTrackerRef.current = tracker;
    setActiveChallenge({
      step: tracker.step,
      blinkDetected: false,
      turnRightDetected: false,
      turnLeftDetected: false,
      ear: 0.28,
      yaw: 0,
    });
    scanStartTimeRef.current = performance.now();
    isScanningRef.current = true;
    setIsScanning(true);
    setScanProgress(0);
  }, []);

  const resetScan = useCallback(() => {
    isScanningRef.current = false;
    setIsScanning(false);
    setScanProgress(0);
    setActiveChallenge(null);
    challengeTrackerRef.current = createActiveChallengeTracker();
    sampleBufferRef.current = [];
    accessoryBufferRef.current = [];
    luminanceSamplesRef.current = [];
    onnxSamplesRef.current = [];
    onnxInFlightPromiseRef.current = null;
    lastOnnxSampleTimeRef.current = 0;
    setHasAccessory(false);
    setAccessoryDetails([]);
    setAccessoryReason(null);
  }, []);

  return {
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
  };
}
