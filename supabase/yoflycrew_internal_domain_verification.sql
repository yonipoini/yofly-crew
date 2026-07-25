-- Approve YoFly Crew internal/test accounts for crew-gated app access.
-- This keeps Marketplace on the same single verified_crew gate as the rest of the app.

INSERT INTO public.airline_domains (airline_name, domain, accepted_roles, is_active)
VALUES ('YoFly Crew', 'yoflycrew.com', ARRAY['PILOT', 'FA'], true)
ON CONFLICT (domain) DO UPDATE
SET
  airline_name = EXCLUDED.airline_name,
  accepted_roles = EXCLUDED.accepted_roles,
  is_active = true;

UPDATE public.profiles
SET
  verification_airline = COALESCE(verification_airline, 'YoFly Crew'),
  verification_status = 'VERIFIED_CREW',
  verification_method = COALESCE(verification_method, 'AIRLINE_EMAIL'),
  verified_crew = true,
  verified_marketplace = true,
  is_verified = true,
  verified_at = COALESCE(verified_at, NOW()),
  updated_at = NOW()
WHERE lower(split_part(airline_email, '@', 2)) = 'yoflycrew.com';
