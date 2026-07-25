-- BEGIN FILE: shared_web_app_sync.sql
-- YoFly Crew - shared backend bridge for the Antigravity website and the mobile app
-- Canonical app tables remain profiles/posts/listings.
-- Legacy website tables vent_posts/marketplace_listings are kept in sync for compatibility.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.normalize_crew_role(raw_role TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw_role IS NULL OR btrim(raw_role) = '' THEN NULL
    WHEN upper(replace(raw_role, ' ', '_')) IN ('PILOT', 'CAPTAIN') THEN 'PILOT'
    WHEN upper(replace(raw_role, ' ', '_')) IN ('FA', 'FLIGHT_ATTENDANT', 'FLIGHTATTENDANT', 'ATTENDANT') THEN 'FA'
    WHEN upper(replace(raw_role, ' ', '_')) = 'DISPATCH' THEN 'DISPATCH'
    ELSE upper(replace(raw_role, ' ', '_'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.derive_listing_category(raw_category TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw_category IS NULL OR btrim(raw_category) = '' THEN 'ITEM'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('CRASH_PAD', 'CRASHPAD') THEN 'CRASH_PAD'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('PRIVATE_ROOM', 'ROOM', 'PRIVATE', 'ROOM_SHARE') THEN 'PRIVATE_ROOM'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('LONG_TERM_STAY', 'LONGTERMSTAY', 'LONG_TERM', 'LEASE', 'HOUSING') THEN 'LONG_TERM_STAY'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('SHORT_TERM_STAY', 'SHORTTERMSTAY', 'SHORT_TERM', 'SUBLET', 'HOTEL') THEN 'SHORT_TERM_STAY'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('SERVICE', 'SERVICES') THEN 'SERVICE'
    WHEN upper(replace(raw_category, ' ', '_')) IN ('ITEM', 'ITEMS', 'GEAR', 'PRODUCT', 'PRODUCTS') THEN 'ITEM'
    ELSE 'ITEM'
  END;
$$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT,
  airline TEXT,
  airline_email TEXT UNIQUE,
  base_airport TEXT,
  aircraft TEXT,
  avatar_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  is_sos_active BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{"intelPush": true, "opsPush": true, "dailyDigest": true, "layoverChat": true, "dealsAndPerks": true, "visibleOnCrewMap": true, "opsContextMode": "BASE", "activeOpsAirport": "JFK", "layoverAirport": "", "tripAirport": "", "favoriteAirports": ["JFK"], "preferredAirlines": []}'::jsonb,
  verification_airline TEXT,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  verification_method TEXT,
  verified_crew BOOLEAN DEFAULT false,
  verified_marketplace BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  manual_review_requested_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS airline_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_airport TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aircraft TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sos_active BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"intelPush": true, "opsPush": true, "dailyDigest": true, "layoverChat": true, "dealsAndPerks": true, "visibleOnCrewMap": true, "opsContextMode": "BASE", "activeOpsAirport": "JFK", "layoverAirport": "", "tripAirport": "", "favoriteAirports": ["JFK"], "preferredAirlines": []}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_airline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'UNVERIFIED';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_crew BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_marketplace BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manual_review_requested_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE profiles
SET
  role = COALESCE(public.normalize_crew_role(role), role),
  airline_email = COALESCE(NULLIF(lower(airline_email), ''), NULL),
  base_airport = COALESCE(NULLIF(upper(base_airport), ''), 'JFK'),
  verified_crew = COALESCE(verified_crew, is_verified, false),
  verified_marketplace = COALESCE(verified_marketplace, is_verified, false),
  is_verified = COALESCE(is_verified, verified_crew, verified_marketplace, false),
  verification_status = COALESCE(
    verification_status,
    CASE
      WHEN COALESCE(is_verified, verified_crew, verified_marketplace, false) THEN 'VERIFIED_CREW'
      ELSE 'UNVERIFIED'
    END
  ),
  updated_at = COALESCE(updated_at, NOW())
WHERE TRUE;

CREATE OR REPLACE FUNCTION public.sync_profile_compatibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.role := COALESCE(public.normalize_crew_role(NEW.role), NEW.role);
  NEW.airline_email := NULLIF(lower(COALESCE(NEW.airline_email, '')), '');
  NEW.base_airport := COALESCE(NULLIF(upper(COALESCE(NEW.base_airport, '')), ''), 'JFK');
  NEW.preferences := COALESCE(NEW.preferences, '{"intelPush": true, "opsPush": true, "dailyDigest": true, "layoverChat": true, "dealsAndPerks": true, "visibleOnCrewMap": true, "opsContextMode": "BASE", "activeOpsAirport": "JFK", "layoverAirport": "", "tripAirport": "", "favoriteAirports": ["JFK"], "preferredAirlines": []}'::jsonb);
  NEW.verified_crew := COALESCE(NEW.verified_crew, NEW.is_verified, false);
  NEW.verified_marketplace := COALESCE(NEW.verified_marketplace, NEW.is_verified, NEW.verified_crew, false);
  NEW.is_verified := COALESCE(NEW.is_verified, NEW.verified_crew, NEW.verified_marketplace, false);
  NEW.verification_status := COALESCE(
    NEW.verification_status,
    CASE
      WHEN COALESCE(NEW.verified_crew, false) THEN 'VERIFIED_CREW'
      ELSE 'UNVERIFIED'
    END
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_compatibility_trigger ON profiles;
CREATE TRIGGER sync_profile_compatibility_trigger
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_compatibility();

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

CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id),
  type TEXT DEFAULT 'VENT',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  airport_code TEXT,
  topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  post_scope TEXT DEFAULT 'GLOBAL' CHECK (post_scope IN ('GLOBAL', 'LOCAL', 'BASE', 'TRIP')),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_anonymous BOOLEAN DEFAULT FALSE,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  legacy_vent_post_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'VENT';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS airport_code TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_scope TEXT DEFAULT 'GLOBAL';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS legacy_vent_post_id BIGINT;
ALTER TABLE posts ALTER COLUMN title SET DEFAULT 'Crew Post';

CREATE UNIQUE INDEX IF NOT EXISTS posts_legacy_vent_post_id_idx
ON posts (legacy_vent_post_id);

UPDATE posts
SET
  type = COALESCE(type, 'VENT'),
  title = COALESCE(NULLIF(title, ''), left(regexp_replace(content, '\s+', ' ', 'g'), 72), 'Crew Post'),
  content = COALESCE(content, ''),
  is_anonymous = COALESCE(is_anonymous, false),
  like_count = COALESCE(like_count, 0),
  comment_count = COALESCE(comment_count, 0)
WHERE TRUE;

ALTER TABLE posts ALTER COLUMN title SET NOT NULL;
ALTER TABLE posts ALTER COLUMN content SET NOT NULL;

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  airport_code TEXT NOT NULL DEFAULT 'JFK',
  category TEXT DEFAULT 'ITEM',
  gender_pref TEXT DEFAULT 'MIXED',
  beds_available INTEGER,
  distance_info TEXT,
  description TEXT,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  details JSONB DEFAULT '{}'::jsonb,
  is_verified BOOLEAN DEFAULT FALSE,
  legacy_marketplace_listing_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES profiles(id);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_monthly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS airport_code TEXT NOT NULL DEFAULT 'JFK';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'ITEM';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS gender_pref TEXT DEFAULT 'MIXED';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS beds_available INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS distance_info TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS legacy_marketplace_listing_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS listings_legacy_marketplace_listing_id_idx
ON listings (legacy_marketplace_listing_id);

UPDATE listings
SET
  title = COALESCE(NULLIF(title, ''), 'Crew Listing'),
  category = public.derive_listing_category(category),
  gender_pref = COALESCE(gender_pref, 'MIXED'),
  airport_code = COALESCE(NULLIF(upper(airport_code), ''), 'JFK'),
  price_monthly = COALESCE(price_monthly, 0),
  amenities = COALESCE(amenities, ARRAY[]::TEXT[]),
  image_urls = CASE
    WHEN (image_urls IS NULL OR cardinality(image_urls) = 0) AND image_url IS NOT NULL THEN ARRAY[image_url]
    ELSE COALESCE(image_urls, ARRAY[]::TEXT[])
  END,
  details = COALESCE(details, '{}'::jsonb)
WHERE TRUE;

ALTER TABLE listings ALTER COLUMN title SET NOT NULL;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_category_check;
ALTER TABLE listings
ADD CONSTRAINT listings_category_check
CHECK (
  category IN (
    'CRASH_PAD',
    'PRIVATE_ROOM',
    'LONG_TERM_STAY',
    'SHORT_TERM_STAY',
    'ITEM',
    'SERVICE'
  )
);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_gender_pref_check;
ALTER TABLE listings
ADD CONSTRAINT listings_gender_pref_check
CHECK (gender_pref IN ('MALE', 'FEMALE', 'MIXED'));

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE airline_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Public read profiles'
  ) THEN
    CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Public read posts'
  ) THEN
    CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Users can insert own posts'
  ) THEN
    CREATE POLICY "Users can insert own posts"
    ON posts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Users can update own posts'
  ) THEN
    CREATE POLICY "Users can update own posts"
    ON posts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Users can delete own posts'
  ) THEN
    CREATE POLICY "Users can delete own posts"
    ON posts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_comments'
      AND policyname = 'Public read post comments'
  ) THEN
    CREATE POLICY "Public read post comments" ON post_comments FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_comments'
      AND policyname = 'Users can insert own post comments'
  ) THEN
    CREATE POLICY "Users can insert own post comments"
    ON post_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_comments'
      AND policyname = 'Users can delete own post comments'
  ) THEN
    CREATE POLICY "Users can delete own post comments"
    ON post_comments
    FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_votes'
      AND policyname = 'Users can manage own post votes'
  ) THEN
    CREATE POLICY "Users can manage own post votes"
    ON post_votes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_posts'
      AND policyname = 'Users can manage own saved posts'
  ) THEN
    CREATE POLICY "Users can manage own saved posts"
    ON saved_posts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Public read listings'
  ) THEN
    CREATE POLICY "Public read listings" ON listings FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can insert own listings'
  ) THEN
    CREATE POLICY "Users can insert own listings"
    ON listings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = host_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can update own listings'
  ) THEN
    CREATE POLICY "Users can update own listings"
    ON listings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can delete own listings'
  ) THEN
    CREATE POLICY "Users can delete own listings"
    ON listings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = host_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Public read messages'
  ) THEN
    CREATE POLICY "Public read messages" ON messages FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can insert own messages'
  ) THEN
    CREATE POLICY "Users can insert own messages"
    ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    airline,
    role,
    airline_email,
    base_airport
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'airline',
    public.normalize_crew_role(COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'role_label')),
    lower(NEW.email),
    upper(COALESCE(NEW.raw_user_meta_data->>'base_airport', 'JFK'))
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    airline = COALESCE(profiles.airline, EXCLUDED.airline),
    role = COALESCE(profiles.role, EXCLUDED.role),
    airline_email = COALESCE(profiles.airline_email, EXCLUDED.airline_email),
    base_airport = COALESCE(profiles.base_airport, EXCLUDED.base_airport),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vent_posts'
  ) THEN
    ALTER TABLE public.vent_posts ADD COLUMN IF NOT EXISTS app_post_id UUID;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'vent_posts_app_post_id_idx'
    ) THEN
      CREATE UNIQUE INDEX vent_posts_app_post_id_idx
      ON public.vent_posts (app_post_id);
    END IF;

    ALTER TABLE public.vent_posts ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vent_posts'
        AND policyname = 'Vents are viewable by everyone'
    ) THEN
      CREATE POLICY "Vents are viewable by everyone" ON public.vent_posts FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vent_posts'
        AND policyname = 'Users can insert own vents'
    ) THEN
      CREATE POLICY "Users can insert own vents"
      ON public.vent_posts
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vent_posts'
        AND policyname = 'Users can update own vents'
    ) THEN
      CREATE POLICY "Users can update own vents"
      ON public.vent_posts
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vent_posts'
        AND policyname = 'Users can delete own vents'
    ) THEN
      CREATE POLICY "Users can delete own vents"
      ON public.vent_posts
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
    END IF;

    INSERT INTO public.posts (
      id,
      author_id,
      type,
      title,
      content,
      is_anonymous,
      legacy_vent_post_id,
      created_at
    )
    SELECT
      COALESCE(vp.app_post_id, gen_random_uuid()),
      vp.user_id,
      'VENT',
      COALESCE(NULLIF(left(regexp_replace(vp.content, '\s+', ' ', 'g'), 72), ''), 'Crew Vent'),
      vp.content,
      false,
      vp.id,
      COALESCE(vp.created_at, NOW())
    FROM public.vent_posts vp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.legacy_vent_post_id = vp.id
    );

    UPDATE public.vent_posts vp
    SET app_post_id = p.id
    FROM public.posts p
    WHERE p.legacy_vent_post_id = vp.id
      AND (vp.app_post_id IS NULL OR vp.app_post_id <> p.id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_legacy_vent_to_posts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.posts
    WHERE legacy_vent_post_id = OLD.id
       OR id = OLD.app_post_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.posts (
    id,
    author_id,
    type,
    title,
    content,
    is_anonymous,
    legacy_vent_post_id,
    created_at
  )
  VALUES (
    COALESCE(NEW.app_post_id, gen_random_uuid()),
    NEW.user_id,
    'VENT',
    COALESCE(NULLIF(left(regexp_replace(NEW.content, '\s+', ' ', 'g'), 72), ''), 'Crew Vent'),
    NEW.content,
    false,
    NEW.id,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (legacy_vent_post_id) DO UPDATE
  SET
    author_id = EXCLUDED.author_id,
    type = 'VENT',
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    created_at = EXCLUDED.created_at
  RETURNING id INTO canonical_id;

  NEW.app_post_id := canonical_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_posts_to_legacy_vent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  legacy_id BIGINT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'VENT' AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'vent_posts'
    ) THEN
      DELETE FROM public.vent_posts
      WHERE app_post_id = OLD.id
         OR id = OLD.legacy_vent_post_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.type <> 'VENT' AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vent_posts'
  ) THEN
    DELETE FROM public.vent_posts
    WHERE app_post_id = NEW.id
       OR id = NEW.legacy_vent_post_id;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vent_posts'
  ) THEN
    INSERT INTO public.vent_posts (
      user_id,
      content,
      created_at,
      app_post_id
    )
    VALUES (
      NEW.author_id,
      NEW.content,
      COALESCE(NEW.created_at, NOW()),
      NEW.id
    )
    ON CONFLICT (app_post_id) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      content = EXCLUDED.content,
      created_at = EXCLUDED.created_at
    RETURNING id INTO legacy_id;

    UPDATE public.posts
    SET legacy_vent_post_id = legacy_id
    WHERE id = NEW.id
      AND (legacy_vent_post_id IS NULL OR legacy_vent_post_id <> legacy_id);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vent_posts'
  ) THEN
    DROP TRIGGER IF EXISTS sync_legacy_vent_to_posts_trigger ON public.vent_posts;
    CREATE TRIGGER sync_legacy_vent_to_posts_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON public.vent_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_legacy_vent_to_posts();
  END IF;
END $$;

DROP TRIGGER IF EXISTS sync_posts_to_legacy_vent_trigger ON public.posts;
CREATE TRIGGER sync_posts_to_legacy_vent_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.sync_posts_to_legacy_vent();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_listings'
  ) THEN
    ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS app_listing_id UUID;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'marketplace_listings_app_listing_id_idx'
    ) THEN
      CREATE UNIQUE INDEX marketplace_listings_app_listing_id_idx
      ON public.marketplace_listings (app_listing_id);
    END IF;

    ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'marketplace_listings'
        AND policyname = 'Listings are viewable by everyone'
    ) THEN
      CREATE POLICY "Listings are viewable by everyone" ON public.marketplace_listings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'marketplace_listings'
        AND policyname = 'Users can insert own marketplace listings'
    ) THEN
      CREATE POLICY "Users can insert own marketplace listings"
      ON public.marketplace_listings
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'marketplace_listings'
        AND policyname = 'Users can update own marketplace listings'
    ) THEN
      CREATE POLICY "Users can update own marketplace listings"
      ON public.marketplace_listings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'marketplace_listings'
        AND policyname = 'Users can delete own marketplace listings'
    ) THEN
      CREATE POLICY "Users can delete own marketplace listings"
      ON public.marketplace_listings
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
    END IF;

    INSERT INTO public.listings (
      id,
      host_id,
      title,
      price_monthly,
      airport_code,
      category,
      gender_pref,
      beds_available,
      distance_info,
      description,
      amenities,
      image_url,
      image_urls,
      details,
      is_verified,
      legacy_marketplace_listing_id,
      created_at
    )
    SELECT
      COALESCE(ml.app_listing_id, gen_random_uuid()),
      ml.user_id,
      ml.title,
      COALESCE(round(ml.price)::INTEGER, 0),
      COALESCE(NULLIF(upper(p.base_airport), ''), 'JFK'),
      public.derive_listing_category(ml.category),
      'MIXED',
      NULL,
      '',
      COALESCE(ml.description, ''),
      ARRAY[]::TEXT[],
      ml.image_url,
      CASE WHEN ml.image_url IS NOT NULL THEN ARRAY[ml.image_url] ELSE ARRAY[]::TEXT[] END,
      '{}'::jsonb,
      COALESCE(p.verified_marketplace, p.is_verified, false),
      ml.id,
      COALESCE(ml.created_at, NOW())
    FROM public.marketplace_listings ml
    LEFT JOIN public.profiles p ON p.id = ml.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.legacy_marketplace_listing_id = ml.id
    );

    UPDATE public.marketplace_listings ml
    SET app_listing_id = l.id
    FROM public.listings l
    WHERE l.legacy_marketplace_listing_id = ml.id
      AND (ml.app_listing_id IS NULL OR ml.app_listing_id <> l.id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_legacy_marketplace_to_listings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.listings
    WHERE legacy_marketplace_listing_id = OLD.id
       OR id = OLD.app_listing_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.listings (
    id,
    host_id,
    title,
    price_monthly,
    airport_code,
    category,
    gender_pref,
    distance_info,
    description,
    amenities,
    image_url,
    image_urls,
    details,
    is_verified,
    legacy_marketplace_listing_id,
    created_at
  )
  VALUES (
    COALESCE(NEW.app_listing_id, gen_random_uuid()),
    NEW.user_id,
    NEW.title,
    COALESCE(round(NEW.price)::INTEGER, 0),
    COALESCE(
      (
        SELECT NULLIF(upper(base_airport), '')
        FROM public.profiles
        WHERE id = NEW.user_id
      ),
      'JFK'
    ),
    public.derive_listing_category(NEW.category),
    'MIXED',
    '',
    COALESCE(NEW.description, ''),
    ARRAY[]::TEXT[],
    NEW.image_url,
    CASE WHEN NEW.image_url IS NOT NULL THEN ARRAY[NEW.image_url] ELSE ARRAY[]::TEXT[] END,
    '{}'::jsonb,
    COALESCE(
      (
        SELECT COALESCE(verified_marketplace, is_verified, false)
        FROM public.profiles
        WHERE id = NEW.user_id
      ),
      false
    ),
    NEW.id,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (legacy_marketplace_listing_id) DO UPDATE
  SET
    host_id = EXCLUDED.host_id,
    title = EXCLUDED.title,
    price_monthly = EXCLUDED.price_monthly,
    airport_code = EXCLUDED.airport_code,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    image_urls = EXCLUDED.image_urls,
    is_verified = EXCLUDED.is_verified,
    created_at = EXCLUDED.created_at
  RETURNING id INTO canonical_id;

  NEW.app_listing_id := canonical_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_listings_to_legacy_marketplace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  legacy_id BIGINT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'marketplace_listings'
    ) THEN
      DELETE FROM public.marketplace_listings
      WHERE app_listing_id = OLD.id
         OR id = OLD.legacy_marketplace_listing_id;
    END IF;
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_listings'
  ) THEN
    INSERT INTO public.marketplace_listings (
      user_id,
      title,
      description,
      price,
      category,
      image_url,
      created_at,
      app_listing_id
    )
    VALUES (
      NEW.host_id,
      NEW.title,
      COALESCE(NEW.description, ''),
      NEW.price_monthly::NUMERIC(10, 2),
      NEW.category,
      NEW.image_url,
      COALESCE(NEW.created_at, NOW()),
      NEW.id
    )
    ON CONFLICT (app_listing_id) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      category = EXCLUDED.category,
      image_url = EXCLUDED.image_url,
      created_at = EXCLUDED.created_at
    RETURNING id INTO legacy_id;

    UPDATE public.listings
    SET legacy_marketplace_listing_id = legacy_id
    WHERE id = NEW.id
      AND (legacy_marketplace_listing_id IS NULL OR legacy_marketplace_listing_id <> legacy_id);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_listings'
  ) THEN
    DROP TRIGGER IF EXISTS sync_legacy_marketplace_to_listings_trigger ON public.marketplace_listings;
    CREATE TRIGGER sync_legacy_marketplace_to_listings_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON public.marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_legacy_marketplace_to_listings();
  END IF;
END $$;

DROP TRIGGER IF EXISTS sync_listings_to_legacy_marketplace_trigger ON public.listings;
CREATE TRIGGER sync_listings_to_legacy_marketplace_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.sync_listings_to_legacy_marketplace();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'listings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'vent_posts'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vent_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vent_posts;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_listings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'marketplace_listings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_listings;
  END IF;
END $$;

COMMENT ON FUNCTION public.normalize_crew_role(TEXT) IS 'Normalizes website role labels to the app role codes.';
COMMENT ON FUNCTION public.derive_listing_category(TEXT) IS 'Maps website marketplace categories to the app marketplace taxonomy.';
COMMENT ON FUNCTION public.handle_auth_user_profile() IS 'Ensures each auth user gets a shared public profile row.';

-- END FILE: shared_web_app_sync.sql

-- BEGIN FILE: ops_intel_infra.sql
-- Ops intel infrastructure: cache, push subscriptions, dispatch queue, and digests

CREATE TABLE IF NOT EXISTS ops_snapshots (
  airport_code TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT,
  active_airport TEXT,
  saved_airports TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_airlines TEXT[] DEFAULT ARRAY[]::TEXT[],
  role_label TEXT,
  verified_crew BOOLEAN DEFAULT FALSE,
  intel_push BOOLEAN DEFAULT TRUE,
  ops_push BOOLEAN DEFAULT TRUE,
  daily_digest BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airport_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_notification_inbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES ops_events(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'OPS_ALERT',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL,
  airport_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_events_unsent ON ops_events (sent_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user ON notification_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_ops_notification_inbox_user ON ops_notification_inbox (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_digests_user ON ops_digests (user_id, created_at DESC);

ALTER TABLE ops_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_notification_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_digests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_snapshots'
      AND policyname = 'Public read ops snapshots'
  ) THEN
    CREATE POLICY "Public read ops snapshots" ON ops_snapshots FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_subscriptions'
      AND policyname = 'Users manage own push subscriptions'
  ) THEN
    CREATE POLICY "Users manage own push subscriptions" ON notification_subscriptions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_notification_inbox'
      AND policyname = 'Users read own ops inbox'
  ) THEN
    CREATE POLICY "Users read own ops inbox" ON ops_notification_inbox
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_notification_inbox'
      AND policyname = 'Users update own ops inbox'
  ) THEN
    CREATE POLICY "Users update own ops inbox" ON ops_notification_inbox
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_digests'
      AND policyname = 'Users read own ops digests'
  ) THEN
    CREATE POLICY "Users read own ops digests" ON ops_digests
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- END FILE: ops_intel_infra.sql

-- BEGIN FILE: listing_images_storage.sql
-- YoFly Crew - Private listing image storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  7340032,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 7340032,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own listing images'
  ) then
    create policy "Users can upload own listing images"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own listing images'
  ) then
    create policy "Users can update own listing images"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'listing-images'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can read listing images'
  ) then
    create policy "Authenticated users can read listing images"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'listing-images');
  end if;
end $$;

-- END FILE: listing_images_storage.sql

-- BEGIN FILE: crew_state_persistence.sql
-- Cross-device persistence for crew utility state that previously lived only on-device.

CREATE TABLE IF NOT EXISTS crew_custom_rooms (
  id TEXT PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  airport_code TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  airport_code TEXT NOT NULL,
  location_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, airport_code, location_id)
);

CREATE TABLE IF NOT EXISTS saved_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  airport_code TEXT NOT NULL,
  location_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, airport_code, location_id)
);

ALTER TABLE crew_custom_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crew_custom_rooms'
      AND policyname = 'Authenticated read crew rooms'
  ) THEN
    CREATE POLICY "Authenticated read crew rooms"
    ON crew_custom_rooms
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crew_custom_rooms'
      AND policyname = 'Users manage own crew rooms'
  ) THEN
    CREATE POLICY "Users manage own crew rooms"
    ON crew_custom_rooms
    FOR ALL
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_reactions'
      AND policyname = 'Authenticated read message reactions'
  ) THEN
    CREATE POLICY "Authenticated read message reactions"
    ON message_reactions
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_reactions'
      AND policyname = 'Users manage own message reactions'
  ) THEN
    CREATE POLICY "Users manage own message reactions"
    ON message_reactions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_locations'
      AND policyname = 'Users manage own saved locations'
  ) THEN
    CREATE POLICY "Users manage own saved locations"
    ON saved_locations
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_routes'
      AND policyname = 'Users manage own saved routes'
  ) THEN
    CREATE POLICY "Users manage own saved routes"
    ON saved_routes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS crew_custom_rooms_created_by_idx ON crew_custom_rooms (created_by);
CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS saved_locations_user_airport_idx ON saved_locations (user_id, airport_code);
CREATE INDEX IF NOT EXISTS saved_routes_user_airport_idx ON saved_routes (user_id, airport_code);

-- END FILE: crew_state_persistence.sql

-- BEGIN FILE: place_intel_directory.sql
-- Shared crew place intel for airport businesses, cafes, bars, and airport-anchor markers.

CREATE TABLE IF NOT EXISTS place_intel_notes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  airport_code TEXT NOT NULL,
  place_key TEXT NOT NULL,
  google_place_id TEXT,
  place_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE place_intel_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'place_intel_notes'
      AND policyname = 'Authenticated read place intel notes'
  ) THEN
    CREATE POLICY "Authenticated read place intel notes"
    ON place_intel_notes
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'place_intel_notes'
      AND policyname = 'Users manage own place intel notes'
  ) THEN
    CREATE POLICY "Users manage own place intel notes"
    ON place_intel_notes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS place_intel_notes_airport_place_idx
ON place_intel_notes (airport_code, place_key);

CREATE INDEX IF NOT EXISTS place_intel_notes_google_place_idx
ON place_intel_notes (google_place_id);

-- END FILE: place_intel_directory.sql
