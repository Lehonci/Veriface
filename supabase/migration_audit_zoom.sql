-- ==============================================================================
-- MIGRATION V2: Audit Visual Gate, Timeout Auto-Admit, Side-by-Side Zoom Snapshot
-- Jalankan SQL ini di Supabase Dashboard -> SQL Editor -> New Query
-- Aman dijalankan ulang (Idempotent) pada tabel yang sudah ada.
-- ==============================================================================

-- 1. Tambah kolom baru pada tabel public.verifications
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS admin_decision VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS zoom_snapshot_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_captured_at TIMESTAMP WITH TIME ZONE;

-- Index untuk mempercepat filter & polling keputusan admin
CREATE INDEX IF NOT EXISTS idx_verifications_admin_decision
  ON public.verifications(admin_decision);

-- 2. Tambah kolom pengaturan gate, sensitivitas AI, & notifikasi email pada public.zoom_settings
ALTER TABLE public.zoom_settings
  ADD COLUMN IF NOT EXISTS auto_redirect BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_admit_timeout INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS admin_notify_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_notification_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS liveness_mode VARCHAR(20) DEFAULT 'balanced';

-- CATATAN KEAMANAN:
-- Untuk menutup akses 'anon' publik & mewajibkan RLS ketat berbasis service_role,
-- jalankan juga script supabase/security_hardening_rls.sql setelah mengisi SUPABASE_SERVICE_ROLE_KEY.
