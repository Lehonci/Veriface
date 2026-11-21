import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { getDomainSecretKey } from '@/lib/jwt';
import { LivenessThresholdMode } from '@/types';

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 menit
const MIN_SCAN_ELAPSED_MS = 1500; // Scan normal 2.5s; blokir burst instan tanpa menunggu scan
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024; // 4 MB
const MIN_SNAPSHOT_BYTES = 400; // Tolak dummy base64 mikro

const g = globalThis as unknown as {
  __verifaceConsumedChallenges?: Map<string, number>;
  __verifaceModelConfigCache?: { data: ServerModelPolicy; loadedAt: number };
};

const consumedChallenges = g.__verifaceConsumedChallenges || new Map<string, number>();
g.__verifaceConsumedChallenges = consumedChallenges;

export interface ServerModelPolicy {
  strictThreshold: number;
  balancedThreshold: number;
  minMeanLuma: number;
}

export function getServerModelPolicy(): ServerModelPolicy {
  const now = Date.now();
  if (g.__verifaceModelConfigCache && now - g.__verifaceModelConfigCache.loadedAt < 60_000) {
    return g.__verifaceModelConfigCache.data;
  }

  let policy: ServerModelPolicy = {
    strictThreshold: 0.7062336802482605,
    balancedThreshold: 0.6293023824691772,
    minMeanLuma: 50,
  };

  try {
    const configPath = path.join(process.cwd(), 'public', 'models', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    policy = {
      strictThreshold:
        typeof parsed.threshold === 'number' ? parsed.threshold : policy.strictThreshold,
      balancedThreshold:
        typeof parsed.eer_threshold === 'number' ? parsed.eer_threshold : policy.balancedThreshold,
      minMeanLuma:
        typeof parsed.illumination_gate_bt601?.min_mean_luma === 'number'
          ? parsed.illumination_gate_bt601.min_mean_luma
          : policy.minMeanLuma,
    };
  } catch (err) {
    console.warn('Could not read public/models/config.json on server, using safe defaults:', err);
  }

  g.__verifaceModelConfigCache = { data: policy, loadedAt: now };
  return policy;
}

export function resolveActiveThreshold(mode?: LivenessThresholdMode): number {
  const policy = getServerModelPolicy();
  return mode === 'strict' ? policy.strictThreshold : policy.balancedThreshold;
}

function hashClientBinding(ip: string, ua: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}::${ua.slice(0, 120)}`, 'utf8')
    .digest('hex')
    .slice(0, 24);
}

export async function createScanChallengeToken(ip: string, userAgent: string): Promise<{
  challengeToken: string;
  challengeId: string;
  expiresInSec: number;
}> {
  const challengeId = `chg_${crypto.randomUUID()}`;
  const issuedAtMs = Date.now();
  const binding = hashClientBinding(ip, userAgent);

  const challengeToken = await new SignJWT({
    purpose: 'scan_challenge',
    issuedAtMs,
    binding,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('veriface-gateway')
    .setAudience('scan-challenge')
    .setSubject(challengeId)
    .setJti(challengeId)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(getDomainSecretKey('scan-challenge'));

  return {
    challengeToken,
    challengeId,
    expiresInSec: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

export interface ChallengeConsumeResult {
  valid: boolean;
  challengeId?: string;
  reason?: string;
}

/**
 * Memvalidasi & mengkonsumsi challenge scan satu kali (mencegah replay & pemalsuan langsung tanpa alur scan).
 */
export async function consumeScanChallengeToken(
  token: string | undefined | null,
  ip: string,
  userAgent: string,
  enforceMinDuration = true
): Promise<ChallengeConsumeResult> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      reason: 'Token sesi pemindaian (scan challenge) tidak ditemukan atau sudah kedaluwarsa.',
    };
  }

  // Cleanup expired nonces
  const now = Date.now();
  if (consumedChallenges.size > 2000) {
    for (const [k, expAt] of consumedChallenges.entries()) {
      if (expAt < now) consumedChallenges.delete(k);
    }
  }

  try {
    const { payload } = await jwtVerify(token, getDomainSecretKey('scan-challenge'), {
      issuer: 'veriface-gateway',
      audience: 'scan-challenge',
    });

    if (payload.purpose !== 'scan_challenge' || !payload.jti) {
      return { valid: false, reason: 'Token tantangan pemindaian tidak valid.' };
    }

    const challengeId = String(payload.jti);
    if (consumedChallenges.has(challengeId)) {
      return {
        valid: false,
        reason: 'Sesi pemindaian ini sudah digunakan. Silakan pindai ulang wajah Anda.',
      };
    }

    const expectedBinding = hashClientBinding(ip, userAgent);
    if (payload.binding && payload.binding !== expectedBinding) {
      return {
        valid: false,
        reason: 'Sesi pemindaian tidak cocok dengan perangkat atau sesi jaringan pemohon.',
      };
    }

    const issuedAtMs = Number(payload.issuedAtMs || 0);
    if (enforceMinDuration && issuedAtMs > 0 && now - issuedAtMs < MIN_SCAN_ELAPSED_MS) {
      return {
        valid: false,
        reason: 'Durasi pemindaian terlalu singkat atau tidak melalui proses liveness kamera.',
      };
    }

    consumedChallenges.set(challengeId, now + CHALLENGE_TTL_MS);
    return { valid: true, challengeId };
  } catch {
    return {
      valid: false,
      reason: 'Sesi pemindaian tidak valid atau telah kedaluwarsa. Muat ulang scan Anda.',
    };
  }
}

export interface SnapshotValidationResult {
  valid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  extension?: 'jpg' | 'png' | 'webp';
  reason?: string;
}

export function validateSnapshotDataUrl(snapshotBase64: unknown): SnapshotValidationResult {
  if (typeof snapshotBase64 !== 'string' || !snapshotBase64) {
    return { valid: false, reason: 'Bukti snapshot wajah wajib disertakan.' };
  }

  const match = snapshotBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    return {
      valid: false,
      reason: 'Format gambar snapshot tidak valid (harus JPEG/PNG/WebP base64).',
    };
  }

  const rawSubtype = match[1].toLowerCase();
  const base64Body = match[2];
  const byteSize = Math.floor((base64Body.length * 3) / 4);

  if (byteSize < MIN_SNAPSHOT_BYTES) {
    return { valid: false, reason: 'Ukuran gambar snapshot terlalu kecil atau korup.' };
  }
  if (byteSize > MAX_SNAPSHOT_BYTES) {
    return { valid: false, reason: 'Ukuran gambar snapshot melebihi batas maksimal 4 MB.' };
  }

  const mimeType =
    rawSubtype === 'png'
      ? 'image/png'
      : rawSubtype === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  const extension =
    rawSubtype === 'png' ? 'png' : rawSubtype === 'webp' ? 'webp' : 'jpg';

  return { valid: true, mimeType, extension };
}

export function isValidApplicantEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

export const APPLICANT_STATUS_COOKIE = 'veriface_applicant_status';

export async function signApplicantStatusToken(verificationId: string): Promise<string> {
  return new SignJWT({
    purpose: 'applicant_status',
    verificationId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('veriface-gateway')
    .setAudience('applicant-status')
    .setSubject(verificationId)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getDomainSecretKey('applicant-status'));
}

export async function verifyApplicantStatusAccess(
  req: NextRequest,
  verificationId: string,
  bodyOrQueryToken?: string | null
): Promise<boolean> {
  const candidates = [
    bodyOrQueryToken,
    req.headers.get('x-status-token'),
    req.cookies.get(APPLICANT_STATUS_COOKIE)?.value,
  ].filter((t): t is string => Boolean(t));

  for (const token of candidates) {
    try {
      const { payload } = await jwtVerify(token, getDomainSecretKey('applicant-status'), {
        issuer: 'veriface-gateway',
        audience: 'applicant-status',
      });
      if (
        payload.purpose === 'applicant_status' &&
        (payload.verificationId === verificationId || payload.sub === verificationId)
      ) {
        return true;
      }
    } catch {
      // Coba kandidat berikutnya
    }
  }

  return false;
}
