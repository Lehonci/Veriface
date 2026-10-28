-- ==============================================================================
-- ADMINS TABLE DEFINITION & ROW LEVEL SECURITY POLICIES
-- Database: Supabase PostgreSQL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON public.admins(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated read policy
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can select admins" ON public.admins;
    CREATE POLICY "Public can select admins" 
    ON public.admins FOR SELECT 
    TO anon, authenticated
    USING (true);

    DROP POLICY IF EXISTS "Public can update admins" ON public.admins;
    CREATE POLICY "Public can update admins" 
    ON public.admins FOR UPDATE 
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
END $$;
