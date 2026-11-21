import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface AdminCredentialResult {
  ok: boolean;
  email?: string;
  authMethod?: 'env' | 'supabase';
  errorCode?: 'INVALID_CREDENTIALS' | 'NOT_CONFIGURED';
  message?: string;
}

function sha256TimingSafeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function getEnvAdminConfig() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const isConfigured =
    Boolean(email) &&
    Boolean(password) &&
    password !== 'placeholder' &&
    password.length >= 6;
  return { email, password, isConfigured };
}

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key || url.includes('your-project-id')) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Memverifikasi kredensial admin di sisi server:
 * 1. Environment credentials (ADMIN_EMAIL + ADMIN_PASSWORD) dengan constant-time timingSafeEqual.
 * 2. Supabase Auth (signInWithPassword) apabila akun admin terdaftar di Supabase Auth.
 */
export async function verifyAdminCredentials(
  inputEmail: string,
  inputPassword: string
): Promise<AdminCredentialResult> {
  const normalizedEmail = (inputEmail || '').trim().toLowerCase();
  const password = inputPassword || '';

  if (!normalizedEmail || !password) {
    return {
      ok: false,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Email dan kata sandi wajib diisi.',
    };
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin.isConfigured) {
    const emailMatches = sha256TimingSafeEqual(
      normalizedEmail,
      envAdmin.email.toLowerCase()
    );
    const passwordMatches = sha256TimingSafeEqual(password, envAdmin.password);

    if (emailMatches && passwordMatches) {
      return {
        ok: true,
        email: envAdmin.email,
        authMethod: 'env',
      };
    }
  }

  // Fallback ke Supabase Auth apabila user adalah akun Admin yang terdaftar di Supabase Auth
  const supabaseAuth = getSupabasePublicClient();
  if (supabaseAuth) {
    try {
      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.user?.email) {
        // Jika ADMIN_EMAIL dikonfigurasi, batasi akses admin hanya ke email whitelist atau role app_metadata
        const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
        const emailAllowed =
          !envAdmin.isConfigured ||
          data.user.email.toLowerCase() === envAdmin.email.toLowerCase() ||
          role === 'admin';

        if (emailAllowed) {
          return {
            ok: true,
            email: data.user.email,
            authMethod: 'supabase',
          };
        }
      }
    } catch (err) {
      console.warn('Supabase Auth login check failed:', err);
    }
  }

  if (!envAdmin.isConfigured && !supabaseAuth) {
    return {
      ok: false,
      errorCode: 'NOT_CONFIGURED',
      message:
        'Autentikasi administrator belum dikonfigurasi di server. Harap set ADMIN_EMAIL dan ADMIN_PASSWORD pada .env.local atau daftarkan akun di Supabase Auth.',
    };
  }

  return {
    ok: false,
    errorCode: 'INVALID_CREDENTIALS',
    message: 'Email atau kata sandi administrator salah.',
  };
}

/**
 * Mengirim tautan reset password menggunakan Supabase Auth jika tersedia.
 */
export async function requestAdminPasswordReset(
  inputEmail: string,
  redirectTo?: string
): Promise<{ sent: boolean; message: string }> {
  const normalizedEmail = (inputEmail || '').trim().toLowerCase();
  const envAdmin = getEnvAdminConfig();
  const supabaseAuth = getSupabasePublicClient();

  if (supabaseAuth) {
    try {
      const { error } = await supabaseAuth.auth.resetPasswordForEmail(
        normalizedEmail,
        redirectTo ? { redirectTo } : undefined
      );
      if (!error) {
        return {
          sent: true,
          message:
            'Jika email terdaftar di Supabase Auth, tautan pemulihan kata sandi telah dikirim.',
        };
      }
    } catch (err) {
      console.warn('Supabase password reset warning:', err);
    }
  }

  if (envAdmin.isConfigured && normalizedEmail === envAdmin.email.toLowerCase()) {
    return {
      sent: false,
      message:
        'Akun admin memakai kredensial server (.env.local). Untuk mengubah kata sandi, perbarui ADMIN_PASSWORD di file konfigurasi server atau daftarkan user ke Supabase Auth.',
    };
  }

  return {
    sent: false,
    message:
      'Pemulihan otomatis hanya tersedia untuk akun Supabase Auth. Hubungi pengelola sistem untuk mereset ADMIN_PASSWORD server.',
  };
}
