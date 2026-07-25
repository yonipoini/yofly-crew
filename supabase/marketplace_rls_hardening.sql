-- YoFly Crew - Marketplace production RLS hardening
-- Run once in Supabase SQL Editor after the base schema exists.

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read listings" ON public.listings;
DROP POLICY IF EXISTS "Users can insert own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified crew can read marketplace listings" ON public.listings;
DROP POLICY IF EXISTS "Verified marketplace users can insert own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified marketplace users can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified marketplace users can delete own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified crew can insert own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified crew can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Verified crew can delete own listings" ON public.listings;

CREATE POLICY "Verified crew can read marketplace listings"
ON public.listings
FOR SELECT
TO authenticated
USING (
  auth.uid() = host_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
);

CREATE POLICY "Verified crew can insert own listings"
ON public.listings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = host_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
);

CREATE POLICY "Verified crew can update own listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (
  auth.uid() = host_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
)
WITH CHECK (
  auth.uid() = host_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
);

CREATE POLICY "Verified crew can delete own listings"
ON public.listings
FOR DELETE
TO authenticated
USING (
  auth.uid() = host_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
);

UPDATE storage.buckets
SET public = false
WHERE id = 'listing-images';

DROP POLICY IF EXISTS "Users can upload own listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own listing images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own private media" ON storage.objects;
DROP POLICY IF EXISTS "Verified crew can read private media" ON storage.objects;

CREATE POLICY "Users can manage own private media"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR ((storage.foldername(name))[1] = 'chat-attachments' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
)
WITH CHECK (
  bucket_id = 'listing-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR ((storage.foldername(name))[1] = 'chat-attachments' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

CREATE POLICY "Verified crew can read private media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
);
