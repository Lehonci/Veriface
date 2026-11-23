import { NextRequest, NextResponse } from 'next/server';
import { requestAdminPasswordReset } from '@/lib/adminCredentials';
import { checkRateLimit, getClientIp, getTrustedAppBaseUrl } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`admin-forgot:${ip}`, 5, 5 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak permintaan reset kata sandi. Coba lagi dalam ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Harap masukkan alamat email yang valid.' },
        { status: 400 }
      );
    }

    const trustedOrigin = getTrustedAppBaseUrl(req);
    const result = await requestAdminPasswordReset(email, trustedOrigin);

    return NextResponse.json(
      {
        success: result.sent,
        message: result.message,
      },
      { status: result.sent ? 200 : 400 }
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/auth/forgot-password:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses permintaan pemulihan kata sandi.' },
      { status: 500 }
    );
  }
}
