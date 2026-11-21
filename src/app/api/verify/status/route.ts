import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getActiveZoomConfig, buildZoomSuccessPayload } from '@/lib/zoomHelpers';
import { sendAdminNotificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyApplicantStatusAccess } from '@/lib/verifyChallenge';
import { VerificationRecord } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPEAL_TIMEOUT_SECONDS = 60;

async function findRecordById(id: string): Promise<VerificationRecord | null> {
  if (isSupabaseServerConfigured && supabaseServer) {
    const { data, error } = await supabaseServer
      .from('verifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as VerificationRecord;
  }

  return mockDB.verifications.find((v) => v.id === id) || null;
}

async function updateRecordFields(
  id: string,
  fields: Partial<VerificationRecord>
): Promise<void> {
  if (isSupabaseServerConfigured && supabaseServer) {
    const { error } = await supabaseServer
      .from('verifications')
      .update(fields)
      .eq('id', id);

    if (error) {
      console.error('Failed updating verification status:', error);
    }
    return;
  }

  const target = mockDB.verifications.find((v) => v.id === id);
  if (target) {
    Object.assign(target, fields);
  }
}

/**
 * Mengecek keputusan admin secara real-time untuk pelamar yang sedang menunggu (dengan bukti applicant status token).
 * - PASSED + PENDING melebihi auto_admit_timeout -> Fail-Safe: otomatis AUTO_ADMITTED ke Zoom.
 * - FAILED + review_requested + PENDING melebihi APPEAL_TIMEOUT_SECONDS -> Fail-Secure: tetap ditolak (REMOVED).
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`verify-status-get:${ip}`, 90, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan pengecekan status.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const queryToken = searchParams.get('st');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Parameter verification id diperlukan.' },
        { status: 400 }
      );
    }

    const hasAccess = await verifyApplicantStatusAccess(req, id, queryToken);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, message: 'Akses status ditolak: Token sesi pelamar tidak valid.' },
        { status: 403 }
      );
    }

    const record = await findRecordById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Rekaman verifikasi tidak ditemukan.' },
        { status: 404 }
      );
    }

    const activeZoom = await getActiveZoomConfig();
    const currentDecision = record.admin_decision || 'PENDING';
    const elapsedSec = Math.max(
      0,
      (Date.now() - new Date(record.created_at).getTime()) / 1000
    );

    // 1. Jika sudah di-ADMITTED atau AUTO_ADMITTED (baik PASSED maupun Override dari FAILED)
    if (currentDecision === 'ADMITTED' || currentDecision === 'AUTO_ADMITTED') {
      const payload = await buildZoomSuccessPayload(record, activeZoom);
      return NextResponse.json({
        success: true,
        status: record.status,
        adminDecision: currentDecision,
        payload,
      });
    }

    // 2. Jika ditolak eksplisit oleh admin
    if (currentDecision === 'REMOVED') {
      return NextResponse.json({
        success: true,
        status: record.status,
        adminDecision: 'REMOVED',
        timedOut: false,
      });
    }

    // 3. Jika PASSED masih PENDING -> cek batas waktu Auto-Admit (Fail-Safe)
    if (record.status === 'PASSED') {
      const timeoutSec = activeZoom.auto_admit_timeout || 30;
      const remainingSeconds = Math.max(0, Math.ceil(timeoutSec - elapsedSec));

      if (elapsedSec >= timeoutSec) {
        const nowIso = new Date().toISOString();
        await updateRecordFields(record.id, {
          admin_decision: 'AUTO_ADMITTED',
          decided_at: nowIso,
        });
        const updated = { ...record, admin_decision: 'AUTO_ADMITTED' as const };
        const payload = await buildZoomSuccessPayload(updated, activeZoom);
        return NextResponse.json({
          success: true,
          status: record.status,
          adminDecision: 'AUTO_ADMITTED',
          remainingSeconds: 0,
          payload,
        });
      }

      return NextResponse.json({
        success: true,
        status: record.status,
        adminDecision: 'PENDING',
        remainingSeconds,
        timeoutSeconds: timeoutSec,
      });
    }

    // 4. Jika SPOOF_FAILED / POOR_LIGHTING & sedang minta tinjauan (Fail-Secure)
    const appealBaseTime = record.decided_at || record.created_at;
    const appealElapsed = Math.max(
      0,
      (Date.now() - new Date(appealBaseTime).getTime()) / 1000
    );
    const remainingAppeal = Math.max(0, Math.ceil(APPEAL_TIMEOUT_SECONDS - appealElapsed));

    if (record.review_requested && appealElapsed >= APPEAL_TIMEOUT_SECONDS) {
      await updateRecordFields(record.id, {
        admin_decision: 'REMOVED',
        decided_at: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        status: record.status,
        adminDecision: 'REMOVED',
        timedOut: true,
        remainingSeconds: 0,
      });
    }

    return NextResponse.json({
      success: true,
      status: record.status,
      adminDecision: 'PENDING',
      reviewRequested: Boolean(record.review_requested),
      remainingSeconds: remainingAppeal,
      timeoutSeconds: APPEAL_TIMEOUT_SECONDS,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/verify/status:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memeriksa status verifikasi.' },
      { status: 500 }
    );
  }
}

/**
 * Mengajukan peninjauan manual admin ketika pelamar merasa terkena false rejection dari model AI.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`verify-appeal:${ip}`, 10, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan banding.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const { verificationId, statusToken } = body;

    if (!verificationId || typeof verificationId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID verifikasi diperlukan.' },
        { status: 400 }
      );
    }

    const hasAccess = await verifyApplicantStatusAccess(req, verificationId, statusToken);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, message: 'Akses banding ditolak: Token sesi pelamar tidak valid.' },
        { status: 403 }
      );
    }

    const record = await findRecordById(verificationId);
    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Rekaman verifikasi tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (record.status === 'VIRTUAL_CAM_BLOCKED') {
      return NextResponse.json(
        {
          success: false,
          message: 'Penggunaan kamera virtual tidak memenuhi syarat banding.',
        },
        { status: 403 }
      );
    }

    if (record.admin_decision === 'ADMITTED' || record.admin_decision === 'REMOVED') {
      return NextResponse.json(
        { success: false, message: 'Rekaman ini sudah diputuskan oleh administrator.' },
        { status: 409 }
      );
    }

    // Set decided_at sementara sebagai penanda waktu mulainya permintaan banding (appeal) saat status PENDING
    const requestTime = new Date().toISOString();
    await updateRecordFields(verificationId, {
      review_requested: true,
      admin_decision: 'PENDING',
      decided_at: requestTime,
    });

    const activeZoom = await getActiveZoomConfig();
    const appOrigin = req.headers.get('origin') || undefined;
    if (activeZoom.email_notification_enabled) {
      sendAdminNotificationEmail({
        record: { ...record, review_requested: true },
        eventType: 'REVIEW_REQUESTED',
        recipientEmail: activeZoom.admin_notify_email,
        appBaseUrl: appOrigin,
      }).catch((err) => console.warn('Appeal email dispatch warning:', err));
    }

    return NextResponse.json({
      success: true,
      timeoutSeconds: APPEAL_TIMEOUT_SECONDS,
      message: 'Permintaan tinjauan manual telah dikirim ke Administrator.',
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/verify/status:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengajukan peninjauan admin.' },
      { status: 500 }
    );
  }
}
