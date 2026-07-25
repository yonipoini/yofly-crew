-- Chat RLS hardening.
-- User-triggered only: no cron, triggers, realtime jobs, or scheduled work.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Verified crew can read chat messages" ON public.messages;
DROP POLICY IF EXISTS "Verified crew can insert own chat messages" ON public.messages;

CREATE POLICY "Verified crew can read chat messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
  AND (
    room_id NOT LIKE 'listing:%'
    OR position(auth.uid()::text IN room_id) > 0
  )
);

CREATE POLICY "Verified crew can insert own chat messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (
        COALESCE(profiles.verified_crew, false) = true
        OR COALESCE(profiles.verified_marketplace, false) = true
      )
  )
  AND (
    room_id NOT LIKE 'listing:%'
    OR position(auth.uid()::text IN room_id) > 0
  )
);
