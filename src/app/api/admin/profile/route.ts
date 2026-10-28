import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (isSupabaseServerConfigured && supabaseServer) {
      let query = supabaseServer.from('admins').select('id, email, full_name, role, is_active, last_login, created_at, updated_at');

      if (id) {
        query = query.eq('id', id);
      } else if (email) {
        query = query.ilike('email', email.trim());
      } else {
        // Return first active admin
        query = query.eq('is_active', true).order('created_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        return NextResponse.json(
          { success: true, admin: data[0] },
          { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }
    }

    // Default fallback
    return NextResponse.json(
      {
        success: true,
        admin: {
          id: 'default-admin',
          email: email || 'muhammadbafqi@gmail.com',
          full_name: 'Muhammad Bafqi',
          role: 'Admin',
          is_active: true,
          last_login: new Date().toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error('Fetch admin profile error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat profil admin.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, full_name, role, password } = body;

    if (!id && !email) {
      return NextResponse.json(
        { success: false, error: 'ID atau Email admin diperlukan untuk memperbarui data.' },
        { status: 400 }
      );
    }

    if (isSupabaseServerConfigured && supabaseServer) {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (full_name) updateData.full_name = full_name;
      if (role) updateData.role = role;
      if (password) updateData.password_hash = password;

      let query = supabaseServer.from('admins').update(updateData);
      if (id) {
        query = query.eq('id', id);
      } else if (email) {
        query = query.ilike('email', email.trim());
      }

      const { data, error } = await query.select();
      if (error) throw error;

      return NextResponse.json({
        success: true,
        admin: data && data.length > 0 ? data[0] : null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Profil admin diperbarui (mode lokal).',
    });
  } catch (err: any) {
    console.error('Update admin profile error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui profil admin.' },
      { status: 500 }
    );
  }
}
