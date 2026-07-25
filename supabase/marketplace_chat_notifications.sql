-- YoFly Crew - Marketplace chat inbox notifications
-- Allows a verified participant in a listing thread to notify the other participant.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_notification_inbox'
      AND policyname = 'Listing chat participants can create peer notifications'
  ) THEN
    CREATE POLICY "Listing chat participants can create peer notifications"
      ON ops_notification_inbox
      FOR INSERT
      TO authenticated
      WITH CHECK (
        category = 'CHAT'
        AND user_id <> auth.uid()
        AND metadata ? 'roomId'
        AND metadata ? 'listingId'
        AND metadata->>'roomId' LIKE 'listing:%'
        AND position(auth.uid()::text IN metadata->>'roomId') > 0
        AND position(user_id::text IN metadata->>'roomId') > 0
        AND EXISTS (
          SELECT 1
          FROM profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.verified_crew = true OR profiles.verified_marketplace = true)
        )
      );
  END IF;
END $$;
