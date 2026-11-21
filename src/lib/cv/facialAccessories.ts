import { LandmarkPoint } from './depthVariance';

export interface FacialAccessoryCheckResult {
  hasGlasses: boolean;
  hasMask: boolean;
  hasHeadwear: boolean;
  hasAccessory: boolean;
  accessoryDetails: string[];
  reason?: string;
}

interface HorizontalBandStats {
  maxRowGrad: number;
  maxRowCoverage: number;
  minRowLum: number;
  medianRowLum: number;
  p75RowLum: number;
}

function analyzeHorizontalBand(
  video: HTMLVideoElement,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): HorizontalBandStats {
  const w = 40;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { maxRowGrad: 0, maxRowCoverage: 0, minRowLum: 255, medianRowLum: 255, p75RowLum: 255 };
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sx = Math.max(0, Math.min(x0, x1) * vw);
  const sy = Math.max(0, Math.min(y0, y1) * vh);
  const sw = Math.max(8, Math.min(vw - sx, Math.abs(x1 - x0) * vw));
  const sh = Math.max(8, Math.min(vh - sy, Math.abs(y1 - y0) * vh));

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const rowLums: number[] = [];
  let maxRowGrad = 0;
  let maxRowCoverage = 0;

  const xStart = 2;
  const xEnd = w - 2;
  const cols = xEnd - xStart;

  for (let y = 0; y < h; y++) {
    let lumSum = 0;
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * w + x) * 4;
      lumSum += 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    }
    rowLums.push(lumSum / cols);
  }

  for (let y = 0; y < h - 2; y++) {
    let gradSum = 0;
    let strongCols = 0;
    for (let x = xStart; x < xEnd; x++) {
      const a = (y * w + x) * 4;
      const b = ((y + 2) * w + x) * 4;
      const la = 0.299 * d[a] + 0.587 * d[a + 1] + 0.114 * d[a + 2];
      const lb = 0.299 * d[b] + 0.587 * d[b + 1] + 0.114 * d[b + 2];
      const diff = Math.abs(la - lb);
      gradSum += diff;
      if (diff > 20) strongCols++;
    }
    const meanGrad = gradSum / cols;
    const coverage = strongCols / cols;
    if (meanGrad > maxRowGrad) maxRowGrad = meanGrad;
    if (coverage > maxRowCoverage) maxRowCoverage = coverage;
  }

  const sorted = [...rowLums].sort((a, b) => a - b);
  return {
    maxRowGrad,
    maxRowCoverage,
    minRowLum: sorted[0] ?? 255,
    medianRowLum: sorted[Math.floor(sorted.length * 0.5)] ?? 255,
    p75RowLum: sorted[Math.floor(sorted.length * 0.75)] ?? 255,
  };
}

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

  // 1. Check Mask / Mouth Cover (Tahan lipatan masker medis/kain)
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

        const mx = Math.max(0, Math.min(mouthCornerLeft.x, mouthCornerRight.x) * vw);
        const mw = Math.max(10, Math.abs(mouthCornerRight.x - mouthCornerLeft.x) * vw);
        const my = Math.max(0, (noseTip.y + (outerUpperLip.y - noseTip.y) * 0.5) * vh);
        const mh = Math.max(10, (chin.y - outerUpperLip.y) * 0.7 * vh);

        ctx.drawImage(videoElement, mx, my, mw, mh, 0, 0, 40, 30);
        const imgData = ctx.getImageData(0, 0, 40, 30).data;

        let lipCreaseEdges = 0;
        let lipHueCount = 0;
        let coolOrNeutralCount = 0;
        let darkMaskCount = 0;
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

            // Pigmen merah alami bibir
            if (r > g + 10 && r > b + 10) {
              lipHueCount++;
            }

            // Warna masker putih/abu/biru/hijau/hitam tidak memiliki rona kulit hangat
            if (r - b < 6) {
              coolOrNeutralCount++;
            }
            if (lum < 48) {
              darkMaskCount++;
            }
            total++;
          }
        }

        const isAchromaticOrDarkMask =
          total > 50 && (coolOrNeutralCount / total > 0.55 || darkMaskCount / total > 0.55);
        const isSmoothCoveredMouth = total > 50 && lipCreaseEdges < 6;

        if (total > 50 && lipHueCount < 5 && (isSmoothCoveredMouth || isAchromaticOrDarkMask)) {
          hasMask = true;
          details.push('Masker / Penutup Mulut');
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check Glasses / Eyeglasses (Batas dinaikkan agar tidak nabrak pinggiran atas masker)
  const bridgeTop = landmarks[168];
  const bridgeMid = landmarks[6]; // Tepat di antara dua mata (di atas posisi kawat masker)
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
    bridgeMid &&
    noseTip &&
    leftInnerEye &&
    rightInnerEye &&
    lOuter &&
    lLower &&
    rOuter &&
    rLower
  ) {
    try {
      // A. Cek pangkal hidung tepat di antara dua sudut dalam mata (168 -> 6)
      const innerMinX = Math.min(leftInnerEye.x, rightInnerEye.x);
      const innerMaxX = Math.max(leftInnerEye.x, rightInnerEye.x);
      const innerW = innerMaxX - innerMinX;
      const bridgeBottomY = bridgeMid.y + Math.max(0.012, (bridgeMid.y - bridgeTop.y) * 0.6);

      const bridge = analyzeHorizontalBand(
        videoElement,
        innerMinX + innerW * 0.2,
        innerMaxX - innerW * 0.2,
        bridgeTop.y,
        bridgeBottomY
      );
      const bridgeDrop = bridge.p75RowLum - bridge.minRowLum;
      const hasBridge =
        (bridge.maxRowGrad > 18 && bridge.maxRowCoverage > 0.45) ||
        (bridgeDrop > 28 && bridge.maxRowGrad > 14);
      const hasVeryStrongBridge = bridgeDrop > 42 && bridge.maxRowGrad > 22;

      if (hasMask) {
        // Jika sedang memakai masker, abaikan cek pipi bawah agar pinggiran masker tidak kebaca kacamata
        if (hasVeryStrongBridge) {
          hasGlasses = true;
          details.push('Kacamata');
        }
      } else {
        // B. Cek bingkai bawah proporsional terhadap tinggi mata-ke-hidung
        const avgLowerEyeY = (lLower.y + rLower.y) / 2;
        const eyeToNose = Math.max(0.05, Math.abs(noseTip.y - avgLowerEyeY));

        const lMinX = Math.min(lOuter.x, leftInnerEye.x);
        const lMaxX = Math.max(lOuter.x, leftInnerEye.x);
        const lPad = (lMaxX - lMinX) * 0.08;

        const rMinX = Math.min(rightInnerEye.x, rOuter.x);
        const rMaxX = Math.max(rightInnerEye.x, rOuter.x);
        const rPad = (rMaxX - rMinX) * 0.08;

        const leftRim = analyzeHorizontalBand(
          videoElement,
          lMinX + lPad,
          lMaxX - lPad,
          lLower.y + eyeToNose * 0.22,
          lLower.y + eyeToNose * 0.95
        );
        const rightRim = analyzeHorizontalBand(
          videoElement,
          rMinX + rPad,
          rMaxX - rPad,
          rLower.y + eyeToNose * 0.22,
          rLower.y + eyeToNose * 0.95
        );

        const leftHasRim =
          (leftRim.maxRowGrad > 18 && leftRim.maxRowCoverage > 0.45) ||
          (leftRim.medianRowLum - leftRim.minRowLum > 26 && leftRim.maxRowGrad > 13);
        const rightHasRim =
          (rightRim.maxRowGrad > 18 && rightRim.maxRowCoverage > 0.45) ||
          (rightRim.medianRowLum - rightRim.minRowLum > 26 && rightRim.maxRowGrad > 13);

        if ((leftHasRim && rightHasRim) || (hasBridge && (leftHasRim || rightHasRim)) || hasVeryStrongBridge) {
          hasGlasses = true;
          details.push('Kacamata');
        }
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