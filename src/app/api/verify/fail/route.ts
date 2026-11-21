import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getActiveZoomConfig, uploadSnapshotToStorage } from '@/lib/zoomHelpers';
import { sendAdminNotificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSecureTransport } from '@/lib/adminAuth';
import {
  APPLICANT_STATUS_COOKIE,
  consumeScanChallengeToken,
  signApplicantStatusToken,
  validateSnapshotDataUrl,
} from '@/lib/verifyChallenge';
import { VerificationRecord, VerificationStatus } from '@/types';

const ALLOWED_FAILURE_STATUSES: VerificationStatus[] = [
  'SPOOF_FAILED',
  'VIRTUAL_CAM_BLOCKED',
  'POOR_LIGHTING',
];

export async function POST(req: NextRequest) {
  try {
    const ipAddress = getClientIp(req);
    const limit = checkRateLimit(`verify-fail:${ipAddress}`, 25, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak permintaan. Silakan tunggu ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const {
      fullName,
      email,
      jobPosition,
      status = 'SPOOF_FAILED',
      failureReason,
      depthVariance,
      luminanceScore,
      confidenceScore,
      snapshotBase64,
      challengeToken,
    } = body;

    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    const appOrigin = req.headers.get('origin') || undefined;

    // Konsumsi challenge token (durasi minimal tidak dikunci ketat agar deteksi kamera virtual cepat tetap tercatat)
    const challengeCheck = await consumeScanChallengeToken(
      challengeToken,
      ipAddress,
      userAgent,
      false
    );
    if (!challengeCheck.valid) {
      return NextResponse.json(
        { success: false, message: challengeCheck.reason },
        { status: 403 }
      );
    }

    const normalizedStatus: VerificationStatus = ALLOWED_FAILURE_STATUSES.includes(status)
      ? status
      : 'SPOOF_FAILED';

    let validSnapshot: string | null = null;
    if (snapshotBase64) {
      const snapCheck = validateSnapshotDataUrl(snapshotBase64);
      if (snapCheck.valid) {
        validSnapshot = snapshotBase64;
      }
    }

    const verificationId = `spoof_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const snapshotUrl = await uploadSnapshotToStorage(verificationId, validSnapshot);

    const newRecord: VerificationRecord = {
      id: verificationId,
      full_name:
        typeof fullName === 'string' && fullName.trim()
          ? fullName.trim().slice(0, 120)
          : 'Anonymous Applicant',
      email:
        typeof email === 'string' && email.trim()
          ? email.trim().slice(0, 200)
          : 'unknown@applicant.com',
      job_position:
        typeof jobPosition === 'string' && jobPosition.trim()
          ? jobPosition.trim().slice(0, 120)
          : 'General Applicant',
      status: normalizedStatus,
      failure_reason:
        typeof failureReason === 'string' && failureReason.trim()
          ? failureReason.trim().slice(0, 400)
          : 'Wajah tidak terdeteksi sebagai objek 3D asli.',
      depth_variance:
        depthVariance !== undefined && depthVariance !== null && Number.isFinite(Number(depthVariance))
          ? Number(depthVariance)
          : null,
      luminance_score:
        luminanceScore !== undefined && luminanceScore !== null && Number.isFinite(Number(luminanceScore))
          ? Number(luminanceScore)
          : null,
      confidence_score:
        confidenceScore !== undefined && confidenceScore !== null && Number.isFinite(Number(confidenceScore))
          ? Number(confidenceScore)
          : null,
      snapshot_url: snapshotUrl,
      zoom_snapshot_url: null,
      zoom_captured_at: null,
      admin_decision: 'PENDING',
      decided_at: null,
      review_requested: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      jwt_token_jti: null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseServerConfigured && supabaseServer) {
      const { error: insertError } = await supabaseServer.from('verifications').insert([newRecord]);
      if (insertError) console.error('Supabase insert verification (FAILED) failed:', insertError);
    } else {
      mockDB.verifications.unshift(newRecord);
    }

    // Kirim alert keamanan hanya untuk SPOOF_FAILED / VIRTUAL_CAM_BLOCKED (tidak untuk POOR_LIGHTING)
    if (normalizedStatus !== 'POOR_LIGHTING') {
      const activeZoom = await getActiveZoomConfig();
      if (activeZoom.email_notification_enabled) {
        sendAdminNotificationEmail({
          record: newRecord,
          eventType: 'SPOOF_ALERT',
          recipientEmail: activeZoom.admin_notify_email,
          appBaseUrl: appOrigin,
        }).catch((err) => console.warn('Email dispatch error:', err));
      }
    }

    const statusToken = await signApplicantStatusToken(verificationId);
    const response = NextResponse.json({
      success: true,
      message: 'Insiden verifikasi berhasil dicatat untuk audit.',
      verificationId,
      statusToken,
    });
    response.cookies.set(APPLICANT_STATUS_COOKIE, statusToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureTransport(req),
      path: '/',
      maxAge: 2 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    console.error('Error in /api/verify/fail:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mencatat log kegagalan verifikasi.' },
      { status: 500 }
    );
  }
}
