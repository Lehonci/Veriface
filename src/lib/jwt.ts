import { SignJWT, jwtVerify } from 'jose';

const WEAK_PLACEHOLDERS = [
  'identity_gateway_super_secret_key_2026_trpl_cv',
  'your-secret',
  'changeme',
  'placeholder',
];

function getBaseJwtSecret(): string {
  const envSecret = (process.env.JWT_SECRET || '').trim();
  const isWeak =
    !envSecret ||
    envSecret.length < 16 ||
    WEAK_PLACEHOLDERS.some((p) => envSecret.toLowerCase().includes(p));

  if (!isWeak) {
    return envSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET belum diset atau terlalu lemah (>= 16 karakter wajib di production).'
    );
  }

  // Fallback ephemeral per-process khusus mode dev agar tidak ada static hardcoded secret di source code
  const g = globalThis as unknown as { __verifaceDevJwtSecret?: string; __verifaceJwtWarned?: boolean };
  if (!g.__verifaceJwtWarned) {
    g.__verifaceJwtWarned = true;
    console.warn(
      '[VeriFace Security] JWT_SECRET belum dikonfigurasi dengan kuat di .env.local — menggunakan secret ephemeral dev sementara.'
    );
  }
  if (!g.__verifaceDevJwtSecret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    g.__verifaceDevJwtSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return g.__verifaceDevJwtSecret;
}

/**
 * Menghasilkan signing key terisolasi per domain agar token berbeda tujuan tidak dapat ditukar silang.
 */
export function getDomainSecretKey(domain: string): Uint8Array {
  return new TextEncoder().encode(`${getBaseJwtSecret()}::${domain}`);
}

export interface TokenPayload {
  sub: string; // verificationId
  fullName: string;
  email: string;
  jobPosition: string;
  verifiedAt: string;
}

export async function signVerificationToken(payload: TokenPayload): Promise<string> {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const jti = `verif_${Date.now()}_${randHex}`;

  const token = await new SignJWT({
    purpose: 'zoom_access',
    fullName: payload.fullName,
    email: payload.email,
    jobPosition: payload.jobPosition,
    verifiedAt: payload.verifiedAt,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('veriface-gateway')
    .setAudience('zoom-admission')
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getDomainSecretKey('zoom-access'));

  return token;
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getDomainSecretKey('zoom-access'), {
      issuer: 'veriface-gateway',
      audience: 'zoom-admission',
    });
    if (payload.purpose !== 'zoom_access') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
