import crypto from 'crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import { getDomainSecretKey } from '@/lib/jwt';
import { supabaseServer, hasSupabaseServiceRole } from '@/lib/supabase/server';
import {
  getConfiguredRecoveryInbox,
  isGmailSmtpConfigured,
  sendAdminPasswordResetEmail,
} from '@/lib/email';

export interface AdminCredentialResult {
  ok: boolean;
  email?: string;
  authMethod?: 'env' | 'supabase';
  errorCode?: 'INVALID_CREDENTIALS' | 'NOT_CONFIGURED';
  message?: string;
}

const sha256Hex = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

function sha256TimingSafeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function getEnvAdminConfig() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const isConfigured =
    Boolean(email) && Boolean(password) && password !== 'placeholder' && password.length >= 6;
  return { email, password, isConfigured };
}

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key || url.includes('your-project-id')) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findSupabaseUserByEmail(email: string): Promise<User | null> {
  if (!hasSupabaseServiceRole || !supabaseServer) return null;
  const target = email.trim().toLowerCase();
  const { data, error } = await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  return (data.users as User[]).find((u) => (u.email || '').toLowerCase() === target) || null;
}

async function trySupabasePasswordLogin(
  supabaseAuth: SupabaseClient,
  email: string,
  password: string,
  whitelistEmail: string
): Promise<AdminCredentialResult | null> {
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error || !data.user?.email) return null;

    const isAdminRole = data.user.app_metadata?.role === 'admin';
    const allowed =
      isAdminRole ||
      (Boolean(whitelistEmail) &&
        data.user.email.toLowerCase() === whitelistEmail.toLowerCase());

    return allowed ? { ok: true, email: data.user.email, authMethod: 'supabase' } : null;
  } catch (err) {
    console.warn('Supabase Auth login check failed:', err);
    return null;
  }
}

/**
 * Memverifikasi kredensial admin di server.
 * Jika akun sudah terdaftar di Supabase Auth, validasi wajib melalui Supabase Auth
 * sehingga password baru langsung menggantikan ADMIN_PASSWORD awal di .env.local.
 */
export async function verifyAdminCredentials(
  inputEmail: string,
  inputPassword: string
): Promise<AdminCredentialResult> {
  const normalizedEmail = (inputEmail || '').trim().toLowerCase();
  const password = inputPassword || '';
  if (!normalizedEmail || !password) {
    return { ok: false, errorCode: 'INVALID_CREDENTIALS', message: 'Email dan kata sandi wajib diisi.' };
  }

  const envAdmin = getEnvAdminConfig();
  const supabaseAuth = getSupabasePublicClient();
  const existingSupabaseUser = await findSupabaseUserByEmail(normalizedEmail);

  if (existingSupabaseUser && supabaseAuth) {
    const res = await trySupabasePasswordLogin(supabaseAuth, normalizedEmail, password, envAdmin.email);
    return res || { ok: false, errorCode: 'INVALID_CREDENTIALS', message: 'Email atau kata sandi administrator salah.' };
  }

  if (
    envAdmin.isConfigured &&
    sha256TimingSafeEqual(normalizedEmail, envAdmin.email.toLowerCase()) &&
    sha256TimingSafeEqual(password, envAdmin.password)
  ) {
    return { ok: true, email: envAdmin.email, authMethod: 'env' };
  }

  if (supabaseAuth && !existingSupabaseUser) {
    const res = await trySupabasePasswordLogin(supabaseAuth, normalizedEmail, password, envAdmin.email);
    if (res) return res;
  }

  if (!envAdmin.isConfigured && !supabaseAuth) {
    return {
      ok: false,
      errorCode: 'NOT_CONFIGURED',
      message:
        'Autentikasi administrator belum dikonfigurasi di server. Harap set ADMIN_EMAIL dan ADMIN_PASSWORD pada .env.local atau daftarkan akun di Supabase Auth.',
    };
  }

  return { ok: false, errorCode: 'INVALID_CREDENTIALS', message: 'Email atau kata sandi administrator salah.' };
}

/**
 * Mengirim tautan reset password via Gmail SMTP. Untuk ADMIN_EMAIL alias (mis. admin@veriface.com),
 * email pemulihan otomatis dikirimkan ke ADMIN_NOTIFY_EMAIL / SMTP_USER.
 */
export async function requestAdminPasswordReset(
  inputEmail: string,
  baseOrigin?: string
): Promise<{ sent: boolean; message: string }> {
  const normalizedEmail = (inputEmail || '').trim().toLowerCase();
  const envAdmin = getEnvAdminConfig();
  const supabaseAuth = getSupabasePublicClient();
  const origin =
    baseOrigin?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';

  let authUser = await findSupabaseUserByEmail(normalizedEmail);
  const matchesEnvEmail = Boolean(envAdmin.email) && normalizedEmail === envAdmin.email.toLowerCase();

  if (!authUser && matchesEnvEmail && envAdmin.isConfigured && hasSupabaseServiceRole && supabaseServer) {
    const { data: created, error: createErr } = await supabaseServer.auth.admin.createUser({
      email: envAdmin.email,
      password: envAdmin.password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    if (!createErr && created?.user) authUser = created.user;
  }

  if (!authUser?.email) {
    return {
      sent: false,
      message:
        'Email administrator tidak ditemukan. Pastikan email sesuai ADMIN_EMAIL di .env.local atau terdaftar di Supabase Authentication -> Users.',
    };
  }

  const recoveryInbox = getConfiguredRecoveryInbox();
  const deliveryEmail = matchesEnvEmail && recoveryInbox ? recoveryInbox : authUser.email;

  if (isGmailSmtpConfigured()) {
    const pwdStamp = sha256Hex(authUser.updated_at || authUser.id).slice(0, 24);
    const resetToken = await new SignJWT({
      purpose: 'admin_password_reset',
      email: authUser.email,
      pwdStamp,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('veriface-admin')
      .setAudience('admin-password-reset')
      .setSubject(authUser.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(getDomainSecretKey('admin-password-reset'));

    const resetUrl = `${origin}/admin/login?resetToken=${encodeURIComponent(resetToken)}`;
    const smtpResult = await sendAdminPasswordResetEmail({
      toEmail: deliveryEmail,
      accountEmail: authUser.email,
      resetUrl,
    });

    if (smtpResult.sent) {
      return {
        sent: true,
        message: `Tautan atur ulang kata sandi untuk akun ${authUser.email} telah dikirim via Gmail ke ${maskEmail(deliveryEmail)} (berlaku 15 menit).`,
      };
    }
    return {
      sent: false,
      message: `Gagal mengirim email pemulihan via SMTP Gmail: ${smtpResult.reason || 'Periksa SMTP_USER dan SMTP_PASS.'}`,
    };
  }

  if (supabaseAuth && !matchesEnvEmail) {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${origin}/admin/login`,
    });
    if (!error) {
      return { sent: true, message: `Tautan pemulihan kata sandi telah dikirim ke ${authUser.email}.` };
    }
  }

  return {
    sent: false,
    message:
      'SMTP Gmail (SMTP_USER & SMTP_PASS) belum dikonfigurasi di .env.local sehingga email reset ke inbox pemulihan admin tidak dapat dikirim.',
  };
}

export async function completeAdminPasswordReset(
  resetToken: string,
  newPassword: string
): Promise<{ ok: boolean; email?: string; message: string }> {
  if (!resetToken || typeof resetToken !== 'string') {
    return { ok: false, message: 'Token atur ulang kata sandi tidak ditemukan.' };
  }
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false, message: 'Kata sandi baru wajib minimal 8 karakter dan maksimal 128 karakter.' };
  }
  if (!hasSupabaseServiceRole || !supabaseServer) {
    return { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi untuk memperbarui kata sandi.' };
  }

  try {
    const { payload } = await jwtVerify(resetToken, getDomainSecretKey('admin-password-reset'), {
      issuer: 'veriface-admin',
      audience: 'admin-password-reset',
    });

    if (payload.purpose !== 'admin_password_reset' || !payload.sub || !payload.pwdStamp) {
      return { ok: false, message: 'Token pemulihan tidak valid.' };
    }

    const { data: userRes, error: fetchErr } = await supabaseServer.auth.admin.getUserById(String(payload.sub));
    if (fetchErr || !userRes?.user) {
      return { ok: false, message: 'Akun administrator tidak ditemukan.' };
    }

    const expectedStamp = sha256Hex(userRes.user.updated_at || userRes.user.id).slice(0, 24);
    if (payload.pwdStamp !== expectedStamp) {
      return { ok: false, message: 'Tautan ini sudah pernah digunakan atau kedaluwarsa. Ajukan ulang permintaan reset.' };
    }

    const { error: updateErr } = await supabaseServer.auth.admin.updateUserById(userRes.user.id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updateErr) {
      return { ok: false, message: updateErr.message || 'Gagal memperbarui kata sandi di Supabase Auth.' };
    }

    return {
      ok: true,
      email: userRes.user.email || undefined,
      message: 'Kata sandi baru berhasil disimpan. Silakan masuk menggunakan kata sandi baru.',
    };
  } catch {
    return { ok: false, message: 'Token atur ulang kata sandi tidak valid atau sudah kedaluwarsa (> 15 menit).' };
  }
}

export async function changeLoggedInAdminPassword(params: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  const { email, currentPassword, newPassword } = params;
  if (!currentPassword) return { ok: false, message: 'Kata sandi saat ini wajib diisi.' };
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return { ok: false, message: 'Kata sandi baru wajib minimal 8 karakter dan maksimal 128 karakter.' };
  }
  if (currentPassword === newPassword) {
    return { ok: false, message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.' };
  }

  const credCheck = await verifyAdminCredentials(email, currentPassword);
  if (!credCheck.ok) return { ok: false, message: 'Kata sandi saat ini salah.' };

  if (!hasSupabaseServiceRole || !supabaseServer) {
    return {
      ok: false,
      message: 'SUPABASE_SERVICE_ROLE_KEY belum diset sehingga sandi baru tidak dapat disimpan ke Supabase Auth.',
    };
  }

  const authUser = await findSupabaseUserByEmail(email);
  const { error } = authUser
    ? await supabaseServer.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
        email_confirm: true,
      })
    : await supabaseServer.auth.admin.createUser({
        email: email.trim(),
        password: newPassword,
        email_confirm: true,
        app_metadata: { role: 'admin' },
      });

  if (error) return { ok: false, message: error.message || 'Gagal memperbarui kata sandi.' };

  return {
    ok: true,
    message: authUser
      ? 'Kata sandi berhasil diperbarui.'
      : 'Kata sandi berhasil diperbarui dan disinkronkan ke Supabase Auth.',
  };
}
