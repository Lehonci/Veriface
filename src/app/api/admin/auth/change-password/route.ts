import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { changeLoggedInAdminPassword } from '@/lib/adminCredentials';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`admin-change-pwd:${ip}`, 10, 5 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    const result = await changeLoggedInAdminPassword({
      email: auth.session.email,
      currentPassword,
      newPassword,
    });

    return NextResponse.json(
      {
        success: result.ok,
        message: result.message,
      },
      { status: result.ok ? 200 : 400 }
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/auth/change-password:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui kata sandi.' },
      { status: 500 }
    );
  }
}
