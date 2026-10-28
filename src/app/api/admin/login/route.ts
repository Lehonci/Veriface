import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    if (isSupabaseServerConfigured && supabaseServer) {
      const { data: admins, error } = await supabaseServer
        .from('admins')
        .select('*')
        .ilike('email', trimmedEmail);

      if (error) {
        console.error('Supabase admin login error:', error);
      }

      if (admins && admins.length > 0) {
        const admin = admins[0];

        if (admin.is_active === false) {
          return NextResponse.json(
            { success: false, error: 'Akun administrator ini dinonaktifkan.' },
            { status: 403 }
          );
        }

        // Check password matching plain string or exact hash
        if (admin.password_hash === password) {
          const now = new Date().toISOString();
          try {
            await supabaseServer
              .from('admins')
              .update({ last_login: now })
              .eq('id', admin.id);
          } catch (e) {
            console.error('Failed to update last_login:', e);
          }

          return NextResponse.json({
            success: true,
            admin: {
              id: admin.id,
              email: admin.email,
              full_name: admin.full_name,
              role: admin.role || 'Admin',
              last_login: now,
            },
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Kata sandi tidak sesuai.' },
            { status: 401 }
          );
        }
      }
    }

    // Fallback for demo credentials
    if (
      (trimmedEmail === 'admin@veriface.id' || trimmedEmail === 'admin@verigate.id' || trimmedEmail === 'admin@company.com') &&
      (password === 'admin123' || password === 'adminpassword123')
    ) {
      return NextResponse.json({
        success: true,
        admin: {
          id: 'demo-admin-id',
          email: trimmedEmail,
          full_name: 'Super Administrator',
          role: 'Super Admin',
          last_login: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Email atau kata sandi tidak terdaftar di database.' },
      { status: 401 }
    );
  } catch (err: any) {
    console.error('Admin login error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Terjadi kesalahan server saat login.' },
      { status: 500 }
    );
  }
}
