-- Structured community post organization for searchable crew knowledge.
-- Safe to rerun.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS airport_code TEXT,
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS post_scope TEXT DEFAULT 'GLOBAL'
    CHECK (post_scope IN ('GLOBAL', 'LOCAL', 'BASE', 'TRIP')),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE INDEX IF NOT EXISTS posts_airport_code_idx
  ON posts (airport_code);

CREATE INDEX IF NOT EXISTS posts_topic_tags_gin_idx
  ON posts USING GIN (topic_tags);

CREATE INDEX IF NOT EXISTS posts_metadata_gin_idx
  ON posts USING GIN (metadata);

CREATE INDEX IF NOT EXISTS posts_created_at_idx
  ON posts (created_at DESC);

CREATE INDEX IF NOT EXISTS posts_search_vector_gin_idx
  ON posts USING GIN (search_vector);

CREATE OR REPLACE FUNCTION update_posts_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'english',
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.content, '') || ' ' ||
      coalesce(NEW.airport_code, '') || ' ' ||
      coalesce(array_to_string(NEW.topic_tags, ' '), '')
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_search_vector_update ON posts;

CREATE TRIGGER posts_search_vector_update
BEFORE INSERT OR UPDATE OF title, content, airport_code, topic_tags
ON posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_search_vector();

UPDATE posts
SET
  airport_code = upper(substring(content from '#([A-Za-z]{3})')),
  topic_tags = ARRAY(
    SELECT DISTINCT regexp_replace(match[1], '([a-z])([A-Z])', '\1 \2', 'g')
    FROM regexp_matches(content, '#([A-Za-z][A-Za-z0-9_]{2,})', 'g') AS match
    WHERE upper(match[1]) !~ '^[A-Z]{3}$'
  )
WHERE airport_code IS NULL
  AND content ~ '#[A-Za-z0-9_]+';

UPDATE posts
SET search_vector =
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(content, '') || ' ' ||
    coalesce(airport_code, '') || ' ' ||
    coalesce(array_to_string(topic_tags, ' '), '')
  )
WHERE search_vector IS NULL;
