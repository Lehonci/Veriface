import { NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { VerificationRecord } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let records: VerificationRecord[] = [];

    if (isSupabaseServerConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('verifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      records = data || [];
    } else {
      records = mockDB.verifications;
    }

    const total = records.length;
    const passed = records.filter((r) => r.status === 'PASSED').length;
    const spoofFailed = records.filter((r) => r.status === 'SPOOF_FAILED').length;
    const virtualCamBlocked = records.filter((r) => r.status === 'VIRTUAL_CAM_BLOCKED').length;
    const poorLighting = records.filter((r) => r.status === 'POOR_LIGHTING').length;
    const totalFailed = total - passed;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const passedVariances = records
      .filter((r) => r.status === 'PASSED' && r.depth_variance !== null)
      .map((r) => r.depth_variance as number);
    const avgPassedVariance =
      passedVariances.length > 0
        ? passedVariances.reduce((a, b) => a + b, 0) / passedVariances.length
        : 0.0032;

    const failedVariances = records
      .filter((r) => r.status === 'SPOOF_FAILED' && r.depth_variance !== null)
      .map((r) => r.depth_variance as number);
    const avgFailedVariance =
      failedVariances.length > 0
        ? failedVariances.reduce((a, b) => a + b, 0) / failedVariances.length
        : 0.00021;

    const statusDistribution = [
      { name: 'Lolos (3D Live)', value: passed, color: '#10B981' },
      { name: 'Spoof Terdeteksi', value: spoofFailed, color: '#EF4444' },
      { name: 'Virtual Cam Diblokir', value: virtualCamBlocked, color: '#F59E0B' },
      { name: 'Pencahayaan Buruk', value: poorLighting, color: '#8B5CF6' },
    ].filter((item) => item.value > 0);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        passed,
        totalFailed,
        spoofFailed,
        virtualCamBlocked,
        poorLighting,
        passRate,
        avgPassedVariance: Math.round(avgPassedVariance * 1000000) / 1000000,
        avgFailedVariance: Math.round(avgFailedVariance * 1000000) / 1000000,
        statusDistribution,
      },
    });
  } catch (error: unknown) {
    console.error('Error generating stats:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghasilkan data statistik.' },
      { status: 500 }
    );
  }
}
