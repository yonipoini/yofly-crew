-- YoFly Crew - Marketplace taxonomy refresh
-- Adds gallery image support and expands listing categories for real-estate subtypes.

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE listings
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

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
