import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials } from '@/lib/adminCredentials';
import { attachAdminSessionCookie, signAdminSessionToken } from '@/lib/adminAuth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`admin-login:${ip}`, 10, 5 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan login. Silakan coba kembali dalam ${limit.retryAfterSec} detik.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSec) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rememberMe = body.rememberMe !== false;

    const result = await verifyAdminCredentials(email, password);
    if (!result.ok || !result.email || !result.authMethod) {
      const status = result.errorCode === 'NOT_CONFIGURED' ? 503 : 401;
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Autentikasi gagal.',
          errorCode: result.errorCode,
        },
        { status }
      );
    }

    const token = await signAdminSessionToken(result.email, result.authMethod, rememberMe);
    const response = NextResponse.json({
      success: true,
      email: result.email,
      authMethod: result.authMethod,
    });

    attachAdminSessionCookie(response, token, req, rememberMe);
    return response;
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/auth/login:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memproses login.' },
      { status: 500 }
    );
  }
}
