-- ==============================================================================
-- SECURITY HARDENING MIGRATION (Plot Hole #3 & #5)
-- Jalankan SQL ini di Supabase Dashboard -> SQL Editor -> New Query
--
-- PENTING SEBELUM MENJALANKAN SCRIPT INI:
-- 1. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah ditambahkan ke .env.local Anda.
-- 2. Setelah script ini dijalankan, client 'anon' publik TIDAK lagi dapat membaca
--    PII pelamar (verifications), passcode Zoom (zoom_settings), maupun
--    memodifikasi / menghapus rekaman secara langsung lewat PostgREST.
-- 3. Semua akses DB yang sah dilakukan oleh backend Next.js API Routes
--    menggunakan SUPABASE_SERVICE_ROLE_KEY di balik HttpOnly Auth & Challenge guard.
-- ==============================================================================

-- 1. Tambah kolom kebijakan sensitivitas AI pada public.zoom_settings
ALTER TABLE public.zoom_settings
  ADD COLUMN IF NOT EXISTS liveness_mode VARCHAR(20) DEFAULT 'balanced';

-- 2. Hapus seluruh policy permisif terhadap 'anon' pada public.verifications
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can insert verification outcomes" ON public.verifications;
    DROP POLICY IF EXISTS "Public can view verifications" ON public.verifications;
    DROP POLICY IF EXISTS "Public can update verifications" ON public.verifications;
    DROP POLICY IF EXISTS "Public can delete verifications" ON public.verifications;

    -- Hanya service_role (backend server) dan user Supabase Auth authenticated yang dapat mengelola verifications
    DROP POLICY IF EXISTS "Authenticated admin can read verifications" ON public.verifications;
    CREATE POLICY "Authenticated admin can read verifications"
    ON public.verifications FOR SELECT
    TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Service role full access verifications" ON public.verifications;
    CREATE POLICY "Service role full access verifications"
    ON public.verifications FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;

-- 3. Hapus seluruh policy permisif terhadap 'anon' pada public.zoom_settings
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view active zoom settings" ON public.zoom_settings;
    DROP POLICY IF EXISTS "Public can update zoom settings" ON public.zoom_settings;

    DROP POLICY IF EXISTS "Authenticated admin can read zoom settings" ON public.zoom_settings;
    CREATE POLICY "Authenticated admin can read zoom settings"
    ON public.zoom_settings FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Service role full access zoom settings" ON public.zoom_settings;
    CREATE POLICY "Service role full access zoom settings"
    ON public.zoom_settings FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;

-- 4. Ketatkan kebijakan Storage Bucket 'snapshots' (tutup UPDATE & DELETE untuk anon)
DROP POLICY IF EXISTS "snapshots_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "snapshots_public_update" ON storage.objects;
DROP POLICY IF EXISTS "snapshots_public_delete" ON storage.objects;

DROP POLICY IF EXISTS "snapshots_service_insert" ON storage.objects;
CREATE POLICY "snapshots_service_insert"
ON storage.objects FOR INSERT
TO service_role, authenticated
WITH CHECK (bucket_id = 'snapshots');

DROP POLICY IF EXISTS "snapshots_service_update" ON storage.objects;
CREATE POLICY "snapshots_service_update"
ON storage.objects FOR UPDATE
TO service_role, authenticated
USING (bucket_id = 'snapshots')
WITH CHECK (bucket_id = 'snapshots');

DROP POLICY IF EXISTS "snapshots_service_delete" ON storage.objects;
CREATE POLICY "snapshots_service_delete"
ON storage.objects FOR DELETE
TO service_role, authenticated
USING (bucket_id = 'snapshots');
