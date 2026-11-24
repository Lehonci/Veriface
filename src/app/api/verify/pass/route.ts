import { NextRequest, NextResponse } from 'next/server';
import { signVerificationToken } from '@/lib/jwt';
import {
  getActiveZoomConfig,
  uploadSnapshotToStorage,
  buildZoomSuccessPayload,
  insertVerificationRecord,
} from '@/lib/zoomHelpers';
import { sendAdminNotificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, getTrustedAppBaseUrl } from '@/lib/rateLimit';
import {
  attachApplicantStatusCookie,
  consumeScanChallengeToken,
  getServerModelPolicy,
  isValidApplicantEmail,
  resolveActiveThreshold,
  signApplicantStatusToken,
  validateSnapshotDataUrl,
} from '@/lib/verifyChallenge';
import { verifySnapshotWithServerOnnx } from '@/lib/serverOnnxVerify';
import { VerificationRecord, VerificationSuccessPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = getClientIp(req);
    const limit = checkRateLimit(`verify-pass:${ipAddress}`, 15, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: `Terlalu banyak percobaan verifikasi. Coba lagi dalam ${limit.retryAfterSec} detik.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const {
      fullName,
      email,
      jobPosition,
      depthVariance,
      luminanceScore,
      confidenceScore,
      snapshotBase64,
      challengeToken,
      virtualCameraDetected,
      activeLiveness,
    } = await req.json();

    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    const appOrigin = getTrustedAppBaseUrl(req);

    const challengeCheck = await consumeScanChallengeToken(challengeToken, ipAddress, userAgent, true);
    if (!challengeCheck.valid) {
      return NextResponse.json({ success: false, message: challengeCheck.reason }, { status: 403 });
    }

    const activePassed =
      activeLiveness?.blinkDetected === true &&
      activeLiveness?.turnRightDetected === true &&
      activeLiveness?.turnLeftDetected === true;
    if (!activePassed) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Uji Active Liveness (kedip mata & tengok kanan-kiri) belum lengkap. Silakan pindai ulang wajah Anda.',
        },
        { status: 403 }
      );
    }

    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanPosition = typeof jobPosition === 'string' ? jobPosition.trim() : '';

    if (cleanName.length < 2 || !isValidApplicantEmail(cleanEmail) || cleanPosition.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Data identitas pelamar tidak valid atau belum lengkap.' },
        { status: 400 }
      );
    }

    if (virtualCameraDetected) {
      return NextResponse.json(
        { success: false, message: 'Kamera virtual tidak diizinkan untuk kelulusan verifikasi.' },
        { status: 403 }
      );
    }

    const snapshotCheck = validateSnapshotDataUrl(snapshotBase64);
    if (!snapshotCheck.valid) {
      return NextResponse.json({ success: false, message: snapshotCheck.reason }, { status: 400 });
    }

    const activeZoom = await getActiveZoomConfig();
    const modelPolicy = getServerModelPolicy();
    const activeThreshold = resolveActiveThreshold(activeZoom.liveness_mode);

    const parsedConfidence = Number(confidenceScore);
    const parsedLuminance = Number(luminanceScore);
    const parsedDepthVariance =
      depthVariance !== undefined && depthVariance !== null && Number.isFinite(Number(depthVariance))
        ? Number(depthVariance)
        : null;

    if (!Number.isFinite(parsedConfidence) || parsedConfidence < activeThreshold || parsedConfidence > 1) {
      return NextResponse.json(
        {
          success: false,
          message: `Skor liveness (${Number.isFinite(parsedConfidence) ? (parsedConfidence * 100).toFixed(1) : '0'}%) tidak memenuhi ambang batas keamanan server (${(activeThreshold * 100).toFixed(1)}%).`,
        },
        { status: 403 }
      );
    }

    if (!Number.isFinite(parsedLuminance) || parsedLuminance < modelPolicy.minMeanLuma) {
      return NextResponse.json(
        {
          success: false,
          message: `Skor pencahayaan (${Number.isFinite(parsedLuminance) ? parsedLuminance.toFixed(0) : '0'}) di bawah batas minimal ${modelPolicy.minMeanLuma}.`,
        },
        { status: 403 }
      );
    }

    let serverAudit;
    try {
      serverAudit = await verifySnapshotWithServerOnnx({
        snapshotBase64,
        activeThreshold,
        occlusionThreshold: modelPolicy.occlusionHoldThreshold,
        minMeanLuma: modelPolicy.minMeanLuma,
        claimedConfidence: parsedConfidence,
      });
    } catch (decodeErr) {
      console.warn('Server snapshot decode error:', decodeErr);
      return NextResponse.json(
        { success: false, message: 'Citra snapshot tidak dapat didekode oleh server.' },
        { status: 400 }
      );
    }

    if (!serverAudit.verified) {
      return NextResponse.json(
        {
          success: false,
          message: serverAudit.reason || 'Verifikasi ulang ONNX di server menolak keaslian snapshot wajah.',
        },
        { status: 403 }
      );
    }

    const verificationId = `verif_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const snapshotUrl = await uploadSnapshotToStorage(verificationId, snapshotBase64);
    const isAutoRedirect = Boolean(activeZoom.auto_redirect);
    const nowIso = new Date().toISOString();

    const token = await signVerificationToken({
      sub: verificationId,
      fullName: cleanName,
      email: cleanEmail,
      jobPosition: cleanPosition,
      verifiedAt: nowIso,
    });

    const newRecord: VerificationRecord = {
      id: verificationId,
      full_name: cleanName,
      email: cleanEmail,
      job_position: cleanPosition,
      status: 'PASSED',
      failure_reason: null,
      depth_variance: parsedDepthVariance,
      luminance_score: Math.round(serverAudit.meanLuma * 10) / 10,
      confidence_score: Math.round(serverAudit.livenessScore * 10000) / 10000,
      snapshot_url: snapshotUrl,
      zoom_snapshot_url: null,
      zoom_captured_at: null,
      admin_decision: isAutoRedirect ? 'AUTO_ADMITTED' : 'PENDING',
      decided_at: isAutoRedirect ? nowIso : null,
      review_requested: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      jwt_token_jti: token.substring(0, 32),
      created_at: nowIso,
    };

    await insertVerificationRecord(newRecord);

    if (activeZoom.email_notification_enabled) {
      sendAdminNotificationEmail({
        record: newRecord,
        eventType: 'PASSED_WAITING',
        recipientEmail: activeZoom.admin_notify_email,
        appBaseUrl: appOrigin,
      }).catch((err) => console.warn('Email dispatch error:', err));
    }

    const statusToken = await signApplicantStatusToken(verificationId);
    const payload: VerificationSuccessPayload = isAutoRedirect
      ? await buildZoomSuccessPayload(newRecord, activeZoom)
      : {
          success: true,
          verificationId,
          requiresApproval: true,
          adminDecision: 'PENDING',
          autoAdmitTimeout: activeZoom.auto_admit_timeout,
          meetingTitle: activeZoom.meeting_title,
          displayNameGuide: `[${cleanPosition}] - ${cleanName}`,
        };

    payload.statusToken = statusToken;

    const response = NextResponse.json(payload);
    attachApplicantStatusCookie(response, statusToken, req);
    return response;
  } catch (error: unknown) {
    console.error('Error in /api/verify/pass:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses verifikasi.' },
      { status: 500 }
    );
  }
}
