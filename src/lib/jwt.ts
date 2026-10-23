import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'identity_gateway_super_secret_key_2026_trpl_cv';
const secretKey = new TextEncoder().encode(JWT_SECRET_STRING);

export interface TokenPayload {
  sub: string;
  fullName: string;
  email: string;
  jobPosition: string;
  verifiedAt: string;
}

export async function signVerificationToken(payload: TokenPayload): Promise<string> {
  const jti = `verif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const token = await new SignJWT({
    fullName: payload.fullName,
    email: payload.email,
    jobPosition: payload.jobPosition,
    verifiedAt: payload.verifiedAt,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey);

  return token;
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}
