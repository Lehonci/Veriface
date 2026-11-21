import nodemailer from 'nodemailer';
import { VerificationRecord } from '@/types';

export type EmailAlertEvent = 'PASSED_WAITING' | 'SPOOF_ALERT' | 'REVIEW_REQUESTED';

interface SendAdminEmailParams {
  record: VerificationRecord;
  eventType: EmailAlertEvent;
  recipientEmail?: string | null;
  appBaseUrl?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Mengirim notifikasi real-time via Gmail SMTP (App Password) agar admin bisa langsung
 * menerima alert di HP/email meskipun sedang tidak berada di depan tab dashboard.
 */
export async function sendAdminNotificationEmail({
  record,
  eventType,
  recipientEmail,
  appBaseUrl,
}: SendAdminEmailParams): Promise<{ sent: boolean; reason?: string }> {
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const toEmail =
    recipientEmail?.trim() ||
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    smtpUser;

  if (
    !smtpUser ||
    !smtpPass ||
    smtpUser.includes('your_gmail') ||
    smtpPass.includes('your_16_digit')
  ) {
    return { sent: false, reason: 'SMTP Gmail belum dikonfigurasi di .env.local' };
  }

  if (!toEmail) {
    return { sent: false, reason: 'Alamat email tujuan admin kosong' };
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

  let subject = `[Veriface] Verifikasi Baru: ${record.full_name}`;
  let badgeBg = '#EDF9F4';
  let badgeColor = '#027A48';
  let badgeText = 'LOLOS AI — MENUNGGU KONFIRMASI HOST';
  let summaryNote =
    'Kandidat lolos uji liveness 3D dan menunggu konfirmasi Anda di tab Audit Visual (atau otomatis masuk setelah timeout).';

  if (eventType === 'SPOOF_ALERT') {
    subject = `[Veriface ALERT] Anomali Terdeteksi: ${record.full_name}`;
    badgeBg = '#FEE4E2';
    badgeColor = '#B42318';
    badgeText = 'GAGAL AI — INDIKASI SPOOFING / KAMERA VIRTUAL';
    summaryNote = `Sistem menahan akses kandidat ini. Alasan: ${safeReason}`;
  } else if (eventType === 'REVIEW_REQUESTED') {
    subject = `[Veriface TINJAUAN] Kandidat Mengajukan Review Manual: ${record.full_name}`;
    badgeBg = '#FFF8E6';
    badgeColor = '#B54708';
    badgeText = 'PERMINTAAN TINJAUAN MANUAL ADMIN';
    summaryNote = `Kandidat gagal uji otomatis (${safeReason}) dan meminta peninjauan visual Anda. Akses tetap ditolak kecuali Anda menekan Izinkan.`;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F8F3F4; padding:24px; color:#2B0E17;">
      <div style="max-width:540px; margin:0 auto; background:#FFFFFF; border-radius:20px; border:1px solid #F0E4E7; overflow:hidden; box-shadow:0 6px 24px rgba(43,14,23,0.06);">
        <div style="background:#8A233E; padding:20px 24px; color:#FFFFFF;">
          <div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:0.85; font-weight:700;">Veriface Identity System</div>
          <h2 style="margin:6px 0 0; font-size:18px; font-weight:800;">Notifikasi Pre-Screening Biometrik</h2>
        </div>
        <div style="padding:24px;">
          <div style="display:inline-block; padding:6px 12px; border-radius:999px; background:${badgeBg}; color:${badgeColor}; font-size:11px; font-weight:700; margin-bottom:14px;">
            ${badgeText}
          </div>
          <p style="font-size:13px; line-height:1.5; color:#5A3843; margin:0 0 18px;">
            ${summaryNote}
          </p>
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
        </div>
      </div>
    </div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"Veriface Security" <${smtpUser}>`,
      to: toEmail,
      subject,
      html,
    });

    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Gmail SMTP send warning:', msg);
    return { sent: false, reason: msg };
  }
}
