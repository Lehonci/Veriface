import { LandmarkPoint } from './depthVariance';

export interface FacialAccessoryCheckResult {
  hasGlasses: boolean;
  hasMask: boolean;
  hasHeadwear: boolean;
  hasAccessory: boolean;
  accessoryDetails: string[];
  reason?: string;
}

/**
 * Ratio of pixels with a strong vertical luminance gradient inside a normalized
 * video region. Skin below the eyes is smooth, while a glasses lower rim or bridge
 * creates a clear horizontal edge.
 */
function horizontalEdgeRatio(
  video: HTMLVideoElement,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  gradThreshold: number = 36
): { edgeRatio: number; darkRatio: number } {
  const w = 48;
  const h = 24;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { edgeRatio: 0, darkRatio: 0 };

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.max(0, Math.min(x0, x1) * vw);
  const sw = Math.max(8, Math.abs(x1 - x0) * vw);
  const sy = Math.max(0, Math.min(y0, y1) * vh);
  const sh = Math.max(8, Math.abs(y1 - y0) * vh);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  let edges = 0;
  let darks = 0;
  let total = 0;
  for (let y = 0; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4;
      const b = ((y + 2) * w + x) * 4;
      const la = 0.299 * d[a] + 0.587 * d[a + 1] + 0.114 * d[a + 2];
      const lb = 0.299 * d[b] + 0.587 * d[b + 1] + 0.114 * d[b + 2];
      if (Math.abs(la - lb) > gradThreshold) edges++;
      if (la < 45) darks++;
      total++;
    }
  }
  return {
    edgeRatio: total > 0 ? edges / total : 0,
    darkRatio: total > 0 ? darks / total : 0,
  };
}

/**
 * Checks for facial accessories (glasses, sunglasses, face mask)
 * using MediaPipe 468/478 face landmarks and localized pixel analysis.
 */
export function checkFacialAccessories(
  landmarks: LandmarkPoint[],
  videoElement?: HTMLVideoElement | null
): FacialAccessoryCheckResult {
  if (!landmarks || landmarks.length < 400) {
    return {
      hasGlasses: false,
      hasMask: false,
      hasHeadwear: false,
      hasAccessory: false,
      accessoryDetails: [],
    };
  }

  const details: string[] = [];
  let hasGlasses = false;
  let hasMask = false;

  // 1. Check Mask / Mouth Cover
  const outerUpperLip = landmarks[0];
  const outerLowerLip = landmarks[17];
  const mouthCornerLeft = landmarks[61];
  const mouthCornerRight = landmarks[291];
  const chin = landmarks[152];
  const noseTip = landmarks[1];

  if (
    videoElement &&
    videoElement.videoWidth > 0 &&
    outerUpperLip &&
    outerLowerLip &&
    mouthCornerLeft &&
    mouthCornerRight &&
    chin &&
    noseTip
  ) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 30;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;

        const mx = Math.min(mouthCornerLeft.x, mouthCornerRight.x) * vw;
        const mw = Math.max(10, Math.abs(mouthCornerRight.x - mouthCornerLeft.x) * vw);
        const my = (noseTip.y + (outerUpperLip.y - noseTip.y) * 0.5) * vh;
        const mh = Math.max(10, (chin.y - outerUpperLip.y) * 0.7 * vh);

        ctx.drawImage(videoElement, mx, my, mw, mh, 0, 0, 40, 30);
        const imgData = ctx.getImageData(0, 0, 40, 30).data;

        let lipCreaseEdges = 0;
        let lipHueCount = 0;
        let total = 0;

        for (let y = 6; y < 24; y++) {
          for (let x = 6; x < 34; x++) {
            const idx = (y * 40 + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            const belowIdx = ((y + 2) * 40 + x) * 4;
            const belowLum =
              0.299 * imgData[belowIdx] +
              0.587 * imgData[belowIdx + 1] +
              0.114 * imgData[belowIdx + 2];
            if (Math.abs(lum - belowLum) > 22) {
              lipCreaseEdges++;
            }

            if (r > g + 12 && r > b + 12) {
              lipHueCount++;
            }
            total++;
          }
        }

        if (total > 50 && lipCreaseEdges < 4 && lipHueCount < 3) {
          hasMask = true;
          details.push('Masker / Penutup Mulut');
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check Glasses / Eyeglasses (Strict bridge + lower-rim analysis, tanpa diffZ)
  const bridgeTop = landmarks[168];
  const noseBridgeMid = landmarks[6];
  const leftInnerEye = landmarks[133];
  const rightInnerEye = landmarks[362];
  const lOuter = landmarks[33];
  const lLower = landmarks[145];
  const rOuter = landmarks[263];
  const rLower = landmarks[374];

  if (
    videoElement &&
    videoElement.videoWidth > 0 &&
    bridgeTop &&
    noseBridgeMid &&
    leftInnerEye &&
    rightInnerEye &&
    lOuter &&
    lLower &&
    rOuter &&
    rLower
  ) {
    try {
      // A. Cek pangkal hidung murni (hanya 60% area tengah di antara 2 sudut dalam mata, tidak kena alis/mata)
      const innerMinX = Math.min(leftInnerEye.x, rightInnerEye.x);
      const innerMaxX = Math.max(leftInnerEye.x, rightInnerEye.x);
      const innerW = innerMaxX - innerMinX;
      const bridgeH = Math.max(0.015, Math.abs(noseBridgeMid.y - bridgeTop.y));

      const bridgeStats = horizontalEdgeRatio(
        videoElement,
        innerMinX + innerW * 0.2,
        innerMaxX - innerW * 0.2,
        bridgeTop.y + bridgeH * 0.15,
        noseBridgeMid.y + bridgeH * 0.85,
        38
      );
      const hasBridgeBar = bridgeStats.edgeRatio > 0.16 || bridgeStats.darkRatio > 0.28;

      // B. Cek bingkai bawah kacamata di bawah masing-masing mata (digeser di bawah bulu mata)
      const leftRim = horizontalEdgeRatio(
        videoElement,
        lOuter.x,
        leftInnerEye.x,
        lLower.y + 0.018,
        lLower.y + 0.075,
        36
      );
      const rightRim = horizontalEdgeRatio(
        videoElement,
        rightInnerEye.x,
        rOuter.x,
        rLower.y + 0.018,
        rLower.y + 0.075,
        36
      );

      const strongBothLowerRims = leftRim.edgeRatio > 0.16 && rightRim.edgeRatio > 0.16;
      const bridgeWithRim =
        hasBridgeBar && (leftRim.edgeRatio > 0.10 || rightRim.edgeRatio > 0.10);

      if (strongBothLowerRims || bridgeWithRim) {
        hasGlasses = true;
        details.push('Kacamata');
      }
    } catch {
      // Skip jika gagal baca canvas
    }
  }

  const hasAccessory = hasGlasses || hasMask;
  let reason: string | undefined = undefined;

  if (hasAccessory) {
    if (hasGlasses && hasMask) {
      reason =
        'Terdeteksi penggunaan masker dan kacamata. Mohon lepas atribut penutup wajah untuk verifikasi identitas.';
    } else if (hasGlasses) {
      reason =
        'Terdeteksi atribut kacamata pada wajah. Harap lepas kacamata Anda untuk memastikan identifikasi biometrik yang akurat.';
    } else if (hasMask) {
      reason = 'Terdeteksi penutup wajah / masker. Harap lepas penutup wajah untuk melanjutkan.';
    }
  }

  return {
    hasGlasses,
    hasMask,
    hasHeadwear: false,
    hasAccessory,
    accessoryDetails: details,
    reason,
  };
}