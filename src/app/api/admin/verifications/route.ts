import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { uploadSnapshotToStorage, deleteSnapshotFromStorage } from '@/lib/zoomHelpers';
import { requireAdminSession } from '@/lib/adminAuth';
import { validateSnapshotDataUrl } from '@/lib/verifyChallenge';
import { AdminDecision } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }

      if (search) {
        const sanitizedSearch = search.replace(/[,%()]/g, ' ').trim();
        if (sanitizedSearch) {
          query = query.or(
            `full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,job_position.ilike.%${sanitizedSearch}%`
          );
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
      {
        success: false,
        message: 'Gagal memuat riwayat verifikasi.',
        error: typeof error === 'object' ? JSON.stringify(error) : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { id, action, decision, zoomSnapshotBase64 } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID rekaman verifikasi diperlukan.' },
        { status: 400 }
      );
    }

    // 1. Keputusan Host / Admin: Izinkan masuk atau Tolak akses
    if (action === 'DECISION') {
      if (decision !== 'ADMITTED' && decision !== 'REMOVED') {
        return NextResponse.json(
          { success: false, message: 'Keputusan tidak valid.' },
          { status: 400 }
        );
      }

      const decidedAt = new Date().toISOString();
      const updateFields = {
        admin_decision: decision as AdminDecision,
        decided_at: decidedAt,
      };

      if (isSupabaseServerConfigured && supabaseServer) {
        const { data, error } = await supabaseServer
          .from('verifications')
          .update(updateFields)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, verification: data });
      }

      const target = mockDB.verifications.find((v) => v.id === id);
      if (target) {
        target.admin_decision = decision;
        target.decided_at = decidedAt;
      }
      return NextResponse.json({ success: true, verification: target || null });
    }

    // 2. Simpan Snapshot Pembanding dari Layar Zoom (Side-by-Side Comparison)
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
      const updateFields = {
        zoom_snapshot_url: zoomSnapshotUrl,
        zoom_captured_at: capturedAt,
      };

      if (isSupabaseServerConfigured && supabaseServer) {
        const { data, error } = await supabaseServer
          .from('verifications')
          .update(updateFields)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({
          success: true,
          verification: data,
          zoom_snapshot_url: zoomSnapshotUrl,
          zoom_captured_at: capturedAt,
        });
      }

      const target = mockDB.verifications.find((v) => v.id === id);
      if (target) {
        target.zoom_snapshot_url = zoomSnapshotUrl;
        target.zoom_captured_at = capturedAt;
      }
      return NextResponse.json({
        success: true,
        verification: target || null,
        zoom_snapshot_url: zoomSnapshotUrl,
        zoom_captured_at: capturedAt,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Aksi PATCH tidak dikenali.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Error in PATCH /api/admin/verifications:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui rekaman verifikasi.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

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
      const { data: record } = await supabaseServer
        .from('verifications')
        .select('snapshot_url, zoom_snapshot_url')
        .eq('id', id)
        .single();

      await deleteSnapshotFromStorage(record?.snapshot_url);
      await deleteSnapshotFromStorage(record?.zoom_snapshot_url);

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
