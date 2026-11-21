import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getActiveZoomConfig } from '@/lib/zoomHelpers';
import { requireAdminSession } from '@/lib/adminAuth';
import { LivenessThresholdMode, ZoomSetting } from '@/types';

export const dynamic = 'force-dynamic';

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    if (isSupabaseServerConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('zoom_settings')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, settings: data });
    }

    return NextResponse.json({
      success: true,
      settings: mockDB.zoomSettings,
    });
  } catch (error: unknown) {
    console.error('Error fetching zoom settings:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat pengaturan Zoom.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const {
      meetingTitle,
      zoomUrl,
      passcode,
      isActive = true,
      autoRedirect,
      autoAdmitTimeout,
      adminNotifyEmail,
      emailNotificationEnabled,
      livenessMode,
    } = body;

    if (!zoomUrl || typeof zoomUrl !== 'string' || !isValidHttpUrl(zoomUrl.trim())) {
      return NextResponse.json(
        { success: false, message: 'URL Zoom Meeting wajib berupa tautan http/https yang valid.' },
        { status: 400 }
      );
    }

    const current = await getActiveZoomConfig();
    const resolvedLivenessMode: LivenessThresholdMode =
      livenessMode === 'strict'
        ? 'strict'
        : livenessMode === 'balanced'
        ? 'balanced'
        : current.liveness_mode;

    const newSetting: ZoomSetting = {
      id: crypto.randomUUID(),
      meeting_title: meetingTitle || current.meeting_title || 'Wawancara Kerja Online',
      zoom_url: zoomUrl.trim(),
      passcode: passcode !== undefined ? String(passcode) : current.passcode,
      is_active: Boolean(isActive),
      auto_redirect: autoRedirect !== undefined ? Boolean(autoRedirect) : current.auto_redirect,
      auto_admit_timeout:
        autoAdmitTimeout !== undefined
          ? Math.max(5, Math.min(300, Number(autoAdmitTimeout) || 30))
          : current.auto_admit_timeout,
      admin_notify_email:
        adminNotifyEmail !== undefined
          ? adminNotifyEmail
            ? String(adminNotifyEmail).trim()
            : null
          : current.admin_notify_email,
      email_notification_enabled:
        emailNotificationEnabled !== undefined
          ? Boolean(emailNotificationEnabled)
          : current.email_notification_enabled,
      liveness_mode: resolvedLivenessMode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseServerConfigured && supabaseServer) {
      if (isActive) {
        await supabaseServer
          .from('zoom_settings')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { data, error } = await supabaseServer
        .from('zoom_settings')
        .insert([newSetting])
        .select()
        .single();

      // Fallback aman apabila kolom liveness_mode belum ditambahkan lewat SQL migration
      if (error && error.message && error.message.toLowerCase().includes('liveness_mode')) {
        const legacySetting = { ...newSetting };
        delete legacySetting.liveness_mode;
        const retry = await supabaseServer
          .from('zoom_settings')
          .insert([legacySetting])
          .select()
          .single();
        if (retry.error) throw retry.error;
        return NextResponse.json({
          success: true,
          setting: { ...retry.data, liveness_mode: resolvedLivenessMode },
        });
      }

      if (error) throw error;
      return NextResponse.json({ success: true, setting: data });
    }

    if (isActive) {
      mockDB.zoomSettings.forEach((z) => (z.is_active = false));
    }
    mockDB.zoomSettings.unshift(newSetting);

    return NextResponse.json({ success: true, setting: newSetting });
  } catch (error: unknown) {
    console.error('Error saving zoom settings:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan pengaturan Zoom.' },
      { status: 500 }
    );
  }
}
