import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';

const IMG_SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const g = globalThis as unknown as {
  __verifaceServerOnnxSession?: ort.InferenceSession;
  __verifaceServerOnnxInit?: Promise<ort.InferenceSession>;
};

async function getServerOnnxSession(): Promise<ort.InferenceSession> {
  if (g.__verifaceServerOnnxSession) {
    return g.__verifaceServerOnnxSession;
  }
  if (g.__verifaceServerOnnxInit) {
    return g.__verifaceServerOnnxInit;
  }

  g.__verifaceServerOnnxInit = (async () => {
    ort.env.wasm.numThreads = 1;
    const localWasmDir = path.join(process.cwd(), 'public', 'wasm', 'ort');
    const nodeModulesWasmDir = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
    const chosenDir = fs.existsSync(localWasmDir) ? localWasmDir : nodeModulesWasmDir;
    const dirUrl = pathToFileURL(chosenDir).href;
    ort.env.wasm.wasmPaths = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`;

    const modelPath = path.join(process.cwd(), 'public', 'models', 'veriface_liveness.onnx');
    const modelBuffer = fs.readFileSync(modelPath);
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });
    g.__verifaceServerOnnxSession = session;
    return session;
  })().finally(() => {
    g.__verifaceServerOnnxInit = undefined;
  });

  return g.__verifaceServerOnnxInit;
}

export interface ServerOnnxVerificationResult {
  verified: boolean;
  livenessScore: number;
  occlusionScore: number;
  meanLuma: number;
  reason?: string;
}

/**
 * Menjalankan ulang inferensi ONNX MobileNetV3 & audit luminansi BT.601 langsung di server
 * terhadap gambar snapshot base64 yang diunggah klien (mencegah pemalsuan skor HTTP langsung).
 */
export async function verifySnapshotWithServerOnnx(params: {
  snapshotBase64: string;
  activeThreshold: number;
  occlusionThreshold: number;
  minMeanLuma: number;
  claimedConfidence?: number;
}): Promise<ServerOnnxVerificationResult> {
  const {
    snapshotBase64,
    activeThreshold,
    occlusionThreshold,
    minMeanLuma,
    claimedConfidence,
  } = params;

  const base64Body = snapshotBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const imgBuffer = Buffer.from(base64Body, 'base64');

  // Decode dan pastikan dimensi tepat 224x224 RGB 3 channel
  const { data: rgbPixels } = await sharp(imgBuffer)
    .removeAlpha()
    .resize(IMG_SIZE, IMG_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 1. Server-side BT.601 Luminance Gate pada 50% area tengah (56..168)
  const startIdx = Math.floor(IMG_SIZE / 4);
  const endIdx = Math.floor((3 * IMG_SIZE) / 4);
  let lumaSum = 0;
  let lumaCount = 0;

  for (let y = startIdx; y < endIdx; y++) {
    for (let x = startIdx; x < endIdx; x++) {
      const idx = (y * IMG_SIZE + x) * 3;
      const r = rgbPixels[idx];
      const gCh = rgbPixels[idx + 1];
      const b = rgbPixels[idx + 2];
      lumaSum += 0.299 * r + 0.587 * gCh + 0.114 * b;
      lumaCount++;
    }
  }
  const meanLuma = lumaSum / Math.max(1, lumaCount);

  if (meanLuma < minMeanLuma) {
    return {
      verified: false,
      livenessScore: 0,
      occlusionScore: 0,
      meanLuma,
      reason: `Audit server: pencahayaan snapshot terlalu gelap (BT.601 ${meanLuma.toFixed(0)} < ${minMeanLuma}).`,
    };
  }

  // 2. Normalisasi ImageNet NCHW [1, 3, 224, 224]
  const stride = IMG_SIZE * IMG_SIZE;
  const floatData = new Float32Array(3 * stride);
  for (let i = 0; i < stride; i++) {
    const r = rgbPixels[i * 3] / 255.0;
    const gCh = rgbPixels[i * 3 + 1] / 255.0;
    const b = rgbPixels[i * 3 + 2] / 255.0;
    floatData[i] = (r - MEAN[0]) / STD[0];
    floatData[stride + i] = (gCh - MEAN[1]) / STD[1];
    floatData[2 * stride + i] = (b - MEAN[2]) / STD[2];
  }

  const session = await getServerOnnxSession();
  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, IMG_SIZE, IMG_SIZE]);
  const outputs = await session.run({ input: inputTensor });

  const livenessLogit = (outputs.liveness_logit.data as Float32Array)[0];
  const occlusionLogit = (outputs.occlusion_logit.data as Float32Array)[0];
  const livenessScore = sigmoid(livenessLogit);
  const occlusionScore = sigmoid(occlusionLogit);

  // Toleransi sangat tipis (0.025) hanya untuk perbedaan rounding encoding JPEG 85%
  const serverThresholdFloor = Math.max(0, activeThreshold - 0.025);

  if (occlusionScore >= occlusionThreshold) {
    return {
      verified: false,
      livenessScore,
      occlusionScore,
      meanLuma,
      reason: `Audit server: snapshot masih menunjukkan atribut penutup wajah / kacamata (oklusi ${(occlusionScore * 100).toFixed(1)}%).`,
    };
  }

  if (livenessScore < serverThresholdFloor) {
    return {
      verified: false,
      livenessScore,
      occlusionScore,
      meanLuma,
      reason: `Audit server ONNX menolak snapshot (skor server ${(livenessScore * 100).toFixed(1)}% < ambang ${(activeThreshold * 100).toFixed(1)}%).`,
    };
  }

  if (
    typeof claimedConfidence === 'number' &&
    Number.isFinite(claimedConfidence) &&
    Math.abs(livenessScore - claimedConfidence) > 0.30
  ) {
    return {
      verified: false,
      livenessScore,
      occlusionScore,
      meanLuma,
      reason: 'Audit server mendeteksi ketidaksesuaian ekstrem antara skor laporan klien dan citra snapshot.',
    };
  }

  return {
    verified: true,
    livenessScore,
    occlusionScore,
    meanLuma,
  };
}
