-- Create public storage bucket for verification & zoom comparison snapshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('snapshots', 'snapshots', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of snapshots
DROP POLICY IF EXISTS "snapshots_public_read" ON storage.objects;
CREATE POLICY "snapshots_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'snapshots');

-- Allow uploads & upserts to the snapshots bucket
DROP POLICY IF EXISTS "snapshots_public_insert" ON storage.objects;
CREATE POLICY "snapshots_public_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'snapshots');

DROP POLICY IF EXISTS "snapshots_public_update" ON storage.objects;
CREATE POLICY "snapshots_public_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'snapshots')
WITH CHECK (bucket_id = 'snapshots');

DROP POLICY IF EXISTS "snapshots_public_delete" ON storage.objects;
CREATE POLICY "snapshots_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'snapshots');
