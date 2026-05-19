-- 1) Prevent privilege escalation via profiles.is_admin self-update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 2) Lock down collected_fees inserts (edge functions use service role and bypass RLS)
DROP POLICY IF EXISTS "Service role inserts fees" ON public.collected_fees;
CREATE POLICY "Admins can insert fees"
ON public.collected_fees
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- 3) Restrict poker table creation to admins
DROP POLICY IF EXISTS "Auth users can create tables" ON public.poker_tables;
CREATE POLICY "Admins can create tables"
ON public.poker_tables
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- 4) Make cash-proofs bucket private and restrict object access
UPDATE storage.buckets SET public = false WHERE id = 'cash-proofs';

DROP POLICY IF EXISTS "Cash proofs - owner or admin read" ON storage.objects;
CREATE POLICY "Cash proofs - owner or admin read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cash-proofs'
  AND (
    public.is_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Cash proofs - users upload to own folder" ON storage.objects;
CREATE POLICY "Cash proofs - users upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cash-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Cash proofs - admin delete" ON storage.objects;
CREATE POLICY "Cash proofs - admin delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'cash-proofs' AND public.is_admin(auth.uid()));