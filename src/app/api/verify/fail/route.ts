import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveZoomConfig,
  uploadSnapshotToStorage,
  insertVerificationRecord,
} from '@/lib/zoomHelpers';
import { sendAdminNotificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, getTrustedAppBaseUrl } from '@/lib/rateLimit';
import {
  attachApplicantStatusCookie,
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

const numOrNull = (val: unknown) =>
  val !== undefined && val !== null && Number.isFinite(Number(val)) ? Number(val) : null;

export async function POST(req: NextRequest) {
  try {
    const ipAddress = getClientIp(req);
    const limit = checkRateLimit(`verify-fail:${ipAddress}`, 25, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: `Terlalu banyak permintaan. Silakan tunggu ${limit.retryAfterSec} detik.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

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
    } = await req.json();

    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    const appOrigin = getTrustedAppBaseUrl(req);

    const challengeCheck = await consumeScanChallengeToken(challengeToken, ipAddress, userAgent, false);
    if (!challengeCheck.valid) {
      return NextResponse.json({ success: false, message: challengeCheck.reason }, { status: 403 });
    }

    const normalizedStatus: VerificationStatus = ALLOWED_FAILURE_STATUSES.includes(status)
      ? status
      : 'SPOOF_FAILED';

    const validSnapshot =
      snapshotBase64 && validateSnapshotDataUrl(snapshotBase64).valid ? snapshotBase64 : null;

    const verificationId = `spoof_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const snapshotUrl = await uploadSnapshotToStorage(verificationId, validSnapshot);

    const newRecord: VerificationRecord = {
      id: verificationId,
      full_name: typeof fullName === 'string' && fullName.trim() ? fullName.trim().slice(0, 120) : 'Anonymous Applicant',
      email: typeof email === 'string' && email.trim() ? email.trim().slice(0, 200) : 'unknown@applicant.com',
      job_position: typeof jobPosition === 'string' && jobPosition.trim() ? jobPosition.trim().slice(0, 120) : 'General Applicant',
      status: normalizedStatus,
      failure_reason:
        typeof failureReason === 'string' && failureReason.trim()
          ? failureReason.trim().slice(0, 400)
          : 'Wajah tidak terdeteksi sebagai objek 3D asli.',
      depth_variance: numOrNull(depthVariance),
      luminance_score: numOrNull(luminanceScore),
      confidence_score: numOrNull(confidenceScore),
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

    await insertVerificationRecord(newRecord);

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
    attachApplicantStatusCookie(response, statusToken, req);
    return response;
  } catch (error: unknown) {
    console.error('Error in /api/verify/fail:', error);
    return NextResponse.json({ success: false, message: 'Gagal mencatat log kegagalan verifikasi.' }, { status: 500 });
  }
}
