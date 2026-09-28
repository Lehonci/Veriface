import { createClient } from '@supabase/supabase-js';
import { VerificationRecord, ZoomSetting } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
    })
  : null;

interface MockDB {
  verifications: VerificationRecord[];
  zoomSettings: ZoomSetting[];
}

const globalForMock = global as unknown as { mockDB?: MockDB };

export const mockDB: MockDB = globalForMock.mockDB || {
  verifications: [
    {
      id: 'demo-verif-01',
      full_name: 'Anisa Rahmawati',
      email: 'anisa.rahma@gmail.com',
      job_position: 'Frontend Engineer',
      jobPosition: 'Frontend Engineer',
      status: 'PASSED',
      failure_reason: null,
      depth_variance: 0.003421,
      luminance_score: 68.4,
      confidence_score: 0.985,
      snapshot_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      ip_address: '180.252.164.12',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      jwt_token_jti: 'jti-mock-01',
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'demo-verif-02',
      full_name: 'Dimas Pratama',
      email: 'dimas.p@yahoo.com',
      job_position: 'Backend Developer',
      jobPosition: 'Backend Developer',
      status: 'SPOOF_FAILED',
      failure_reason: '3D Depth Variance di bawah ambang batas (Flat 2D Surface / Screen detected)',
      depth_variance: 0.000142,
      luminance_score: 52.1,
      confidence_score: 0.890,
      snapshot_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      ip_address: '114.122.38.99',
      user_agent: 'Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36',
      jwt_token_jti: null,
      created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    },
    {
      id: 'demo-verif-03',
      full_name: 'Rian Hidayat',
      email: 'rian.hidayat@gmail.com',
      job_position: 'UI/UX Designer',
      jobPosition: 'UI/UX Designer',
      status: 'VIRTUAL_CAM_BLOCKED',
      failure_reason: 'Terdeteksi software kamera virtual (OBS Virtual Camera)',
      depth_variance: null,
      luminance_score: 61.2,
      confidence_score: null,
      snapshot_url: null,
      ip_address: '36.88.120.45',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      jwt_token_jti: null,
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    }
  ],
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
