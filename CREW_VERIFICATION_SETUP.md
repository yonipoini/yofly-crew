# Crew Verification Setup

## Product rule

YoFly Crew should treat `airline work email` as the primary trust gate.

- `work email` = primary crew verification
- `badge / employee ID review` = fallback path
- `Apple / Google sign-in` = optional convenience later, not the verification layer

For MVP, the cleanest flow is:

1. User signs up with their airline work email.
2. App checks the email domain against `airline_domains`.
3. Supabase email confirmation verifies control of that work email.
4. Profile is marked `verified_crew = true`.
5. Marketplace, crash pads, direct listing contact, crew map visibility, and other trusted features unlock.

## Database files

- Base schema: [`/Users/yoni/Documents/New project/yofly-crew-workspace/supabase/schema.sql`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/schema.sql)
- Additive migration for existing projects: [`/Users/yoni/Documents/New project/yofly-crew-workspace/supabase/crew_verification.sql`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/crew_verification.sql)

If your current Supabase project already has the old schema applied, run:

1. [`/Users/yoni/Documents/New project/yofly-crew-workspace/supabase/crew_verification.sql`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/crew_verification.sql)

## Tables added

### `profiles`

New fields:

- `airline_email`
- `verification_airline`
- `verification_status`
- `verification_method`
- `verified_crew`
- `verified_marketplace`
- `verified_at`
- `verification_notes`
- `manual_review_requested_at`

### `airline_domains`

Admin-managed allowlist of trusted airline domains.

Recommended columns:

- `airline_name`
- `domain`
- `accepted_roles`
- `is_active`
- `notes`

### `manual_review_requests`

Fallback queue for crew who cannot verify with work email.

Recommended use:

- badge photo
- employee ID last 4
- claimed airline
- review notes

## Example domain inserts

Only add domains you trust and have verified. Do not bulk guess domains.

Example shape:

```sql
insert into airline_domains (airline_name, domain, accepted_roles)
values
  ('Example Airline', 'crew.exampleairline.com', array['PILOT', 'FA']);
```

## Recommended rollout

### Phase 1

- Store work email on profile
- Match domain against `airline_domains`
- Show verification state in app
- Keep sensitive features visible but not fully locked if you still need prototype access

### Phase 2

- Move signup to work-email auth only
- Require Supabase email confirmation
- Flip `verified_crew = true` after email confirmation
- Gate marketplace, crash pads, listing contact, and crew map

### Phase 3

- Add manual review admin flow
- Add `verified_marketplace` or `trusted_host` for higher-risk listing privileges

## App files

- Verification types: [`/Users/yoni/Documents/New project/yofly-crew-workspace/src/types/verification.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/src/types/verification.ts)
- Verification service: [`/Users/yoni/Documents/New project/yofly-crew-workspace/src/services/CrewVerificationService.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/src/services/CrewVerificationService.ts)
- Settings UI: [`/Users/yoni/Documents/New project/yofly-crew-workspace/app/settings.tsx`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/app/settings.tsx)
- Profile UI: [`/Users/yoni/Documents/New project/yofly-crew-workspace/app/(tabs)/profile.tsx`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/app/(tabs)/profile.tsx)

## Important note

The current app now models crew verification state, but it does not yet have the final work-email auth screen and post-confirmation backend hook. The current implementation is the groundwork for that system, not the final auth gate itself.
