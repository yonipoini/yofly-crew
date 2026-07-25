-- YoFly Crew - Marketplace category detail payload
-- Adds a flexible JSONB details field for housing, product, and service-specific fields.

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
