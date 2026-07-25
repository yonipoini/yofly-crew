-- Marketplace moderation and report capture.
-- User-triggered only: no cron, triggers, or background jobs.

CREATE TABLE IF NOT EXISTS public.marketplace_listing_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('INACCURATE', 'UNSAFE', 'SPAM', 'UNAVAILABLE', 'OTHER')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (listing_id, reporter_id, reason)
);

ALTER TABLE public.marketplace_listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verified crew can report marketplace listings" ON public.marketplace_listing_reports;
CREATE POLICY "Verified crew can report marketplace listings"
ON public.marketplace_listing_reports
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
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

DROP POLICY IF EXISTS "Users can read own marketplace reports" ON public.marketplace_listing_reports;
CREATE POLICY "Users can read own marketplace reports"
ON public.marketplace_listing_reports
FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own open marketplace reports" ON public.marketplace_listing_reports;
CREATE POLICY "Users can update own open marketplace reports"
ON public.marketplace_listing_reports
FOR UPDATE
TO authenticated
USING (reporter_id = auth.uid() AND status = 'OPEN')
WITH CHECK (reporter_id = auth.uid() AND status = 'OPEN');
