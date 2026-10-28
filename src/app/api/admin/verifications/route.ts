import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (isSupabaseServerConfigured && supabaseServer) {
      let query = supabaseServer
        .from('verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,job_position.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json(
        { success: true, verifications: data },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    let list = [...mockDB.verifications];

    if (status && status !== 'ALL') {
      list = list.filter((v) => v.status === status);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.full_name.toLowerCase().includes(s) ||
          v.email.toLowerCase().includes(s) ||
          (v.job_position && v.job_position.toLowerCase().includes(s)) ||
          (v.jobPosition && v.jobPosition.toLowerCase().includes(s))
      );
    }

    list = list.slice(0, limit);

    return NextResponse.json({ success: true, verifications: list });
  } catch (error: unknown) {
    console.error('Error fetching verifications:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat riwayat verifikasi.', error: typeof error === 'object' ? JSON.stringify(error) : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID rekaman verifikasi diperlukan.' },
        { status: 400 }
      );
    }

    if (isSupabaseServerConfigured && supabaseServer) {
      // Find record to clean up snapshot in storage if it exists
      const { data: record } = await supabaseServer
        .from('verifications')
        .select('snapshot_url')
        .eq('id', id)
        .single();

      if (record?.snapshot_url && record.snapshot_url.includes('/snapshots/')) {
        try {
          const fileName = record.snapshot_url.split('/snapshots/').pop();
          if (fileName) {
            await supabaseServer.storage.from('snapshots').remove([fileName]);
          }
        } catch (storageErr) {
          console.warn('Storage delete warning:', storageErr);
        }
      }

      const { error } = await supabaseServer
        .from('verifications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: 'Rekaman verifikasi berhasil dihapus.',
      });
    }

    mockDB.verifications = mockDB.verifications.filter((v) => v.id !== id);
    return NextResponse.json({
      success: true,
      message: 'Rekaman verifikasi berhasil dihapus dari memori.',
    });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/admin/verifications:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus rekaman verifikasi.' },
      { status: 500 }
    );
  }
}
