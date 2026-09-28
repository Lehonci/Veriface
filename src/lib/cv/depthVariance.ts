export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface DepthAnalysisResult {
  variance: number;
  depthRange: number;
  standardDeviation: number;
  is3DLive: boolean;
  confidence: number;
  reason?: string;
}

export const MIN_Z_VARIANCE_THRESHOLD = 0.00055;
export const MIN_Z_DEPTH_RANGE_THRESHOLD = 0.038;

export function calculateFaceDepthVariance(landmarks: LandmarkPoint[]): DepthAnalysisResult {
  if (!landmarks || landmarks.length < 400) {
    return {
      variance: 0,
      depthRange: 0,
      standardDeviation: 0,
      is3DLive: false,
      confidence: 0,
      reason: 'Landmark wajah tidak lengkap atau tidak terdeteksi.',
    };
  }

  const zValues = landmarks.map((pt) => pt.z);
  const n = zValues.length;

  const meanZ = zValues.reduce((sum, val) => sum + val, 0) / n;
  const variance = zValues.reduce((sum, val) => sum + Math.pow(val - meanZ, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  const depthRange = maxZ - minZ;

  const noseZ = (landmarks[1]?.z + landmarks[4]?.z) / 2;
  const cheekLeftZ = landmarks[234]?.z || 0;
  const cheekRightZ = landmarks[454]?.z || 0;
  const avgCheekZ = (cheekLeftZ + cheekRightZ) / 2;
  const noseProtrusion = avgCheekZ - noseZ;

  const meetsVariance = variance >= MIN_Z_VARIANCE_THRESHOLD;
  const meetsRange = depthRange >= MIN_Z_DEPTH_RANGE_THRESHOLD;
  const meetsProtrusion = noseProtrusion > 0.015;

  const is3DLive = meetsVariance && meetsRange && meetsProtrusion;

  let confidence = (variance / (MIN_Z_VARIANCE_THRESHOLD * 2)) * 0.5 + 
                   (depthRange / (MIN_Z_DEPTH_RANGE_THRESHOLD * 2)) * 0.5;
  confidence = Math.min(Math.max(confidence, 0.1), 0.99);

  let reason = undefined;
  if (!is3DLive) {
    if (variance < MIN_Z_VARIANCE_THRESHOLD) {
      reason = 'Variansi kedalaman Z terlalu datar (terindikasi layar HP/foto 2D).';
    } else if (!meetsProtrusion) {
      reason = 'Kurvatur tonjolan hidung dan pipi tidak konsisten dengan wajah 3D asli.';
    } else {
      reason = 'Rentang kedalaman tidak memenuhi standar wajah hidup.';
    }
  }

  return {
    variance: Math.round(variance * 1000000) / 1000000,
    depthRange: Math.round(depthRange * 10000) / 10000,
    standardDeviation: Math.round(stdDev * 10000) / 10000,
    is3DLive,
    confidence: Math.round(confidence * 1000) / 1000,
    reason,
  };
}

export function aggregateMultiFrameLiveness(results: DepthAnalysisResult[]): {
  passed: boolean;
  medianVariance: number;
  averageConfidence: number;
  passRatio: number;
  primaryFailureReason?: string;
} {
  if (results.length === 0) {
    return {
      passed: false,
      medianVariance: 0,
      averageConfidence: 0,
      passRatio: 0,
      primaryFailureReason: 'Tidak ada sampel frame yang valid.',
    };
  }

  const sortedVariances = results.map((r) => r.variance).sort((a, b) => a - b);
  const mid = Math.floor(sortedVariances.length / 2);
  const medianVariance = sortedVariances.length % 2 !== 0 
    ? sortedVariances[mid] 
    : (sortedVariances[mid - 1] + sortedVariances[mid]) / 2;

  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
  const averageConfidence = totalConfidence / results.length;

  const passedFrames = results.filter((r) => r.is3DLive).length;
  const passRatio = passedFrames / results.length;

  const passed = passRatio >= 0.70 && medianVariance >= MIN_Z_VARIANCE_THRESHOLD;

  let primaryFailureReason = undefined;
  if (!passed) {
    const failedFrames = results.filter((r) => !r.is3DLive);
    primaryFailureReason = failedFrames[0]?.reason || 'Wajah tidak terdeteksi sebagai objek 3D asli.';
  }

  return {
    passed,
    medianVariance: Math.round(medianVariance * 1000000) / 1000000,
    averageConfidence: Math.round(averageConfidence * 1000) / 1000,
    passRatio: Math.round(passRatio * 100) / 100,
    primaryFailureReason,
  };
}
