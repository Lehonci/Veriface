import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { VerificationRecord, VerificationStatus } from '@/types';

export async function POST(req: NextRequest) {
  try {
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
    } = body;

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';

    const verificationId = `spoof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let snapshotUrl: string | null = null;

    if (snapshotBase64 && isSupabaseServerConfigured && supabaseServer) {
      try {
        const base64Data = snapshotBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${verificationId}_${Date.now()}.webp`;

        const { error: uploadError } = await supabaseServer.storage
          .from('snapshots')
          .upload(fileName, buffer, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabaseServer.storage
            .from('snapshots')
            .getPublicUrl(fileName);
          snapshotUrl = publicUrlData.publicUrl;
        } else {
          console.warn('Storage upload error:', uploadError);
          snapshotUrl = snapshotBase64;
        }
      } catch (uploadErr) {
        console.warn('Snapshot upload exception:', uploadErr);
        snapshotUrl = snapshotBase64;
      }
    } else if (snapshotBase64) {
      snapshotUrl = snapshotBase64;
    }

    const newRecord: VerificationRecord = {
      id: verificationId,
      full_name: fullName || 'Anonymous Applicant',
      email: email || 'unknown@applicant.com',
      job_position: jobPosition || 'General Applicant',
      status: status as VerificationStatus,
      failure_reason: failureReason || 'Wajah tidak terdeteksi sebagai objek 3D asli.',
      depth_variance: depthVariance !== undefined ? depthVariance : null,
      luminance_score: luminanceScore !== undefined ? luminanceScore : null,
      confidence_score: confidenceScore !== undefined ? confidenceScore : null,
      snapshot_url: snapshotUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
      jwt_token_jti: null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseServerConfigured && supabaseServer) {
      await supabaseServer.from('verifications').insert([newRecord]);
    } else {
      mockDB.verifications.unshift(newRecord);
    }

    return NextResponse.json({
      success: true,
      message: 'Insiden spoofing berhasil dicatat untuk audit keamanan.',
      verificationId,
    });
  } catch (error: unknown) {
    console.error('Error in /api/verify/fail:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mencatat log kegagalan verifikasi.' },
      { status: 500 }
    );
  }
}
