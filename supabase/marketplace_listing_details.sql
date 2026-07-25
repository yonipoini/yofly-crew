-- YoFly Crew - Marketplace listing detail additions
-- Safe to run on an existing project that already has the base schema applied.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url TEXT;
