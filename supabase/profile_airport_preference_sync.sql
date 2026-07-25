-- Keep each user's chosen base airport from snapping back to the default hub.
-- Safe to rerun. This does not force MCO or any specific airport.

CREATE OR REPLACE FUNCTION public.sync_profile_airport_preferences()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_base TEXT;
  normalized_preferences JSONB;
  existing_favorites JSONB;
BEGIN
  normalized_base := COALESCE(NULLIF(upper(COALESCE(NEW.base_airport, '')), ''), 'JFK');
  normalized_preferences := COALESCE(NEW.preferences, '{}'::jsonb);
  existing_favorites := CASE
    WHEN jsonb_typeof(normalized_preferences->'favoriteAirports') = 'array' THEN normalized_preferences->'favoriteAirports'
    ELSE '[]'::jsonb
  END;

  NEW.base_airport := normalized_base;
  normalized_preferences := jsonb_set(
    normalized_preferences,
    '{favoriteAirports}',
    (
      SELECT jsonb_agg(DISTINCT airport_code)
      FROM (
        SELECT normalized_base AS airport_code
        UNION ALL
        SELECT upper(value) AS airport_code
        FROM jsonb_array_elements_text(existing_favorites) AS value
        WHERE NULLIF(upper(value), '') IS NOT NULL
      ) favorites
    ),
    true
  );

  IF COALESCE(normalized_preferences->>'opsContextMode', 'BASE') = 'BASE' THEN
    normalized_preferences := jsonb_set(normalized_preferences, '{opsContextMode}', '"BASE"'::jsonb, true);
    normalized_preferences := jsonb_set(normalized_preferences, '{activeOpsAirport}', to_jsonb(normalized_base), true);
  END IF;

  NEW.preferences := normalized_preferences;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_airport_preferences_trigger ON profiles;
CREATE TRIGGER sync_profile_airport_preferences_trigger
BEFORE INSERT OR UPDATE OF base_airport, preferences ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_airport_preferences();

UPDATE profiles
SET
  base_airport = COALESCE(NULLIF(upper(base_airport), ''), 'JFK'),
  preferences = CASE
    WHEN COALESCE(preferences->>'opsContextMode', 'BASE') = 'BASE' THEN
      jsonb_set(
        jsonb_set(
          COALESCE(preferences, '{}'::jsonb),
          '{opsContextMode}',
          '"BASE"'::jsonb,
          true
        ),
        '{activeOpsAirport}',
        to_jsonb(COALESCE(NULLIF(upper(base_airport), ''), 'JFK')),
        true
      )
    ELSE COALESCE(preferences, '{}'::jsonb)
  END
WHERE TRUE;
