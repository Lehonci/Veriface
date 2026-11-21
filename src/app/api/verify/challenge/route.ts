import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createScanChallengeToken } from '@/lib/verifyChallenge';

export const dynamic = 'force-dynamic';

/**
 * Menerbitkan one-time signed scan challenge sebelum pemindaian wajah dimulai.
 * Mencegah pemanggilan langsung ke /api/verify/pass tanpa melalui sesi pemindaian aktif.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`verify-challenge:${ip}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak permintaan sesi pemindaian. Tunggu ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    const issued = await createScanChallengeToken(ip, userAgent);

    return NextResponse.json({
      success: true,
      ...issued,
    });
  } catch (error: unknown) {
    console.error('Error issuing scan challenge:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memulai sesi tantangan pemindaian.' },
      { status: 500 }
    );
  }
}
