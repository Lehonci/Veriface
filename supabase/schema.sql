-- ==============================================================================
-- SCHEMA DEFINITION: Pre-Screening Identity Gateway & Audit Dashboard
-- Database: Supabase PostgreSQL
-- ==============================================================================

-- 1. Create Enum for Verification Status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM (
            'PASSED', 
            'SPOOF_FAILED', 
            'VIRTUAL_CAM_BLOCKED', 
            'POOR_LIGHTING'
        );
    END IF;
END $$;

-- 2. Create Table: zoom_settings (Manajemen Link Zoom Dinamis)
CREATE TABLE IF NOT EXISTS public.zoom_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_title VARCHAR(255) NOT NULL DEFAULT 'Wawancara Kerja Online',
    zoom_url TEXT NOT NULL,
    passcode VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Table: verifications (Log Audit Biometrik & Liveness Pelamar)
CREATE TABLE IF NOT EXISTS public.verifications (
    id TEXT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    job_position VARCHAR(255) NOT NULL,
    status verification_status NOT NULL,
    failure_reason TEXT,
    depth_variance NUMERIC(12, 6),
    luminance_score NUMERIC(8, 2),
    confidence_score NUMERIC(6, 4),
    snapshot_url TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    jwt_token_jti VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON public.verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zoom_settings_is_active ON public.zoom_settings(is_active);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.zoom_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Anonymous public read & insert policies for verifications (Client Gateway)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can insert verification outcomes" ON public.verifications;
    CREATE POLICY "Public can insert verification outcomes" 
    ON public.verifications FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

    DROP POLICY IF EXISTS "Public can view verifications" ON public.verifications;
    CREATE POLICY "Public can view verifications" 
    ON public.verifications FOR SELECT 
    TO anon, authenticated
    USING (true);

    DROP POLICY IF EXISTS "Public can view active zoom settings" ON public.zoom_settings;
    CREATE POLICY "Public can view active zoom settings" 
    ON public.zoom_settings FOR SELECT 
    TO anon, authenticated
    USING (true);

    DROP POLICY IF EXISTS "Public can update zoom settings" ON public.zoom_settings;
    CREATE POLICY "Public can update zoom settings" 
    ON public.zoom_settings FOR ALL 
    TO anon, authenticated
    USING (true);
END $$;

-- 6. Setup Supabase Realtime (WebSocket Notification)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.verifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- 7. Seed Initial Zoom Meeting Configuration
INSERT INTO public.zoom_settings (meeting_title, zoom_url, passcode, is_active)
VALUES (
    'Wawancara Kerja Online - Tech Division Batch 1',
    'https://us05web.zoom.us/j/89123456789?pwd=interview_demo_2026',
    'TECH2026',
    TRUE
)
ON CONFLICT DO NOTHING;
