-- Add level and zone columns to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone TEXT;

-- Create policy for authenticated users to insert locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Authenticated users can insert locations'
  ) THEN
    CREATE POLICY "Authenticated users can insert locations"
    ON locations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

-- Create policy for authenticated users to update locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Authenticated users can update locations'
  ) THEN
    CREATE POLICY "Authenticated users can update locations"
    ON locations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
