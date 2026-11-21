import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Memvalidasi JWT Verification Token (zoom access ticket) secara server-side.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`verify-token:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, message: 'Rate limit terlampaui.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryToken = new URL(req.url).searchParams.get('token');
  const token = bearer || queryToken;

  if (!token) {
    return NextResponse.json(
      { success: false, valid: false, message: 'Token tidak disertakan.' },
      { status: 400 }
    );
  }

  const claims = await verifyToken(token);
  if (!claims) {
    return NextResponse.json(
      { success: false, valid: false, message: 'Token verifikasi tidak valid atau kedaluwarsa.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    valid: true,
    claims: {
      sub: claims.sub,
      jti: claims.jti,
      fullName: claims.fullName,
      jobPosition: claims.jobPosition,
      verifiedAt: claims.verifiedAt,
      exp: claims.exp,
    },
  });
}
