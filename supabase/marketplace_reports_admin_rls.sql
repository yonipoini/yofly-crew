-- Admin access for Marketplace reports.
-- User-triggered only: no cron, triggers, or background jobs.

ALTER TABLE public.marketplace_listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read marketplace reports" ON public.marketplace_listing_reports;
CREATE POLICY "Admins can read marketplace reports"
ON public.marketplace_listing_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Admins can update marketplace reports" ON public.marketplace_listing_reports;
CREATE POLICY "Admins can update marketplace reports"
ON public.marketplace_listing_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
  )
);
