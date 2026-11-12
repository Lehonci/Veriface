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
 * video region. Skin below the eyes is smooth, while a glasses lower rim
 * creates a clear horizontal edge.
 */
function lowerRimEdgeRatio(
  video: HTMLVideoElement,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): number {
  const w = 48;
  const h = 24;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.min(x0, x1) * vw;
  const sw = Math.max(8, Math.abs(x1 - x0) * vw);
  const sy = Math.min(y0, y1) * vh;
  const sh = Math.max(8, Math.abs(y1 - y0) * vh);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  let edges = 0;
  let total = 0;
  for (let y = 0; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4;
      const b = ((y + 2) * w + x) * 4;
      const la = 0.299 * d[a] + 0.587 * d[a + 1] + 0.114 * d[a + 2];
      const lb = 0.299 * d[b] + 0.587 * d[b + 1] + 0.114 * d[b + 2];
      if (Math.abs(la - lb) > 28) edges++;
      total++;
    }
  }
  return total > 0 ? edges / total : 0;
}

/**
 * Checks for facial accessories (glasses, sunglasses, face mask, thick covering)
 * using MediaPipe 468/478 face landmarks and eye-region pixel analysis.
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

  // 1. Check Mask / Mouth Cover:
  // In a normal face, the mouth has distinct lip contours and pigmentation.
  // When a real mask (surgical, cloth, N95) is worn, the mouth is physically occluded by opaque fabric
  // which lacks lip pigmentation and normal lip-seam contrast.
  const outerUpperLip = landmarks[0];
  const outerLowerLip = landmarks[17];
  const mouthCornerLeft = landmarks[61];
  const mouthCornerRight = landmarks[291];
  const chin = landmarks[152];
  const noseTip = landmarks[1];

  if (videoElement && videoElement.videoWidth > 0 && outerUpperLip && outerLowerLip && mouthCornerLeft && mouthCornerRight && chin && noseTip) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 30;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;

        // Crop the mouth rectangle
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

            // Check horizontal crease where lips meet
            const belowIdx = ((y + 2) * 40 + x) * 4;
            const belowLum = 0.299 * imgData[belowIdx] + 0.587 * imgData[belowIdx + 1] + 0.114 * imgData[belowIdx + 2];
            if (Math.abs(lum - belowLum) > 22) {
              lipCreaseEdges++;
            }

            // Natural lip vermilion pigment
            if (r > g + 12 && r > b + 12) {
              lipHueCount++;
            }
            total++;
          }
        }

        // Only trigger if both lip pigment and crease are completely absent (covered by fabric/mask)
        if (total > 50 && lipCreaseEdges < 4 && lipHueCount < 3) {
          hasMask = true;
          details.push('Masker / Penutup Mulut');
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check Glasses / Eyeglasses:
  // Landmark keypoints around glasses frame:
  // Nose bridge: 168, 6
  // Left eye corners: 33 (outer), 133 (inner), right eye corners: 362 (inner), 263 (outer)
  // Eye contour z-dispersion vs forehead: Glasses frames create elevated z-ridges or edge gradients across nose bridge
  const bridge = landmarks[168];
  const noseBase = landmarks[6];
  const leftInnerEye = landmarks[133];
  const rightInnerEye = landmarks[362];

  // If video is provided, we can inspect color/edge contrast around the nose bridge and temple frames
  if (videoElement && videoElement.videoWidth > 0 && bridge && leftInnerEye && rightInnerEye) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;

        // Crop eye bridge and surrounding frames area
        const minX = Math.min(leftInnerEye.x, rightInnerEye.x) * vw;
        const maxX = Math.max(leftInnerEye.x, rightInnerEye.x) * vw;
        const minY = (bridge.y - 0.03) * vh;
        const boxW = Math.max(10, maxX - minX);
        const boxH = Math.max(10, (bridge.y + 0.05) * vh - minY);

        ctx.drawImage(videoElement, minX - boxW * 0.2, minY, boxW * 1.4, boxH, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64);
        const data = imgData.data;

        // Check horizontal edge gradient across bridge (frames create distinct dark edges or specular highlights)
        let edgeCount = 0;
        let darkPixelCount = 0;
        for (let y = 10; y < 54; y++) {
          for (let x = 10; x < 54; x++) {
            const idx = (y * 64 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Frame edge check
            const rightIdx = (y * 64 + (x + 2)) * 4;
            const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
            if (Math.abs(lum - rightLum) > 55) {
              edgeCount++;
            }

            // Dark rim of glasses
            if (lum < 50) {
              darkPixelCount++;
            }
          }
        }

        // Eyeglasses detection based on high edge density across the nasal bridge / eye rim
        if (edgeCount > 90 || darkPixelCount > 250) {
          hasGlasses = true;
          details.push('Kacamata');
        }
      }

      // Lower rim check: frame edge just below each eye (both eyes must show it)
      if (!hasGlasses) {
        const lOuter = landmarks[33];
        const lLower = landmarks[145];
        const rOuter = landmarks[263];
        const rLower = landmarks[374];
        if (lOuter && lLower && rOuter && rLower) {
          const leftRatio = lowerRimEdgeRatio(
            videoElement, lOuter.x, leftInnerEye.x, lLower.y + 0.008, lLower.y + 0.05
          );
          const rightRatio = lowerRimEdgeRatio(
            videoElement, rightInnerEye.x, rOuter.x, rLower.y + 0.008, rLower.y + 0.05
          );
          if (leftRatio > 0.12 && rightRatio > 0.12) {
            hasGlasses = true;
            details.push('Kacamata');
          }
        }
      }
    } catch {
      // Fallback to geometric check if canvas read fails
    }
  }

  // Geometric fallback / complementary check:
  // When wearing glasses, the depth variance between bridge and inner eye socket is distorted
  if (!hasGlasses && bridge && leftInnerEye && rightInnerEye) {
    const bridgeZ = bridge.z;
    const avgEyeZ = (leftInnerEye.z + rightInnerEye.z) / 2;
    const diffZ = Math.abs(bridgeZ - avgEyeZ);
    // Glasses push or flatten the detected bridge contour
    if (diffZ < 0.008 || diffZ > 0.032) {
      hasGlasses = true;
      details.push('Kacamata');
    }
  }

  const hasAccessory = hasGlasses || hasMask;
  let reason: string | undefined = undefined;

  if (hasAccessory) {
    if (hasGlasses && hasMask) {
      reason = 'Terdeteksi penggunaan masker dan kacamata. Mohon lepas atribut penutup wajah untuk verifikasi identitas.';
    } else if (hasGlasses) {
      reason = 'Terdeteksi atribut kacamata pada wajah. Harap lepas kacamata Anda untuk memastikan identifikasi biometrik yang akurat.';
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
