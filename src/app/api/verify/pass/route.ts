import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { signVerificationToken } from '@/lib/jwt';
import { VerificationRecord, VerificationSuccessPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      email,
      jobPosition,
      depthVariance,
      luminanceScore,
      confidenceScore,
      snapshotBase64,
    } = body;

    if (!fullName || !email || !jobPosition) {
      return NextResponse.json(
        { success: false, message: 'Data identitas pelamar tidak lengkap.' },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';

    let activeZoom = {
      meeting_title: 'Wawancara Kerja Online',
      zoom_url: 'https://zoom.us/j/1234567890?pwd=interview_demo',
      passcode: 'TECH2026',
    };

    if (isSupabaseServerConfigured && supabaseServer) {
      const { data: zoomData } = await supabaseServer
        .from('zoom_settings')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (zoomData) {
        activeZoom = zoomData;
      }
    } else {
      const activeMock = mockDB.zoomSettings.find((z) => z.is_active);
      if (activeMock) {
        activeZoom = activeMock;
      }
    }

    const verificationId = `verif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
          console.warn('Storage upload error (pass):', uploadError);
          snapshotUrl = snapshotBase64;
        }
      } catch (uploadErr) {
        console.warn('Snapshot upload exception (pass):', uploadErr);
        snapshotUrl = snapshotBase64;
      }
    } else if (snapshotBase64) {
      snapshotUrl = snapshotBase64;
    }

    const token = await signVerificationToken({
      sub: verificationId,
      fullName,
      email,
      jobPosition,
      verifiedAt: new Date().toISOString(),
    });

    const newRecord: VerificationRecord = {
      id: verificationId,
      full_name: fullName,
      email,
      job_position: jobPosition,
      status: 'PASSED',
      failure_reason: null,
      depth_variance: depthVariance || 0.0028,
      luminance_score: luminanceScore || 65.0,
      confidence_score: confidenceScore || 0.96,
      snapshot_url: snapshotUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
      jwt_token_jti: token.substring(0, 32),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseServerConfigured && supabaseServer) {
      const { error: insertError } = await supabaseServer.from('verifications').insert([newRecord]);
      if (insertError) console.error('Supabase insert verification (PASSED) failed:', insertError);
    } else {
      mockDB.verifications.unshift(newRecord);
    }

    const responsePayload: VerificationSuccessPayload = {
      success: true,
      zoomUrl: activeZoom.zoom_url,
      passcode: activeZoom.passcode,
      meetingTitle: activeZoom.meeting_title,
      token,
      displayNameGuide: `[${jobPosition}] - ${fullName}`,
      expiresIn: 900,
    };

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    console.error('Error in /api/verify/pass:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses verifikasi.' },
      { status: 500 }
    );
  }
}
