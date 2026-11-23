import nodemailer from 'nodemailer';
import { VerificationRecord } from '@/types';

export type EmailAlertEvent = 'PASSED_WAITING' | 'SPOOF_ALERT' | 'REVIEW_REQUESTED';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSmtpConfig() {
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const isConfigured =
    Boolean(smtpUser) &&
    Boolean(smtpPass) &&
    !smtpUser.includes('your_gmail') &&
    !smtpUser.includes('emailpengirim@') &&
    !smtpPass.includes('your_16_digit') &&
    !/^x+$/i.test(smtpPass);

  return { smtpUser, smtpPass, isConfigured };
}

export function isGmailSmtpConfigured(): boolean {
  return getSmtpConfig().isConfigured;
}

export function getConfiguredRecoveryInbox(): string | null {
  const { smtpUser, isConfigured } = getSmtpConfig();
  if (!isConfigured) return null;
  const rawNotify = process.env.ADMIN_NOTIFY_EMAIL?.trim() || '';
  const validEnvNotify =
    rawNotify && !rawNotify.includes('emailhpadmin@') && !rawNotify.includes('admin_phone_email@')
      ? rawNotify
      : '';
  return validEnvNotify || smtpUser || null;
}

async function sendSmtpHtmlMail(params: {
  to: string;
  subject: string;
  heading: string;
  bodyHtml: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { smtpUser, smtpPass, isConfigured } = getSmtpConfig();
  if (!isConfigured) {
    return { sent: false, reason: 'SMTP Gmail belum dikonfigurasi di .env.local' };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F8F3F4; padding:24px; color:#2B0E17;">
      <div style="max-width:540px; margin:0 auto; background:#FFFFFF; border-radius:20px; border:1px solid #F0E4E7; overflow:hidden; box-shadow:0 6px 24px rgba(43,14,23,0.06);">
        <div style="background:#8A233E; padding:20px 24px; color:#FFFFFF;">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:0.85; font-weight:700;">Veriface Identity System</div>
          <h2 style="margin:6px 0 0; font-size:18px; font-weight:800;">${escapeHtml(params.heading)}</h2>
        </div>
        <div style="padding:24px;">${params.bodyHtml}</div>
      </div>
    </div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: `"Veriface Security" <${smtpUser}>`,
      to: params.to,
      subject: params.subject,
      html,
    });
    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Gmail SMTP send warning:', msg);
    return { sent: false, reason: msg };
  }
}

export async function sendAdminPasswordResetEmail(params: {
  toEmail: string;
  accountEmail?: string;
  resetUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const safeUrl = escapeHtml(params.resetUrl);
  const safeAccount = escapeHtml(params.accountEmail || params.toEmail);
  return sendSmtpHtmlMail({
    to: params.toEmail,
    subject: '[Veriface] Tautan Atur Ulang Kata Sandi Admin',
    heading: 'Atur Ulang Kata Sandi Admin',
    bodyHtml: `
      <p style="font-size:13px; line-height:1.6; color:#5A3843; margin:0 0 18px;">
        Kami menerima permintaan untuk mengganti kata sandi akun login admin <strong style="color:#2B0E17;">${safeAccount}</strong>. Tautan ini berlaku selama <strong>15 menit</strong> dan hanya dapat dipakai satu kali.
      </p>
      <a href="${safeUrl}" style="display:block; text-align:center; background:#8A233E; color:#FFFFFF; text-decoration:none; font-weight:700; font-size:13px; padding:14px 20px; border-radius:12px;">
        Atur Kata Sandi Baru &rarr;
      </a>
      <p style="font-size:11px; color:#9E7B85; margin:16px 0 0; word-break:break-all;">
        Jika tombol tidak bekerja, salin URL ini: <a href="${safeUrl}" style="color:#8A233E;">${safeUrl}</a>
      </p>
    `,
  });
}

const ALERT_TEMPLATES: Record<
  EmailAlertEvent,
  { badgeBg: string; badgeColor: string; badgeText: string; subjectPrefix: string }
> = {
  PASSED_WAITING: {
    badgeBg: '#EDF9F4',
    badgeColor: '#027A48',
    badgeText: 'LOLOS AI — MENUNGGU KONFIRMASI HOST',
    subjectPrefix: '[Veriface] Verifikasi Baru',
  },
  SPOOF_ALERT: {
    badgeBg: '#FEE4E2',
    badgeColor: '#B42318',
    badgeText: 'GAGAL AI — INDIKASI SPOOFING / KAMERA VIRTUAL',
    subjectPrefix: '[Veriface ALERT] Anomali Terdeteksi',
  },
  REVIEW_REQUESTED: {
    badgeBg: '#FFF8E6',
    badgeColor: '#B54708',
    badgeText: 'PERMINTAAN TINJAUAN MANUAL ADMIN',
    subjectPrefix: '[Veriface TINJAUAN] Kandidat Mengajukan Review Manual',
  },
};

/**
 * Mengirim notifikasi real-time via Gmail SMTP (App Password) agar admin bisa langsung
 * menerima alert di HP/email meskipun sedang tidak berada di depan tab dashboard.
 */
export async function sendAdminNotificationEmail(params: {
  record: VerificationRecord;
  eventType: EmailAlertEvent;
  recipientEmail?: string | null;
  appBaseUrl?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { record, eventType, recipientEmail, appBaseUrl } = params;
  const toEmail = recipientEmail?.trim() || getConfiguredRecoveryInbox();
  if (!toEmail) {
    return { sent: false, reason: 'SMTP Gmail atau alamat email tujuan admin belum dikonfigurasi' };
  }

  const baseUrl =
    appBaseUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';
  const auditLink = `${baseUrl}/admin/dashboard?tab=audit&id=${encodeURIComponent(record.id)}`;
  const confPct = Math.round((record.confidence_score ?? 0.95) * 100);
  const safeName = escapeHtml(record.full_name || 'Pelamar');
  const safeEmail = escapeHtml(record.email || '-');
  const safePos = escapeHtml(record.job_position || 'Pelamar');
  const safeReason = escapeHtml(record.failure_reason || '-');

  const tpl = ALERT_TEMPLATES[eventType];
  const summaryNote =
    eventType === 'SPOOF_ALERT'
      ? `Sistem menahan akses kandidat ini. Alasan: ${safeReason}`
      : eventType === 'REVIEW_REQUESTED'
      ? `Kandidat gagal uji otomatis (${safeReason}) dan meminta peninjauan visual Anda. Akses tetap ditolak kecuali Anda menekan Izinkan.`
      : 'Kandidat lolos uji liveness 3D dan menunggu konfirmasi Anda di tab Audit Visual (atau otomatis masuk setelah timeout).';

  return sendSmtpHtmlMail({
    to: toEmail,
    subject: `${tpl.subjectPrefix}: ${record.full_name}`,
    heading: 'Notifikasi Pre-Screening Biometrik',
    bodyHtml: `
      <div style="display:inline-block; padding:6px 12px; border-radius:999px; background:${tpl.badgeBg}; color:${tpl.badgeColor}; font-size:11px; font-weight:700; margin-bottom:14px;">
        ${tpl.badgeText}
      </div>
      <p style="font-size:13px; line-height:1.5; color:#5A3843; margin:0 0 18px;">${summaryNote}</p>
      <table style="width:100%; border-collapse:collapse; font-size:13px; background:#FAF8F9; border-radius:12px; overflow:hidden; margin-bottom:20px;">
        <tr><td style="padding:10px 14px; color:#7D5662; border-bottom:1px solid #F0E4E7;">Nama Kandidat</td><td style="padding:10px 14px; font-weight:700; text-align:right; border-bottom:1px solid #F0E4E7;">${safeName}</td></tr>
        <tr><td style="padding:10px 14px; color:#7D5662; border-bottom:1px solid #F0E4E7;">Posisi</td><td style="padding:10px 14px; font-weight:600; text-align:right; border-bottom:1px solid #F0E4E7;">${safePos}</td></tr>
        <tr><td style="padding:10px 14px; color:#7D5662; border-bottom:1px solid #F0E4E7;">Email</td><td style="padding:10px 14px; font-family:monospace; text-align:right; border-bottom:1px solid #F0E4E7;">${safeEmail}</td></tr>
        <tr><td style="padding:10px 14px; color:#7D5662;">Skor Liveness</td><td style="padding:10px 14px; font-weight:700; text-align:right;">${confPct}%</td></tr>
      </table>
      <a href="${auditLink}" style="display:block; text-align:center; background:#8A233E; color:#FFFFFF; text-decoration:none; font-weight:700; font-size:13px; padding:13px 20px; border-radius:12px;">
        Buka Audit Visual Sekarang &rarr;
      </a>
      <p style="font-size:11px; color:#9E7B85; text-align:center; margin:14px 0 0;">
        Link langsung: <a href="${auditLink}" style="color:#8A233E;">${auditLink}</a>
      </p>
    `,
  });
}
