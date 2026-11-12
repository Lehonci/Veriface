import { createClient } from '@supabase/supabase-js';
import { VerificationRecord, ZoomSetting } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasRealServiceKey =
  Boolean(rawServiceKey) &&
  !rawServiceKey.includes('your-service-role') &&
  !rawServiceKey.includes('placeholder');

const supabaseServiceKey = hasRealServiceKey
  ? rawServiceKey
  : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes('your-project-id')
);

export const supabaseServer = isSupabaseServerConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    })
  : null;

interface MockDB {
  verifications: VerificationRecord[];
  zoomSettings: ZoomSetting[];
}

const globalForMock = global as unknown as { mockDB?: MockDB };

export const mockDB: MockDB = globalForMock.mockDB || {
  verifications: [],
  zoomSettings: [
    {
      id: 'zoom-setting-default',
      meeting_title: 'Wawancara Kerja Batch 1 - Tech Division',
      zoom_url: 'https://zoom.us/j/89123456789?pwd=interview_interview_2026',
      passcode: 'TECH2026',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
};

if (process.env.NODE_ENV !== 'production') {
  globalForMock.mockDB = mockDB;
}
