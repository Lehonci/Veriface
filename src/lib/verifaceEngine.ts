import * as ort from 'onnxruntime-web';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

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
}

const IMG_SIZE = 224;
// UBAH 1: Margin diperlebar menjadi 2.2 agar bingkai HP / jari yang memegang HP ikut masuk ke dalam gambar yang dicek AI
const CROP_MARGIN = 2.2; 
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let landmarker: FaceLandmarker | null = null;
let onnxSession: ort.InferenceSession | null = null;
let modelConfig: any = null;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// 1. Inisialisasi Model (Panggil sekali saat halaman web dibuka)
export async function initVerifaceEngine() {
  if (landmarker && onnxSession && modelConfig) return;

  // Load config.json dari hasil ekspor Colab
  const res = await fetch('/models/config.json');
  modelConfig = await res.json();

  // Load MediaPipe Face Landmarker (468 titik)
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

  // Load model ONNX
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  onnxSession = await ort.InferenceSession.create('/models/veriface_liveness.onnx', {
    executionProviders: ['wasm'],
  });
}

// 2. Deteksi Kamera Virtual (Slide 5 & Slide 10: Driver Shield)
export function isVirtualCamera(deviceLabel: string): boolean {
  const blacklist = ['obs', 'manycam', 'droidcam', 'vcam', 'virtual', 'splitcam', 'xsplit', 'snap camera'];
  const lower = (deviceLabel || '').toLowerCase();
  return blacklist.some((keyword) => lower.includes(keyword));
}

// 3. Evaluasi 1 Frame Video Webcam
export async function evaluateVideoFrame(
  video: HTMLVideoElement,
  cameraLabel: string = ''
): Promise<VerifaceResult> {
  // Cek Virtual Camera Blocker
  if (isVirtualCamera(cameraLabel)) {
    return {
      status: 'VIRTUAL_CAM_BLOCKED',
      message: 'Kamera virtual (OBS/ManyCam) terdeteksi. Gunakan webcam fisik.',
    };
  }

  if (!landmarker || !onnxSession || !modelConfig) {
    await initVerifaceEngine();
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  const det = landmarker!.detectForVideo(video, performance.now());

  if (!det.faceLandmarks || det.faceLandmarks.length === 0) {
    return { status: 'NO_FACE', message: 'Wajah tidak terdeteksi. Hadapkan wajah ke kamera.' };
  }

  // Ambil 468 titik pertama dalam piksel gambar (sama persis dengan fungsi crop_from_landmarks di Colab)
  const pts = det.faceLandmarks[0].slice(0, 468).map((l) => [l.x * w, l.y * h]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.max(maxX - minX, maxY - minY) * CROP_MARGIN;
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
  const outputs = await onnxSession!.run({ input: inputTensor });

  const livenessLogit = (outputs.liveness_logit.data as Float32Array)[0];
  const occlusionLogit = (outputs.occlusion_logit.data as Float32Array)[0];

  const livenessProb = sigmoid(livenessLogit);
  const occlusionProb = sigmoid(occlusionLogit);

  const occThreshold = modelConfig?.occlusion_hold_threshold ?? 0.5;
  
  // UBAH 2: Threshold dinaikkan paksa menjadi 0.85 agar sistem sangat galak terhadap percobaan spoofing
  const liveThreshold = 0.85;

  // Cek Gate Aksesoris (Masker / Kacamata -> HOLD)
  if (occlusionProb >= occThreshold) {
    return {
      status: 'HOLD_OCCLUSION',
      message: 'HOLD: Harap lepas masker atau kacamata Anda terlebih dahulu.',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
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
    };
  } else {
    return {
      status: 'SPOOF_FAILED',
      message: 'SPOOF_FAILED: Terdeteksi indikasi foto cetak atau layar perangkat.',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
    };
  }
}