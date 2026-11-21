import * as ort from 'onnxruntime-web';
import { LandmarkPoint } from '@/lib/cv/depthVariance';

export type VerifaceStatus =
  | 'PASSED'
  | 'SPOOF_FAILED'
  | 'HOLD_LIGHT'
  | 'HOLD_OCCLUSION'
  | 'NO_FACE'
  | 'VIRTUAL_CAM_BLOCKED';

export interface VerifaceResult {
  status: VerifaceStatus;
  message: string;
  livenessScore?: number;
  occlusionScore?: number;
  luma?: number;
  snapshotBase64?: string;
}

const IMG_SIZE = 224;
const DEFAULT_CROP_MARGIN = 2.0; // Sinkron dengan CROP_MARGIN = 2.0 di Colab v4
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let onnxSession: ort.InferenceSession | null = null;
let modelConfig: any = null;
let initPromise: Promise<void> | null = null;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function isEngineReady(): boolean {
  return Boolean(onnxSession && modelConfig);
}

export function getModelConfig(): any {
  return modelConfig;
}

// 1. Inisialisasi Model (Aman dari race condition jika dipanggil bersamaan)
export async function initVerifaceEngine(): Promise<void> {
  if (onnxSession && modelConfig) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!modelConfig) {
        const res = await fetch('/models/config.json', { cache: 'no-store' });
        if (res.ok) {
          modelConfig = await res.json();
        }
      }

      if (!onnxSession) {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
        onnxSession = await ort.InferenceSession.create('/models/veriface_liveness.onnx', {
          executionProviders: ['wasm'],
        });
      }
    } catch (err) {
      console.error('Inisialisasi ONNX Veriface Engine gagal:', err);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

// 2. Deteksi Kamera Virtual (Driver Shield)
export function isVirtualCamera(deviceLabel: string): boolean {
  const blacklist = [
    'obs',
    'manycam',
    'droidcam',
    'vcam',
    'virtual',
    'splitcam',
    'xsplit',
    'snap camera',
    'iriun',
    'camo',
  ];
  const lower = (deviceLabel || '').toLowerCase();
  return blacklist.some((keyword) => lower.includes(keyword));
}

// 3. Evaluasi Frame Video Webcam menggunakan Model ONNX MobileNetV3 Multi-Head
export async function evaluateVideoFrame(
  video: HTMLVideoElement,
  cameraLabel: string = '',
  existingLandmarks?: LandmarkPoint[]
): Promise<VerifaceResult> {
  if (isVirtualCamera(cameraLabel)) {
    return {
      status: 'VIRTUAL_CAM_BLOCKED',
      message: 'Kamera virtual (OBS/ManyCam) terdeteksi. Gunakan webcam fisik.',
    };
  }

  if (!onnxSession || !modelConfig) {
    await initVerifaceEngine();
  }

  if (!onnxSession) {
    return {
      status: 'SPOOF_FAILED',
      message: 'Sesi model AI belum siap. Harap tunggu sebentar dan coba lagi.',
    };
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return { status: 'NO_FACE', message: 'Video stream belum siap.' };
  }

  const cropMargin = modelConfig?.crop_margin ?? DEFAULT_CROP_MARGIN;
  let cx = w / 2;
  let cy = h / 2;
  let side = Math.min(w, h) * 0.85;

  // Gunakan landmarks dari useFaceLandmarker jika tersedia (tanpa load MediaPipe kedua)
  if (existingLandmarks && existingLandmarks.length >= 400) {
    const pts = existingLandmarks.slice(0, 468).map((l) => [l.x * w, l.y * h]);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
    side = Math.max(maxX - minX, maxY - minY) * cropMargin;
  }

  const sx0 = cx - side / 2;
  const sy0 = cy - side / 2;

  // Crop ke Canvas 224x224 dengan area luar berwarna hitam
  const canvas = document.createElement('canvas');
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);

  const scale = IMG_SIZE / side;
  ctx.setTransform(scale, 0, 0, scale, -sx0 * scale, -sy0 * scale);
  ctx.drawImage(video, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const imgData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data;
  const snapshotBase64 = canvas.toDataURL('image/jpeg', 0.85);

  // Audit Iluminasi BT.601 pada 50% area tengah (indeks 56..168)
  let lumaSum = 0;
  let count = 0;
  const startIdx = Math.floor(IMG_SIZE / 4);
  const endIdx = Math.floor((3 * IMG_SIZE) / 4);

  for (let y = startIdx; y < endIdx; y++) {
    for (let x = startIdx; x < endIdx; x++) {
      const idx = (y * IMG_SIZE + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }
  const meanLuma = lumaSum / count;
  const minLuma = modelConfig?.illumination_gate_bt601?.min_mean_luma ?? 50;

  if (meanLuma < minLuma) {
    return {
      status: 'HOLD_LIGHT',
      message: `HOLD: Pencahayaan kurang (${meanLuma.toFixed(0)} < ${minLuma}). Cari ruangan lebih terang.`,
      luma: meanLuma,
      snapshotBase64,
    };
  }

  // Konversi ke Tensor NCHW [1, 3, 224, 224] dengan normalisasi ImageNet (x/255 - mean)/std
  const floatData = new Float32Array(3 * IMG_SIZE * IMG_SIZE);
  const stride = IMG_SIZE * IMG_SIZE;
  for (let i = 0; i < stride; i++) {
    const r = imgData[i * 4] / 255.0;
    const g = imgData[i * 4 + 1] / 255.0;
    const b = imgData[i * 4 + 2] / 255.0;

    floatData[i] = (r - MEAN[0]) / STD[0];
    floatData[stride + i] = (g - MEAN[1]) / STD[1];
    floatData[2 * stride + i] = (b - MEAN[2]) / STD[2];
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, IMG_SIZE, IMG_SIZE]);
  const outputs = await onnxSession.run({ input: inputTensor });

  const livenessLogit = (outputs.liveness_logit.data as Float32Array)[0];
  const occlusionLogit = (outputs.occlusion_logit.data as Float32Array)[0];

  const livenessProb = sigmoid(livenessLogit);
  const occlusionProb = sigmoid(occlusionLogit);
  console.log('CEK ONNX:', { livenessProb, occlusionProb });

  const occThreshold = modelConfig?.occlusion_hold_threshold ?? 0.5;
  const liveThreshold = modelConfig?.threshold ?? 0.85;

  // Cek Gate Aksesoris (Masker / Kacamata -> HOLD)
  if (occlusionProb >= occThreshold) {
    return {
      status: 'HOLD_OCCLUSION',
      message: 'HOLD: Harap lepas masker atau kacamata Anda terlebih dahulu.',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
      snapshotBase64,
    };
  }

  // Cek Liveness (Real vs Spoof)
  if (livenessProb >= liveThreshold) {
    return {
      status: 'PASSED',
      message: 'PASSED: Wajah asli terverifikasi. Mengalihkan ke ruang Zoom...',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
      snapshotBase64,
    };
  } else {
    return {
      status: 'SPOOF_FAILED',
      message: `SPOOF_FAILED: Terdeteksi indikasi foto cetak atau layar perangkat (Skor: ${(livenessProb * 100).toFixed(1)}%).`,
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
      snapshotBase64,
    };
  }
}