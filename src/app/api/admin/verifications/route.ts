import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { uploadSnapshotToStorage, deleteSnapshotFromStorage } from '@/lib/zoomHelpers';
import { requireAdminSession } from '@/lib/adminAuth';
import { validateSnapshotDataUrl } from '@/lib/verifyChallenge';
import { AdminDecision, VerificationRecord } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function updateVerificationFields(
  id: string,
  fields: Partial<VerificationRecord>
): Promise<VerificationRecord | null> {
  if (isSupabaseServerConfigured && supabaseServer) {
    const { data, error } = await supabaseServer
      .from('verifications')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as VerificationRecord;
  }

  const target = mockDB.verifications.find((v) => v.id === id) || null;
  if (target) Object.assign(target, fields);
  return target;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, parsedLimit)) : 50;

    if (isSupabaseServerConfigured && supabaseServer) {
      let query = supabaseServer
        .from('verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'ALL') query = query.eq('status', status);
      if (search) {
        const clean = search.replace(/[,%()]/g, ' ').trim();
        if (clean) {
          query = query.or(`full_name.ilike.%${clean}%,email.ilike.%${clean}%,job_position.ilike.%${clean}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(
        { success: true, verifications: data },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    let list = [...mockDB.verifications];
    if (status && status !== 'ALL') list = list.filter((v) => v.status === status);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.full_name.toLowerCase().includes(s) ||
          v.email.toLowerCase().includes(s) ||
          (v.job_position || v.jobPosition || '').toLowerCase().includes(s)
      );
    }

    return NextResponse.json({ success: true, verifications: list.slice(0, limit) });
  } catch (error: unknown) {
    console.error('Error fetching verifications:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat riwayat verifikasi.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id, action, decision, zoomSnapshotBase64 } = await req.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, message: 'ID rekaman verifikasi diperlukan.' }, { status: 400 });
    }

    if (action === 'DECISION') {
      if (decision !== 'ADMITTED' && decision !== 'REMOVED') {
        return NextResponse.json({ success: false, message: 'Keputusan tidak valid.' }, { status: 400 });
      }
      const verification = await updateVerificationFields(id, {
        admin_decision: decision as AdminDecision,
        decided_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, verification });
    }

    if (action === 'ZOOM_SNAPSHOT') {
      const snapCheck = validateSnapshotDataUrl(zoomSnapshotBase64);
      if (!snapCheck.valid) {
        return NextResponse.json(
          { success: false, message: snapCheck.reason || 'Data gambar snapshot Zoom tidak valid.' },
          { status: 400 }
        );
      }

      const zoomSnapshotUrl = await uploadSnapshotToStorage(`zoom_${id}`, zoomSnapshotBase64);
      const capturedAt = new Date().toISOString();
      const verification = await updateVerificationFields(id, {
        zoom_snapshot_url: zoomSnapshotUrl,
        zoom_captured_at: capturedAt,
      });

      return NextResponse.json({
        success: true,
        verification,
        zoom_snapshot_url: zoomSnapshotUrl,
        zoom_captured_at: capturedAt,
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi PATCH tidak dikenali.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in PATCH /api/admin/verifications:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui rekaman verifikasi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID rekaman verifikasi diperlukan.' }, { status: 400 });
    }

    if (isSupabaseServerConfigured && supabaseServer) {
      const { data: record } = await supabaseServer
        .from('verifications')
        .select('snapshot_url, zoom_snapshot_url')
        .eq('id', id)
        .single();

      await deleteSnapshotFromStorage(record?.snapshot_url);
      await deleteSnapshotFromStorage(record?.zoom_snapshot_url);

      const { error } = await supabaseServer.from('verifications').delete().eq('id', id);
      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Rekaman verifikasi berhasil dihapus.' });
    }

    mockDB.verifications = mockDB.verifications.filter((v) => v.id !== id);
    return NextResponse.json({ success: true, message: 'Rekaman verifikasi berhasil dihapus dari memori.' });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/admin/verifications:', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus rekaman verifikasi.' }, { status: 500 });
  }
}
