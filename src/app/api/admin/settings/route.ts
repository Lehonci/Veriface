import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, mockDB, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { ZoomSetting } from '@/types';

export async function GET() {
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
  try {
    const body = await req.json();
    const { meetingTitle, zoomUrl, passcode, isActive = true } = body;

    if (!zoomUrl) {
      return NextResponse.json(
        { success: false, message: 'URL Zoom Meeting wajib diisi.' },
        { status: 400 }
      );
    }

    const newSetting: ZoomSetting = {
      id: `zoom_${Date.now()}`,
      meeting_title: meetingTitle || 'Wawancara Kerja Online',
      zoom_url: zoomUrl,
      passcode: passcode || '',
      is_active: Boolean(isActive),
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
        .insert([
          {
            meeting_title: meetingTitle || 'Wawancara Kerja Online',
            zoom_url: zoomUrl,
            passcode: passcode || '',
            is_active: Boolean(isActive),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase zoom_settings insert error:', error);
        throw error;
      }
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
