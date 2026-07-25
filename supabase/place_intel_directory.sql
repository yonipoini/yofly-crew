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
