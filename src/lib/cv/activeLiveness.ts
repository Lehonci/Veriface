import type { LandmarkPoint } from './depthVariance';

export type ActiveChallengeStep =
  | 'FRONTAL_CALIBRATION'
  | 'BLINK'
  | 'TURN_RIGHT'
  | 'TURN_LEFT'
  | 'RETURN_CENTER';

export interface ActiveLivenessStatus {
  step: ActiveChallengeStep;
  blinkDetected: boolean;
  turnRightDetected: boolean;
  turnLeftDetected: boolean;
  ear: number;
  yaw: number;
}

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;

export const HEAD_YAW_TURN_THRESHOLD = 0.26;
export const HEAD_YAW_CENTER_THRESHOLD = 0.20;
const CONSECUTIVE_TURN_FRAMES = 2;

function dist2D(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function singleEyeEar(landmarks: LandmarkPoint[], idx: readonly number[]): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => landmarks[i]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;
  const horiz = dist2D(p1, p4);
  if (horiz <= 1e-6) return 0.3;
  return (dist2D(p2, p6) + dist2D(p3, p5)) / (2 * horiz);
}

/**
 * Eye Aspect Ratio (EAR) rata-rata kedua mata dari 468 landmark MediaPipe FaceMesh.
 */
export function computeEyeAspectRatio(landmarks: LandmarkPoint[]): number {
  if (!landmarks || landmarks.length < 400) return 0.3;
  return (singleEyeEar(landmarks, LEFT_EYE) + singleEyeEar(landmarks, RIGHT_EYE)) / 2;
}

/**
 * Estimasi yaw horizontal relatif terhadap sumbu pipi-ke-pipi (234 -> 454).
 * Nilai positif = pengguna menoleh ke kanan (searah kanan layar cermin -scale-x-100).
 * Nilai negatif = pengguna menoleh ke kiri (searah kiri layar cermin).
 */
export function computeHeadYawRatio(landmarks: LandmarkPoint[]): number {
  if (!landmarks || landmarks.length < 460) return 0;
  const nose = landmarks[1];
  const rightCheekImgLeft = landmarks[234];
  const leftCheekImgRight = landmarks[454];
  if (!nose || !rightCheekImgLeft || !leftCheekImgRight) return 0;

  const dx = leftCheekImgRight.x - rightCheekImgLeft.x;
  const dy = leftCheekImgRight.y - rightCheekImgLeft.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) return 0;

  const t = ((nose.x - rightCheekImgLeft.x) * dx + (nose.y - rightCheekImgLeft.y) * dy) / lenSq;
  return (0.5 - t) * 2;
}

export interface ActiveChallengeTracker {
  step: ActiveChallengeStep;
  blinkDetected: boolean;
  turnRightDetected: boolean;
  turnLeftDetected: boolean;
  openEarBaseline: number;
  sawOpenEyeInBlinkStep: boolean;
  sawClosedEyeInBlinkStep: boolean;
  rightStreak: number;
  leftStreak: number;
}

export function createActiveChallengeTracker(): ActiveChallengeTracker {
  return {
    step: 'FRONTAL_CALIBRATION',
    blinkDetected: false,
    turnRightDetected: false,
    turnLeftDetected: false,
    openEarBaseline: 0.28,
    sawOpenEyeInBlinkStep: false,
    sawClosedEyeInBlinkStep: false,
    rightStreak: 0,
    leftStreak: 0,
  };
}

/**
 * Memperbarui state tantangan active liveness per frame berdasarkan landmark wajah.
 */
export function updateActiveChallengeTracker(
  tracker: ActiveChallengeTracker,
  landmarks: LandmarkPoint[],
  calibrationReady: boolean
): ActiveLivenessStatus {
  const ear = computeEyeAspectRatio(landmarks);
  const yaw = computeHeadYawRatio(landmarks);

  // Kalibrasi baseline mata terbuka hanya saat wajah menghadap depan di fase kalibrasi
  if (
    tracker.step === 'FRONTAL_CALIBRATION' &&
    Math.abs(yaw) <= HEAD_YAW_CENTER_THRESHOLD &&
    ear > 0.19
  ) {
    tracker.openEarBaseline = tracker.openEarBaseline * 0.85 + ear * 0.15;
  }

  if (tracker.step === 'FRONTAL_CALIBRATION') {
    if (calibrationReady && Math.abs(yaw) <= HEAD_YAW_CENTER_THRESHOLD) {
      tracker.step = 'BLINK';
      tracker.sawOpenEyeInBlinkStep = ear > 0.19;
      tracker.sawClosedEyeInBlinkStep = false;
    }
  } else if (tracker.step === 'BLINK') {
    const closeThresh = Math.min(0.23, Math.max(0.155, tracker.openEarBaseline * 0.74));
    const reopenThresh = Math.min(0.255, Math.max(0.185, tracker.openEarBaseline * 0.84));

    // Hindari salah deteksi kedip saat kepala menoleh miring
    if (Math.abs(yaw) <= 0.24) {
      if (!tracker.sawOpenEyeInBlinkStep && ear >= reopenThresh) {
        tracker.sawOpenEyeInBlinkStep = true;
      } else if (tracker.sawOpenEyeInBlinkStep && !tracker.sawClosedEyeInBlinkStep && ear <= closeThresh) {
        tracker.sawClosedEyeInBlinkStep = true;
      } else if (tracker.sawClosedEyeInBlinkStep && ear >= reopenThresh) {
        tracker.blinkDetected = true;
        tracker.step = 'TURN_RIGHT';
        tracker.rightStreak = 0;
      }
    }
  } else if (tracker.step === 'TURN_RIGHT') {
    if (yaw >= HEAD_YAW_TURN_THRESHOLD) {
      tracker.rightStreak += 1;
      if (tracker.rightStreak >= CONSECUTIVE_TURN_FRAMES) {
        tracker.turnRightDetected = true;
        tracker.step = 'TURN_LEFT';
        tracker.leftStreak = 0;
      }
    } else {
      tracker.rightStreak = 0;
    }
  } else if (tracker.step === 'TURN_LEFT') {
    if (yaw <= -HEAD_YAW_TURN_THRESHOLD) {
      tracker.leftStreak += 1;
      if (tracker.leftStreak >= CONSECUTIVE_TURN_FRAMES) {
        tracker.turnLeftDetected = true;
        tracker.step = 'RETURN_CENTER';
      }
    } else {
      tracker.leftStreak = 0;
    }
  }

  return {
    step: tracker.step,
    blinkDetected: tracker.blinkDetected,
    turnRightDetected: tracker.turnRightDetected,
    turnLeftDetected: tracker.turnLeftDetected,
    ear,
    yaw,
  };
}

export function getChallengeFailureDetail(tracker: ActiveChallengeTracker): string {
  const missing: string[] = [];
  if (!tracker.blinkDetected) missing.push('kedipan mata');
  if (!tracker.turnRightDetected) missing.push('tengok kanan');
  if (!tracker.turnLeftDetected) missing.push('tengok kiri');
  return missing.length > 0
    ? `Uji Active Liveness belum selesai (kurang: ${missing.join(', ')}). Pastikan wajah bergerak langsung sesuai instruksi di kamera.`
    : 'Wajah gagal dikonfirmasi menghadap kembali ke depan.';
}
