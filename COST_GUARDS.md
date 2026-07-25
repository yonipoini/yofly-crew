# Cost Guards

YoFly must never make paid resource calls by default during local development or pre-launch production testing.

## Default Data Rule

Data should load only when a user opens the relevant screen, returns to it, presses refresh, submits a form, or starts an explicit workflow. Do not add background polling, cron, warm caches, or repeating jobs without an owner-approved usage/cost review.

## Google Places

Google Places is disabled unless all of these are intentionally configured:

```env
EXPO_PUBLIC_GOOGLE_PLACES_ENABLED=true
EXPO_PUBLIC_GOOGLE_PLACES_MAX_SESSION_REQUESTS=5
```

Rich Google business details are a separate opt-in because fields such as ratings, review counts, phone numbers, websites, pricing, and hours can move requests into higher-cost billing SKUs:

```env
EXPO_PUBLIC_GOOGLE_PLACES_RICH_DETAILS_ENABLED=true
```

Marketplace address geocoding is separate from Places browsing and is also disabled by default:

```env
EXPO_PUBLIC_GOOGLE_GEOCODING_ENABLED=true
EXPO_PUBLIC_GOOGLE_GEOCODING_MAX_SESSION_REQUESTS=3
```

## Supabase Cron

Supabase cron jobs must stay disabled unless the owner approves:

- exact function name
- exact schedule
- expected request volume
- expected paid API usage
- shutoff/rollback plan

The current product direction is fetch-on-view and manual refresh, so `ops-refresh`, `ops-dispatch`, and `ops-digest` should not be scheduled by default.

## Development Rules

- Do not call `places.googleapis.com` or `maps.googleapis.com` directly from screens or components.
- Route paid Google calls through `src/services/LocationService.ts`.
- Keep Google Places disabled while testing map layout, directory UI, airport switching, or marker behavior.
- Keep marketplace geocoding disabled unless testing the listing address workflow specifically.
- Use Google Cloud quotas as the hard stop. Budget alerts are not enough.
- Keep local/default request caps low.
- Do not add `setInterval` data refreshes to product screens.

## Required Check

Run this before enabling any paid API work:

```sh
npm run cost:guard
```

The check fails if direct Google API calls are added outside the guarded service or if background Nearby Search requests include Enterprise fields.
