-- Create the airport_directory_places table for curated crew intel
-- Updated to include level, zone, and crew_note for "Mall Directory" feel

CREATE TABLE IF NOT EXISTS airport_directory_places (
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
  level TEXT, -- e.g., 'Level 1', 'Departures', 'Arrivals'
  zone TEXT, -- e.g., 'Terminal A', 'Airside 4', 'Concourse C'
  crew_note TEXT, -- Specific crew intel like "Short walk from KCM"
  source_label TEXT DEFAULT 'Curated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for fast fetching
CREATE INDEX IF NOT EXISTS idx_airport_directory_places_airport_code ON airport_directory_places(airport_code);

-- Enable RLS
ALTER TABLE airport_directory_places ENABLE ROW LEVEL SECURITY;

-- Public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'airport_directory_places' 
        AND policyname = 'Public read airport directory places'
    ) THEN
        CREATE POLICY "Public read airport directory places" ON airport_directory_places FOR SELECT USING (true);
    END IF;
END
$$;
