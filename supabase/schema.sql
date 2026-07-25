-- YoFly Crew - Database Schema

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('PILOT', 'FA', 'DISPATCH')),
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
  verification_status TEXT DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED', 'PENDING_EMAIL', 'VERIFIED_CREW', 'PENDING_MANUAL', 'REJECTED')),
  verification_method TEXT
    CHECK (verification_method IN ('AIRLINE_EMAIL', 'MANUAL_REVIEW')),
  verified_crew BOOLEAN DEFAULT false,
  verified_marketplace BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  manual_review_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approved airline domains used for crew-only verification
CREATE TABLE airline_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airline_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  accepted_roles TEXT[] DEFAULT ARRAY['PILOT', 'FA'],
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fallback path when airline email verification is not available
CREATE TABLE manual_review_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  work_email TEXT,
  claimed_airline TEXT,
  employee_id_last4 TEXT,
  badge_image_url TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Alerts: Layover safety/logistics alerts
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id),
  type TEXT CHECK (type IN (
    'SHUTTLE',
    'HOTEL',
    'SAFETY',
    'TSA_KCM',
    'GATE_TERMINAL',
    'CREW_ROOM',
    'MAINTENANCE',
    'CATERING',
    'BAGGAGE',
    'WEATHER',
    'SCHEDULING',
    'PARKING',
    'GENERAL'
  )),
  airport_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TSA Reports: Crowdsourced security wait times
CREATE TABLE tsa_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id),
  airport_code TEXT NOT NULL,
  terminal TEXT NOT NULL,
  wait_time_mins INTEGER NOT NULL,
  status TEXT CHECK (status IN ('CLEAR', 'MODERATE', 'BUSY', 'CRITICAL')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map Locations: Crew-recommended spots
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('RESTAURANT', 'COFFEE', 'GYM', 'GROCERY', 'NIGHTLIFE', 'SAFE_AREA', 'PHARMACY', 'LOUNGE')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  rating DOUBLE PRECISION,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airport Directory Places: Curated ops anchors and fallback spots
CREATE TABLE airport_directory_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airport_code TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RESTAURANT', 'COFFEE', 'GYM', 'GROCERY', 'NIGHTLIFE', 'SAFE_AREA', 'PHARMACY', 'LOUNGE')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  rating DOUBLE PRECISION DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  crew_favorite BOOLEAN DEFAULT FALSE,
  airport_core BOOLEAN DEFAULT FALSE,
  airport_core_kind TEXT CHECK (airport_core_kind IN ('TERMINAL', 'SECURITY', 'GROUND', 'SHUTTLE', 'BAGGAGE', 'COFFEE', 'LOUNGE', NULL)),
  short_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_airport_directory_places_airport_code ON airport_directory_places(airport_code);


-- Community Posts
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id),
  type TEXT CHECK (type IN ('NEWS', 'QUESTION', 'STORY', 'DEAL', 'VENT', 'TIP')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  airport_code TEXT,
  topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  post_scope TEXT DEFAULT 'GLOBAL' CHECK (post_scope IN ('GLOBAL', 'LOCAL', 'BASE', 'TRIP')),
  metadata JSONB DEFAULT '{}'::jsonb,
  search_vector TSVECTOR,
  is_anonymous BOOLEAN DEFAULT FALSE,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

-- Marketplace Listings
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,
  airport_code TEXT NOT NULL,
  category TEXT CHECK (category IN ('CRASH_PAD', 'PRIVATE_ROOM', 'ITEM', 'SERVICE')),
  gender_pref TEXT CHECK (gender_pref IN ('MALE', 'FEMALE', 'MIXED')),
  beds_available INTEGER,
  distance_info TEXT,
  description TEXT,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE airline_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsa_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE airport_directory_places ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Public read for now for ease of dev)
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Public read active airline domains" ON airline_domains FOR SELECT USING (is_active = true);
CREATE POLICY "Users can insert own manual review requests" ON manual_review_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can read own manual review requests" ON manual_review_requests FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Public read alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Public read tsa_reports" ON tsa_reports FOR SELECT USING (true);
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public read airport directory places" ON airport_directory_places FOR SELECT USING (true);
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read post comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Verified crew can insert posts" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Verified crew can insert post comments" ON post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own post comments" ON post_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Users can manage own post votes" ON post_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own saved posts" ON saved_posts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read listings" ON listings FOR SELECT USING (true);
CREATE POLICY "Public read messages" ON messages FOR SELECT USING (true);
