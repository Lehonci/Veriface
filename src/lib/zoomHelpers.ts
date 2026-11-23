import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { signVerificationToken } from '@/lib/jwt';
import {
  LivenessThresholdMode,
  VerificationRecord,
  VerificationSuccessPayload,
  ZoomSetting,
} from '@/types';

export interface ActiveZoomConfig {
  meeting_title: string;
  zoom_url: string;
  passcode: string;
  auto_redirect: boolean;
  auto_admit_timeout: number;
  admin_notify_email: string | null;
  email_notification_enabled: boolean;
  liveness_mode: LivenessThresholdMode;
}

const DEFAULT_ZOOM_CONFIG: ActiveZoomConfig = {
  meeting_title: 'Wawancara Kerja Online',
  zoom_url: 'https://zoom.us/j/1234567890?pwd=interview_demo',
  passcode: 'TECH2026',
  auto_redirect: false,
  auto_admit_timeout: 30,
  admin_notify_email: null,
  email_notification_enabled: true,
  liveness_mode: 'balanced',
};

function normalizeLivenessMode(mode: unknown): LivenessThresholdMode {
  return mode === 'strict' ? 'strict' : 'balanced';
}

/**
 * Mengambil konfigurasi Zoom aktif beserta kebijakan gate dan email dari Supabase atau mockDB.
 */
export async function getActiveZoomConfig(): Promise<ActiveZoomConfig> {
  if (isSupabaseServerConfigured && supabaseServer) {
    const { data } = await supabaseServer
      .from('zoom_settings')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const s = data as ZoomSetting;
      return {
        meeting_title: s.meeting_title || DEFAULT_ZOOM_CONFIG.meeting_title,
        zoom_url: s.zoom_url || DEFAULT_ZOOM_CONFIG.zoom_url,
        passcode: s.passcode || '',
        auto_redirect: s.auto_redirect ?? false,
        auto_admit_timeout: s.auto_admit_timeout ?? 30,
        admin_notify_email: s.admin_notify_email ?? null,
        email_notification_enabled: s.email_notification_enabled ?? true,
        liveness_mode: normalizeLivenessMode(s.liveness_mode),
      };
    }
  } else {
    const activeMock = mockDB.zoomSettings.find((z) => z.is_active) || mockDB.zoomSettings[0];
    if (activeMock) {
      return {
        meeting_title: activeMock.meeting_title,
        zoom_url: activeMock.zoom_url,
        passcode: activeMock.passcode || '',
        auto_redirect: activeMock.auto_redirect ?? false,
        auto_admit_timeout: activeMock.auto_admit_timeout ?? 30,
        admin_notify_email: activeMock.admin_notify_email ?? null,
        email_notification_enabled: activeMock.email_notification_enabled ?? true,
        liveness_mode: normalizeLivenessMode(activeMock.liveness_mode),
      };
    }
  }

  return DEFAULT_ZOOM_CONFIG;
}

/**
 * Mengunggah gambar snapshot base64 ke Supabase Storage bucket `snapshots` dengan MIME & ekstensi akurat.
 * Jika Supabase belum dikonfigurasi atau upload gagal, mengembalikan data URL base64 sebagai fallback.
 */
export async function uploadSnapshotToStorage(
  filePrefix: string,
  snapshotBase64?: string | null
): Promise<string | null> {
  if (!snapshotBase64) return null;

  if (isSupabaseServerConfigured && supabaseServer) {
    try {
      const mimeMatch = snapshotBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
      const rawSubtype = mimeMatch ? mimeMatch[1].toLowerCase() : 'webp';
      const extension =
        rawSubtype === 'png' ? 'png' : rawSubtype === 'webp' ? 'webp' : 'jpg';
      const contentType =
        rawSubtype === 'png'
          ? 'image/png'
          : rawSubtype === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

      const base64Data = snapshotBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${filePrefix}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabaseServer.storage
        .from('snapshots')
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabaseServer.storage
          .from('snapshots')
          .getPublicUrl(fileName);
        return publicUrlData.publicUrl;
      }
      console.warn('Storage upload warning:', uploadError);
    } catch (uploadErr) {
      console.warn('Snapshot upload exception:', uploadErr);
    }
  }

  return snapshotBase64;
}

/**
 * Menyimpan rekaman verifikasi baru ke Supabase atau mockDB fallback.
 */
export async function insertVerificationRecord(record: VerificationRecord): Promise<void> {
  if (isSupabaseServerConfigured && supabaseServer) {
    const { error } = await supabaseServer.from('verifications').insert([record]);
    if (error) console.error('Supabase insert verification failed:', error);
    return;
  }
  mockDB.verifications.unshift(record);
}

/**
 * Menghapus file snapshot dari bucket Supabase Storage jika berupa URL storage publik.
 */
export async function deleteSnapshotFromStorage(snapshotUrl?: string | null): Promise<void> {
  if (!snapshotUrl || !snapshotUrl.includes('/snapshots/')) return;
  if (!isSupabaseServerConfigured || !supabaseServer) return;

  try {
    const fileName = snapshotUrl.split('/snapshots/').pop()?.split('?')[0];
    if (fileName) {
      await supabaseServer.storage.from('snapshots').remove([fileName]);
    }
  } catch (err) {
    console.warn('Storage delete warning:', err);
  }
}

/**
 * Membangun payload akses Zoom lengkap beserta JWT token saat pelamar diizinkan masuk.
 */
export async function buildZoomSuccessPayload(
  record: Pick<VerificationRecord, 'id' | 'full_name' | 'email' | 'job_position' | 'admin_decision'>,
  activeZoom: ActiveZoomConfig
): Promise<VerificationSuccessPayload> {
  const token = await signVerificationToken({
    sub: record.id,
    fullName: record.full_name,
    email: record.email,
    jobPosition: record.job_position,
    verifiedAt: new Date().toISOString(),
  });

  return {
    success: true,
    verificationId: record.id,
    requiresApproval: false,
    adminDecision: record.admin_decision || 'AUTO_ADMITTED',
    autoAdmitTimeout: activeZoom.auto_admit_timeout,
    zoomUrl: activeZoom.zoom_url,
    passcode: activeZoom.passcode,
    meetingTitle: activeZoom.meeting_title,
    token,
    displayNameGuide: `[${record.job_position}] - ${record.full_name}`,
    expiresIn: 900,
  };
}
