import * as ort from 'onnxruntime-web';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
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
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let onnxSession: ort.InferenceSession | null = null;
let modelConfig: any = null;
let isInitializing = false;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function isEngineReady(): boolean {
  return Boolean(onnxSession && modelConfig);
}

export function getModelConfig(): any {
  return modelConfig;
}

// 1. Inisialisasi Model (Panggil sekali saat halaman web dibuka untuk pre-warm)
export async function initVerifaceEngine(): Promise<void> {
  if (onnxSession && modelConfig) return;
  if (isInitializing) return;

  isInitializing = true;
  try {
    // 1. Load config.json
    if (!modelConfig) {
      const res = await fetch('/models/config.json');
      if (res.ok) {
        modelConfig = await res.json();
      }
    }

    // 2. Load model ONNX WebAssembly
    if (!onnxSession) {
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
      onnxSession = await ort.InferenceSession.create('/models/veriface_liveness.onnx', {
        executionProviders: ['wasm'],
      });
    }
  } catch (err) {
    console.error('Inisialisasi ONNX Veriface Engine gagal:', err);
  } finally {
    isInitializing = false;
  }
}

// Lazy fallback untuk MediaPipe jika pemanggil tidak menyediakan landmarks
async function getFallbackLandmarker(): Promise<FaceLandmarker | null> {
  if (landmarker) return landmarker;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
    });
    return landmarker;
  } catch (e) {
    console.warn('Fallback FaceLandmarker gagal dimuat:', e);
    return null;
  }
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
      message: 'Kamera virtual terdeteksi. Gunakan webcam fisik.',
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

  let pts: [number, number][] = [];

  // Jika landmarks sudah ditangkap oleh MediaPipe di useFaceLandmarker, gunakan langsung!
  if (existingLandmarks && existingLandmarks.length >= 400) {
    pts = existingLandmarks.slice(0, 468).map((l) => [l.x * w, l.y * h]);
  } else {
    // Fallback: deteksi menggunakan landmarker internal jika tidak disediakan
    const fbLandmarker = await getFallbackLandmarker();
    if (!fbLandmarker) {
      return { status: 'NO_FACE', message: 'Detektor wajah tidak siap.' };
    }
    const det = fbLandmarker.detectForVideo(video, performance.now());
    if (!det.faceLandmarks || det.faceLandmarks.length === 0) {
      return { status: 'NO_FACE', message: 'Wajah tidak terdeteksi. Hadapkan wajah ke kamera.' };
    }
    pts = det.faceLandmarks[0].slice(0, 468).map((l) => [l.x * w, l.y * h]);
  }

  if (pts.length === 0) {
    return { status: 'NO_FACE', message: 'Wajah tidak terdeteksi. Hadapkan wajah ke kamera.' };
  }

  // Hitung bounding box crop wajah dari 468 titik (sesuai crop_from_landmarks di Colab)
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

  // Ambil area tengah video beserta margin di sekitarnya (agar bingkai HP tetap tertangkap jika spoofing)
  const side = Math.min(w, h) * 0.85;
  const sx0 = (w - side) / 2;
  const sy0 = (h - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);

  // Gambar ke canvas 224x224
  ctx.drawImage(video, sx0, sy0, side, side, 0, 0, IMG_SIZE, IMG_SIZE);

  const imgData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data;
  const snapshotBase64 = canvas.toDataURL('image/jpeg', 0.85);

  // Audit Iluminasi BT.601
  let lumaSum = 0;
  let count = 0;
  const startIdx = Math.floor(IMG_SIZE / 4);
  const endIdx = Math.floor((3 * IMG_SIZE) / 4);

  for (let y = startIdx; y < endIdx; y++) {
    for (let x = startIdx; x < endIdx; x++) {
      const idx = (y * IMG_SIZE + x) * 4;
      lumaSum += 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      count++;
    }
  }
  const meanLuma = lumaSum / count;
  const minLuma = modelConfig?.illumination_gate_bt601?.min_mean_luma ?? 45;

  if (meanLuma < minLuma) {
    return {
      status: 'HOLD_LIGHT',
      message: `Pencahayaan ruangan terlalu gelap (${meanLuma.toFixed(0)} Lux). Harap tambah cahaya.`,
      luma: meanLuma,
      snapshotBase64,
    };
  }

  // Konversi ke Tensor NCHW [1, 3, 224, 224]
  const floatData = new Float32Array(3 * IMG_SIZE * IMG_SIZE);
  const stride = IMG_SIZE * IMG_SIZE;
  for (let i = 0; i < stride; i++) {
    floatData[i] = (imgData[i * 4] / 255.0 - MEAN[0]) / STD[0];
    floatData[stride + i] = (imgData[i * 4 + 1] / 255.0 - MEAN[1]) / STD[1];
    floatData[2 * stride + i] = (imgData[i * 4 + 2] / 255.0 - MEAN[2]) / STD[2];
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, IMG_SIZE, IMG_SIZE]);
  const outputs = await onnxSession.run({ input: inputTensor });

  const livenessProb = sigmoid((outputs.liveness_logit.data as Float32Array)[0]);
  const occlusionProb = sigmoid((outputs.occlusion_logit.data as Float32Array)[0]);

  const occThreshold = modelConfig?.occlusion_hold_threshold ?? 0.5;
  const liveThreshold = modelConfig?.threshold ?? 0.7262;

  // Cek Gate Aksesoris (Masker / Kacamata)
  if (occlusionProb >= occThreshold) {
    return {
      status: 'HOLD_OCCLUSION',
      message: 'Terdeteksi penggunaan masker atau kacamata. Harap lepaskan atribut wajah Anda.',
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
      message: 'PASSED: Wajah 3D asli terverifikasi.',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
      snapshotBase64,
    };
  } else {
    return {
      status: 'SPOOF_FAILED',
      message: `Indikasi objek 2D / Spoofing layar terdeteksi (Skor Liveness: ${(livenessProb * 100).toFixed(1)}%).`,
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
      snapshotBase64,
    };
  }
}
