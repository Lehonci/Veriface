import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { getDomainSecretKey } from '@/lib/jwt';

export const ADMIN_SESSION_COOKIE = 'veriface_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 jam

export interface AdminSessionPayload {
  email: string;
  role: 'admin';
  authMethod: 'env' | 'supabase';
  jti?: string;
}

export async function signAdminSessionToken(
  email: string,
  authMethod: 'env' | 'supabase',
  rememberMe = true
): Promise<string> {
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const jti = `adm_${Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const ttlSeconds = rememberMe ? ADMIN_SESSION_TTL_SECONDS : 60 * 60 * 2;

  return new SignJWT({
    purpose: 'admin_session',
    email,
    role: 'admin',
    authMethod,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('veriface-admin')
    .setAudience('veriface-admin-portal')
    .setSubject(email)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getDomainSecretKey('admin-session'));
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getDomainSecretKey('admin-session'), {
      issuer: 'veriface-admin',
      audience: 'veriface-admin-portal',
    });

    if (payload.purpose !== 'admin_session' || payload.role !== 'admin' || !payload.email) {
      return null;
    }

    return {
      email: String(payload.email),
      role: 'admin',
      authMethod: payload.authMethod === 'supabase' ? 'supabase' : 'env',
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}

export async function getAdminSessionFromRequest(
  req: NextRequest
): Promise<AdminSessionPayload | null> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

/**
 * Guard untuk route API admin. Mengembalikan NextResponse 401 jika tidak memiliki sesi valid.
 */
export async function requireAdminSession(
  req: NextRequest
): Promise<{ session: AdminSessionPayload; errorResponse?: never } | { session?: never; errorResponse: NextResponse }> {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak: Sesi administrator tidak valid atau telah berakhir.',
        },
        { status: 401 }
      ),
    };
  }
  return { session };
}

export function isSecureTransport(req?: NextRequest): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
  return proto === 'https';
}

export function attachAdminSessionCookie(
  res: NextResponse,
  token: string,
  req?: NextRequest,
  rememberMe = true
): void {
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureTransport(req),
    path: '/',
    ...(rememberMe ? { maxAge: ADMIN_SESSION_TTL_SECONDS } : {}),
  });
}

export function clearAdminSessionCookie(res: NextResponse, req?: NextRequest): void {
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureTransport(req),
    path: '/',
    maxAge: 0,
  });
}
