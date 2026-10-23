export interface LuminanceResult {
  score: number;
  status: 'TOO_DARK' | 'OPTIMAL' | 'TOO_BRIGHT';
  message: string;
}

export const MIN_LUMINANCE_THRESHOLD = 38.0;
export const MAX_LUMINANCE_THRESHOLD = 235.0;

<<<<<<< HEAD
=======
export function calculateLuminanceFromVideo(
  video: HTMLVideoElement,
  offscreenCanvas?: HTMLCanvasElement
): LuminanceResult {
  try {
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    const canvas = offscreenCanvas || document.createElement('canvas');
    if (canvas.width !== 64 || canvas.height !== 48) {
      canvas.width = 64;
      canvas.height = 48;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { score: 100, status: 'OPTIMAL', message: 'Optimal' };
    }
    ctx.drawImage(video, 0, 0, 64, 48);
    const imageData = ctx.getImageData(0, 0, 64, 48);
    const data = imageData.data;
    let totalLuminance = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }

    const averageLuma = count > 0 ? totalLuminance / count : 100;
    const roundedScore = Math.round(averageLuma * 10) / 10;

    if (roundedScore < 20.0) {
      return {
        score: roundedScore,
        status: 'TOO_DARK',
        message: 'Pencahayaan ruangan terlalu gelap.',
      };
    } else if (roundedScore > 240.0) {
      return {
        score: roundedScore,
        status: 'TOO_BRIGHT',
        message: 'Pencahayaan ruangan terlalu terang/silau.',
      };
    }

    return {
      score: roundedScore,
      status: 'OPTIMAL',
      message: 'Pencahayaan optimal.',
    };
  } catch (err) {
    return { score: 100, status: 'OPTIMAL', message: 'Optimal' };
  }
}

>>>>>>> 37f3a66c78bd02f26926fc26dd7c5cf26d268274
export function calculateLuminanceFromCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): LuminanceResult {
  try {
    const step = 4;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let totalLuminance = 0;
    let sampleCount = 0;

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luma;
      sampleCount++;
    }

    const averageLuma = sampleCount > 0 ? totalLuminance / sampleCount : 0;
    const roundedScore = Math.round(averageLuma * 100) / 100;

    if (roundedScore < MIN_LUMINANCE_THRESHOLD) {
      return {
        score: roundedScore,
        status: 'TOO_DARK',
        message: 'Pencahayaan ruangan terlalu gelap. Silakan cari sumber cahaya yang lebih terang.',
      };
    } else if (roundedScore > MAX_LUMINANCE_THRESHOLD) {
      return {
        score: roundedScore,
        status: 'TOO_BRIGHT',
        message: 'Pencahayaan terlalu silau atau overexposed.',
      };
    }

    return {
      score: roundedScore,
      status: 'OPTIMAL',
      message: 'Pencahayaan ruangan optimal.',
    };
  } catch (err) {
    console.warn('Luminance calculation error:', err);
    return {
      score: 50.0,
      status: 'OPTIMAL',
      message: 'Pencahayaan normal.',
    };
  }
}
