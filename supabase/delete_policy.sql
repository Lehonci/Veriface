-- Allow deleting verification records
DROP POLICY IF EXISTS "Public can delete verifications" ON public.verifications;
CREATE POLICY "Public can delete verifications" 
ON public.verifications FOR DELETE 
TO anon, authenticated
USING (true);

-- Allow deleting snapshots from storage bucket
DROP POLICY IF EXISTS "snapshots_public_delete" ON storage.objects;
CREATE POLICY "snapshots_public_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'snapshots');
