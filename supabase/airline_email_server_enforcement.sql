-- ============================================================================
-- YoFly Crew: Strict Airline Work-Email Server-Side Enforcement Migration
-- ============================================================================
-- This script enforces airline work-email eligibility directly inside Supabase /
-- PostgreSQL. It prevents any client or direct Supabase API call from:
--   1. Creating an account with a personal or unapproved email domain.
--   2. Creating an account with a mismatched airline selection.
--   3. Setting verified_crew = true directly without confirmed airline email.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper Function: Normalize Airline Names for Fuzzy Comparison
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_airline_name_for_comparison(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN '';
  END IF;

  RETURN regexp_replace(
    regexp_replace(
      lower(p_name),
      '[^a-z0-9]', '', 'g'
    ),
    '(airlines|airline|airways|air|inc|llc|corp|group|is)$', ''
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Auth Trigger: Validate Airline Work-Email BEFORE INSERT ON auth.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_airline_work_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_domain TEXT;
  v_airline_name TEXT;
  v_accepted_roles TEXT[];
  v_is_active BOOLEAN;
  v_user_airline TEXT;
  v_user_role TEXT;
  v_norm_user_airline TEXT;
  v_norm_domain_airline TEXT;
  v_norm_role TEXT;
BEGIN
  -- Extract domain from email (after @, lowercase)
  v_domain := lower(split_part(NEW.email, '@', 2));

  IF v_domain IS NULL OR v_domain = '' THEN
    RAISE EXCEPTION 'YoFly Crew registration requires a valid email address.';
  END IF;

  -- Disallow common consumer/personal domains immediately with clear error
  IF v_domain IN ('gmail.com', 'yahoo.com', 'icloud.com', 'outlook.com', 'hotmail.com', 'aol.com', 'proton.me', 'protonmail.com') THEN
    RAISE EXCEPTION 'Personal email domains (@%) are not eligible for YoFly Crew registration. You must register with your official airline work email.', v_domain;
  END IF;

  -- Query approved airline domains
  SELECT airline_name, accepted_roles, is_active
  INTO v_airline_name, v_accepted_roles, v_is_active
  FROM public.airline_domains
  WHERE lower(domain) = v_domain;

  -- Reject unknown domains
  IF v_airline_name IS NULL THEN
    RAISE EXCEPTION 'Registration requires an approved airline work email address. Domain "@%" is not on the approved airline registry.', v_domain;
  END IF;

  -- Reject inactive domains
  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The airline email domain "@%" (%) is currently inactive for crew verification.', v_domain, v_airline_name;
  END IF;

  -- Validate Role if provided
  v_user_role := COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'role_label');
  IF v_user_role IS NOT NULL AND v_user_role <> '' THEN
    v_norm_role := public.normalize_crew_role(v_user_role);
    IF v_accepted_roles IS NOT NULL AND cardinality(v_accepted_roles) > 0 THEN
      IF NOT (v_norm_role = ANY(v_accepted_roles)) THEN
        RAISE EXCEPTION 'Role "%" is not supported for domain "@%" (%).', v_user_role, v_domain, v_airline_name;
      END IF;
    END IF;
  END IF;

  -- Validate Airline Selection if provided
  v_user_airline := COALESCE(NEW.raw_user_meta_data->>'airline', NEW.raw_user_meta_data->>'verification_airline');
  IF v_user_airline IS NOT NULL AND v_user_airline <> '' AND v_user_airline <> 'YoFly Crew' THEN
    v_norm_user_airline := public.normalize_airline_name_for_comparison(v_user_airline);
    v_norm_domain_airline := public.normalize_airline_name_for_comparison(v_airline_name);

    IF v_norm_user_airline <> '' AND v_norm_domain_airline <> '' THEN
      IF position(v_norm_domain_airline IN v_norm_user_airline) = 0
         AND position(v_norm_user_airline IN v_norm_domain_airline) = 0 THEN
        RAISE EXCEPTION 'Selected airline "%" does not match email domain "@%" (belongs to %). Please select the matching airline or use the corresponding work email.',
          v_user_airline, v_domain, v_airline_name;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_airline_work_email_trigger ON auth.users;
CREATE TRIGGER validate_airline_work_email_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.validate_airline_work_email();

-- ----------------------------------------------------------------------------
-- 3. Hardened Profile Verification Gate
-- Prevent authenticated clients from elevating verified_crew without verified airline email
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_domain TEXT;
  v_domain_is_active BOOLEAN;
  v_is_service_role BOOLEAN;
BEGIN
  NEW.role := COALESCE(public.normalize_crew_role(NEW.role), NEW.role);
  NEW.airline_email := NULLIF(lower(COALESCE(NEW.airline_email, '')), '');
  NEW.base_airport := COALESCE(NULLIF(upper(COALESCE(NEW.base_airport, '')), ''), 'JFK');
  NEW.preferences := COALESCE(
    NEW.preferences,
    '{"intelPush": true, "opsPush": true, "dailyDigest": true, "layoverChat": true, "dealsAndPerks": true, "visibleOnCrewMap": true, "opsContextMode": "BASE", "activeOpsAirport": "JFK", "layoverAirport": "", "tripAirport": "", "favoriteAirports": ["JFK"], "preferredAirlines": []}'::jsonb
  );

  -- Check if caller is admin/service_role
  v_is_service_role := (current_user = 'service_role' OR auth.role() = 'service_role');

  -- If caller is a regular authenticated client and attempts to set verified_crew = true
  IF NOT v_is_service_role AND (NEW.verified_crew IS TRUE OR NEW.is_verified IS TRUE) THEN
    -- Check if previously already verified (maintain status if not newly altered)
    IF OLD.verified_crew IS NOT TRUE AND OLD.is_verified IS NOT TRUE THEN
      -- Fetch auth.users record to verify confirmed email
      SELECT email, email_confirmed_at
      INTO v_user_email, v_email_confirmed_at
      FROM auth.users
      WHERE id = NEW.id;

      IF v_user_email IS NULL OR v_email_confirmed_at IS NULL THEN
        -- Email not confirmed yet -> cannot be verified_crew
        NEW.verified_crew := false;
        NEW.verified_marketplace := false;
        NEW.is_verified := false;
        NEW.verification_status := 'PENDING_EMAIL';
      ELSE
        -- Email is confirmed: check domain
        v_domain := lower(split_part(v_user_email, '@', 2));
        SELECT is_active
        INTO v_domain_is_active
        FROM public.airline_domains
        WHERE lower(domain) = v_domain;

        IF v_domain_is_active IS TRUE THEN
          NEW.verified_crew := true;
          NEW.verified_marketplace := true;
          NEW.is_verified := true;
          NEW.verification_status := 'VERIFIED_CREW';
        ELSE
          NEW.verified_crew := false;
          NEW.verified_marketplace := false;
          NEW.is_verified := false;
          NEW.verification_status := 'UNVERIFIED';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Reconcile flags
  NEW.verified_crew := COALESCE(NEW.verified_crew, NEW.is_verified, false);
  NEW.verified_marketplace := COALESCE(NEW.verified_marketplace, NEW.is_verified, NEW.verified_crew, false);
  NEW.is_verified := COALESCE(NEW.is_verified, NEW.verified_crew, NEW.verified_marketplace, false);
  NEW.verification_status := COALESCE(
    NEW.verification_status,
    CASE
      WHEN COALESCE(NEW.verified_crew, false) THEN 'VERIFIED_CREW'
      ELSE 'UNVERIFIED'
    END
  );
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_compatibility_trigger ON profiles;
CREATE TRIGGER sync_profile_compatibility_trigger
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_compatibility();

-- ----------------------------------------------------------------------------
-- 4. Audit Query: Existing Personal Email Accounts in Profiles
-- ----------------------------------------------------------------------------
-- Run this query to audit accounts registered with personal email domains:
--
-- SELECT 
--   id,
--   full_name,
--   airline,
--   airline_email,
--   verified_crew,
--   verification_status,
--   created_at
-- FROM public.profiles
-- WHERE lower(split_part(airline_email, '@', 2)) IN (
--   'gmail.com', 'yahoo.com', 'icloud.com', 'outlook.com', 'hotmail.com', 'aol.com'
-- );
--
-- Note: Identified personal email accounts currently marked verified_crew:
--   - id: 47cc62e4-152f-4769-bbc5-815f4fbe26a9 (orphlyri@gmail.com - "Test Crew Buyer")
--   - id: fb0ac4cc-35be-4a53-9685-fbcd1fc48483 (quepajotv@gmail.com)
-- Admin can adjust them after review:
-- UPDATE public.profiles
-- SET verified_crew = false, is_verified = false, verification_status = 'UNVERIFIED'
-- WHERE id IN ('47cc62e4-152f-4769-bbc5-815f4fbe26a9', 'fb0ac4cc-35be-4a53-9685-fbcd1fc48483');

