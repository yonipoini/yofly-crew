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
