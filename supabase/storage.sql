-- Create public storage bucket for spoofing snapshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('snapshots', 'snapshots', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of snapshots
DROP POLICY IF EXISTS "snapshots_public_read" ON storage.objects;
CREATE POLICY "snapshots_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'snapshots');

-- Allow uploads to the snapshots bucket (needed because the server currently
-- uses the publishable key instead of the service role key)
DROP POLICY IF EXISTS "snapshots_public_insert" ON storage.objects;
CREATE POLICY "snapshots_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'snapshots');
