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

export interface UseFaceLandmarkerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  onLivenessComplete?: (result: {
    passed: boolean;
    metrics: {
      depthVariance: number;
      luminanceScore: number;
      confidenceScore: number;
      sampleCount: number;
      failureReason?: string;
    };
    latestLandmarks: LandmarkPoint[];
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
  startLivenessScan: () => void;
  resetScan: () => void;
  latestLandmarks: LandmarkPoint[];
}

const SAMPLE_DURATION_MS = 2500;

export function useFaceLandmarker({
  videoRef,
  overlayCanvasRef,
  isStreaming,
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
  const [latestLandmarks, setLatestLandmarks] = useState<LandmarkPoint[]>([]);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<DepthAnalysisResult[]>([]);
  const accessoryBufferRef = useRef<FacialAccessoryCheckResult[]>([]);
  const scanStartTimeRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const luminanceSamplesRef = useRef<number[]>([]);

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

        const depthAnalysis = calculateFaceDepthVariance(landmarks);
        setCurrentVariance(depthAnalysis.variance);
        setIs3DLiveCurrent(depthAnalysis.is3DLive);

        // Check facial accessories (glasses, sunglasses, mask, coverings)
        const accessoryResult = checkFacialAccessories(landmarks, video);
        setHasAccessory(accessoryResult.hasAccessory);
        setAccessoryDetails(accessoryResult.accessoryDetails);
        setAccessoryReason(accessoryResult.reason || null);

        if (isScanningRef.current) {
          sampleBufferRef.current.push(depthAnalysis);
          accessoryBufferRef.current.push(accessoryResult);

          const elapsed = performance.now() - (scanStartTimeRef.current || performance.now());
          const progress = Math.min(100, Math.round((elapsed / SAMPLE_DURATION_MS) * 100));
          setScanProgress(progress);

          if (elapsed >= SAMPLE_DURATION_MS) {
            isScanningRef.current = false;
            setIsScanning(false);

            const aggregated = aggregateMultiFrameLiveness(sampleBufferRef.current);
            const avgLuminance =
              luminanceSamplesRef.current.length > 0
                ? luminanceSamplesRef.current.reduce((a, b) => a + b, 0) /
                  luminanceSamplesRef.current.length
                : 60;

            // Check if accessory was detected in >= 40% of scanned frames
            const accessoryCount = accessoryBufferRef.current.filter((a) => a.hasAccessory).length;
            const hasPersistentAccessory = accessoryCount / (accessoryBufferRef.current.length || 1) >= 0.4;
            const mostFrequentReason = accessoryBufferRef.current.find((a) => a.reason)?.reason;

            let finalPassed = aggregated.passed;
            let finalFailureReason = aggregated.primaryFailureReason;

            if (hasPersistentAccessory) {
              finalPassed = false;
              finalFailureReason =
                mostFrequentReason ||
                'Verifikasi ditolak: Terdeteksi atribut pada wajah (kacamata/masker). Wajah harus bebas dari atribut.';
            }

            if (onLivenessComplete) {
              onLivenessComplete({
                passed: finalPassed,
                metrics: {
                  depthVariance: aggregated.medianVariance,
                  luminanceScore: Math.round(avgLuminance * 10) / 10,
                  confidenceScore: aggregated.averageConfidence,
                  sampleCount: sampleBufferRef.current.length,
                  failureReason: finalFailureReason,
                },
                latestLandmarks: landmarks,
              });
            }
          }
        }
      } else {
        setFaceDetected(false);
        setIs3DLiveCurrent(false);
        setHasAccessory(false);
        setAccessoryDetails([]);
        setAccessoryReason(null);
      }
    } catch (err) {
      console.warn('MediaPipe detection frame error:', err);
    }

    animationFrameIdRef.current = requestAnimationFrame(runDetection);
  }, [isStreaming, onLivenessComplete, overlayCanvasRef, videoRef]);

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
    scanStartTimeRef.current = performance.now();
    isScanningRef.current = true;
    setIsScanning(true);
    setScanProgress(0);
  }, []);

  const resetScan = useCallback(() => {
    isScanningRef.current = false;
    setIsScanning(false);
    setScanProgress(0);
    sampleBufferRef.current = [];
    accessoryBufferRef.current = [];
    luminanceSamplesRef.current = [];
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
    startLivenessScan,
    resetScan,
    latestLandmarks,
  };
}
