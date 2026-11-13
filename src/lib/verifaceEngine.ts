import * as ort from 'onnxruntime-web';

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
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let onnxSession: ort.InferenceSession | null = null;
let modelConfig: any = null;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export async function initVerifaceEngine() {
  if (onnxSession && modelConfig) return;

  const res = await fetch('/models/config.json');
  modelConfig = await res.json();

  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  onnxSession = await ort.InferenceSession.create('/models/veriface_liveness.onnx', {
    executionProviders: ['wasm'],
  });
}

export function isVirtualCamera(deviceLabel: string): boolean {
  const blacklist = ['obs', 'manycam', 'droidcam', 'vcam', 'virtual', 'splitcam', 'xsplit', 'snap camera'];
  return blacklist.some((keyword) => (deviceLabel || '').toLowerCase().includes(keyword));
}

export async function evaluateVideoFrame(
  video: HTMLVideoElement,
  cameraLabel: string = ''
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

  const w = video.videoWidth;
  const h = video.videoHeight;

  if (w === 0 || h === 0) {
    return { status: 'NO_FACE', message: 'Video kamera belum siap.' };
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
  const outputs = await onnxSession!.run({ input: inputTensor });

  const livenessProb = sigmoid((outputs.liveness_logit.data as Float32Array)[0]);
  const occlusionProb = sigmoid((outputs.occlusion_logit.data as Float32Array)[0]);

  const occThreshold = modelConfig?.occlusion_hold_threshold ?? 0.55;
  
  // Threshold 0.94: Cukup ketat untuk menolak layar HP (yang tadi skornya ~0.92), tapi meloloskan wajah asli
  const liveThreshold = 0.94;

  // Cek Gate Aksesoris (Masker / Kacamata)
  if (occlusionProb >= occThreshold) {
    return {
      status: 'HOLD_OCCLUSION',
      message: 'Terdeteksi penggunaan masker atau kacamata. Harap lepaskan atribut wajah Anda.',
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
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
    };
  } else {
    return {
      status: 'SPOOF_FAILED',
      message: `Indikasi objek 2D / Spoofing layar terdeteksi (Skor Liveness: ${(livenessProb * 100).toFixed(1)}%).`,
      livenessScore: livenessProb,
      occlusionScore: occlusionProb,
      luma: meanLuma,
    };
  }
}