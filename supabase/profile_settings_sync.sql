-- YoFly Crew - Profile settings sync additions
-- Safe to run on an existing project that already has the base schema applied.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aircraft TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB
  DEFAULT '{"intelPush": true, "layoverChat": true, "dealsAndPerks": true, "visibleOnCrewMap": true}'::jsonb;
