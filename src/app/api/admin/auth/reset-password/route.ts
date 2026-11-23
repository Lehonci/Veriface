import { NextRequest, NextResponse } from 'next/server';
import { completeAdminPasswordReset } from '@/lib/adminCredentials';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`admin-reset-pwd:${ip}`, 8, 5 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan reset. Coba lagi dalam ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const resetToken = typeof body.resetToken === 'string' ? body.resetToken.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    const result = await completeAdminPasswordReset(resetToken, newPassword);
    return NextResponse.json(
      {
        success: result.ok,
        email: result.email,
        message: result.message,
      },
      { status: result.ok ? 200 : 400 }
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/auth/reset-password:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses pengaturan ulang kata sandi.' },
      { status: 500 }
    );
  }
}
