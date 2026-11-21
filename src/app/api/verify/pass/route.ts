import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { signVerificationToken } from '@/lib/jwt';
import {
  getActiveZoomConfig,
  uploadSnapshotToStorage,
  buildZoomSuccessPayload,
} from '@/lib/zoomHelpers';
import { sendAdminNotificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isSecureTransport } from '@/lib/adminAuth';
import {
  APPLICANT_STATUS_COOKIE,
  consumeScanChallengeToken,
  getServerModelPolicy,
  isValidApplicantEmail,
  resolveActiveThreshold,
  signApplicantStatusToken,
  validateSnapshotDataUrl,
} from '@/lib/verifyChallenge';
import { VerificationRecord, VerificationSuccessPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const ipAddress = getClientIp(req);
    const limit = checkRateLimit(`verify-pass:${ipAddress}`, 15, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan verifikasi. Coba lagi dalam ${limit.retryAfterSec} detik.`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json();
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
    } = body;

    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    const appOrigin = req.headers.get('origin') || undefined;

    // 1. Validasi one-time scan challenge & durasi minimum pemindaian
    const challengeCheck = await consumeScanChallengeToken(
      challengeToken,
      ipAddress,
      userAgent,
      true
    );
    if (!challengeCheck.valid) {
      return NextResponse.json(
        { success: false, message: challengeCheck.reason },
        { status: 403 }
      );
    }

    // 2. Validasi identitas pelamar
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

    // 3. Validasi integritas bukti snapshot
    const snapshotCheck = validateSnapshotDataUrl(snapshotBase64);
    if (!snapshotCheck.valid) {
      return NextResponse.json(
        { success: false, message: snapshotCheck.reason },
        { status: 400 }
      );
    }

    // 4. Validasi ambang batas keamanan AI & iluminasi di sisi server
    const activeZoom = await getActiveZoomConfig();
    const modelPolicy = getServerModelPolicy();
    const activeThreshold = resolveActiveThreshold(activeZoom.liveness_mode);

    const parsedConfidence = Number(confidenceScore);
    const parsedLuminance = Number(luminanceScore);
    const parsedDepthVariance =
      depthVariance !== undefined && depthVariance !== null && Number.isFinite(Number(depthVariance))
        ? Number(depthVariance)
        : null;

    if (
      !Number.isFinite(parsedConfidence) ||
      parsedConfidence < activeThreshold ||
      parsedConfidence > 1
    ) {
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
      luminance_score: Math.round(parsedLuminance * 10) / 10,
      confidence_score: Math.round(parsedConfidence * 10000) / 10000,
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

    if (isSupabaseServerConfigured && supabaseServer) {
      const { error: insertError } = await supabaseServer.from('verifications').insert([newRecord]);
      if (insertError) console.error('Supabase insert verification (PASSED) failed:', insertError);
    } else {
      mockDB.verifications.unshift(newRecord);
    }

    // Kirim notifikasi email non-blocking ke HP/email admin jika diaktifkan
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
    response.cookies.set(APPLICANT_STATUS_COOKIE, statusToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureTransport(req),
      path: '/',
      maxAge: 2 * 60 * 60,
    });
    return response;
  } catch (error: unknown) {
    console.error('Error in /api/verify/pass:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses verifikasi.' },
      { status: 500 }
    );
  }
}
