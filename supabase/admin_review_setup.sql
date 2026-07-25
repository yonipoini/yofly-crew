-- YoFly Crew - Admin review setup
-- Adds an internal admin allowlist and RLS policies for manual review decisions.

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admins can read own admin record'
  ) THEN
    CREATE POLICY "Admins can read own admin record"
    ON admin_users
    FOR SELECT
    TO authenticated
    USING (lower(email) = lower(auth.jwt() ->> 'email'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_review_requests'
      AND policyname = 'Admins can review manual requests'
  ) THEN
    CREATE POLICY "Admins can review manual requests"
    ON manual_review_requests
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_review_requests'
      AND policyname = 'Admins can update manual requests'
  ) THEN
    CREATE POLICY "Admins can update manual requests"
    ON manual_review_requests
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update profiles'
  ) THEN
    CREATE POLICY "Admins can update profiles"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can read manual review badges'
  ) THEN
    CREATE POLICY "Admins can read manual review badges"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'manual-review-badges'
      AND EXISTS (
        SELECT 1
        FROM admin_users
        WHERE lower(admin_users.email) = lower(auth.jwt() ->> 'email')
      )
    );
  END IF;
END $$;
