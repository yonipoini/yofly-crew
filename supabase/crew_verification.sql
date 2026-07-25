-- YoFly Crew - Crew verification schema additions
-- Safe to run on an existing project that already has the base schema applied.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airline_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_airline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'UNVERIFIED';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_crew BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_marketplace BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manual_review_requested_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS airline_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airline_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  accepted_roles TEXT[] DEFAULT ARRAY['PILOT', 'FA'],
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_review_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  work_email TEXT,
  claimed_airline TEXT,
  employee_id_last4 TEXT,
  badge_image_url TEXT,
  status TEXT DEFAULT 'PENDING',
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE airline_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'airline_domains'
      AND policyname = 'Public read active airline domains'
  ) THEN
    CREATE POLICY "Public read active airline domains"
    ON airline_domains
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_review_requests'
      AND policyname = 'Users can insert own manual review requests'
  ) THEN
    CREATE POLICY "Users can insert own manual review requests"
    ON manual_review_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_review_requests'
      AND policyname = 'Users can read own manual review requests'
  ) THEN
    CREATE POLICY "Users can read own manual review requests"
    ON manual_review_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = profile_id);
  END IF;
END $$;

COMMENT ON TABLE airline_domains IS 'Approved airline work-email domains used for crew-only verification.';
COMMENT ON TABLE manual_review_requests IS 'Fallback review queue for badge or employee-ID verification.';
