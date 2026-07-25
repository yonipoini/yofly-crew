# Supabase Edge Functions Setup

This app can use a Supabase Edge Function as the shared places backend for both iOS and Android.

## Function included in this repo

- `supabase/functions/places-nearby/index.ts`
- `supabase/functions/flight-board/index.ts`
- `supabase/functions/aviation-weather/index.ts`
- `supabase/functions/tsa-estimates/index.ts`
- `supabase/functions/ops-refresh/index.ts`
- `supabase/functions/ops-dispatch/index.ts`
- `supabase/functions/ops-digest/index.ts`

Purpose:

- calls Google Places server-side
- keeps the Google API key out of the mobile app bundle
- returns one normalized nearby-places payload to both platforms
- calls FlightAware AeroAPI server-side
- keeps the FlightAware API key out of the mobile app bundle
- returns a normalized airport departure board payload to the app
- proxies third-party TSA estimate providers server-side
- keeps partner wait-time API keys out of the mobile app bundle
- optionally refreshes and caches airport ops snapshots in Supabase when explicitly enabled
- optionally dispatches critical ops push alerts through Expo push when explicitly enabled
- optionally writes morning/disruption digests into the in-app inbox when explicitly enabled

## Cost And Background Work Rule

Default production behavior is user-requested reads only:

- no Supabase cron by default
- no background polling by default
- no paid Google, FlightAware, TSA partner, weather, or AI API calls unless a user opens the relevant screen, presses refresh, submits a form, or explicitly starts the workflow
- any future background job must include a usage/cost review before it is enabled

## Recommended architecture

1. App calls the Supabase function
2. Supabase function calls Google Places
3. App renders the same location data on iOS and Android
4. Native map renderer stays platform-specific underneath

## What the client does today

The client now prefers providers in this order:

1. `EXPO_PUBLIC_PLACES_ENDPOINT`
2. Supabase Edge Function `places-nearby`
3. Direct Google Places only when `EXPO_PUBLIC_GOOGLE_PLACES_ENABLED=true` and the per-session cap allows it

For flight board data, the client now prefers providers in this order:

1. `EXPO_PUBLIC_FLIGHT_STATUS_ENDPOINT`
2. Supabase Edge Function `flight-board`
3. Empty flight board state when live data is unavailable

For optional ops caching and digests:

1. Run [`supabase/ops_intel_infra.sql`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/ops_intel_infra.sql)
2. Deploy `tsa-estimates`, `ops-refresh`, `ops-dispatch`, and `ops-digest`
3. Keep cron disabled unless the owner explicitly approves the exact schedule, data sources, and expected cost

For TSA checkpoint estimates, the client now prefers providers in this order:

1. Recent crew reports from `tsa_reports`
2. `EXPO_PUBLIC_TSA_ESTIMATE_ENDPOINT`
3. Supabase Edge Function `tsa-estimates`
4. No-data state until a partner feed is connected

That means once the function is deployed, you do not need to change the UI code.

## Deploy from Supabase Dashboard

If you do not want to install the CLI, you can:

1. Open your Supabase project
2. Go to Edge Functions
3. Create a function named `places-nearby`
4. Paste the contents of:
   [`supabase/functions/places-nearby/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/places-nearby/index.ts)
5. Add a secret named `GOOGLE_MAPS_API_KEY`
6. Create another function named `flight-board`
7. Paste the contents of:
   [`supabase/functions/flight-board/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/flight-board/index.ts)
8. Add a secret named `FLIGHTAWARE_API_KEY`
9. Create a function named `aviation-weather`
10. Paste the contents of:
    [`supabase/functions/aviation-weather/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/aviation-weather/index.ts)
11. Create a function named `tsa-estimates`
12. Paste the contents of:
    [`supabase/functions/tsa-estimates/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/tsa-estimates/index.ts)
13. Add secrets:
    `TSA_ESTIMATE_ENDPOINT`
    `TSA_ESTIMATE_API_KEY` (optional)
    `TSA_ESTIMATE_AUTH_HEADER` (optional, defaults to `x-api-key`)
    `TSA_ESTIMATE_SOURCE_LABEL` (optional)
    `TSA_ESTIMATE_PROVIDER_ID` (optional)
    or `TSA_WAIT_TIMES_API_KEY` for the built-in TSAWaitTimes.com provider adapter
14. Optional only: create `ops-refresh`, `ops-dispatch`, and `ops-digest` the same way
15. Paste the contents of:
    [`supabase/functions/ops-refresh/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/ops-refresh/index.ts)
16. Paste the contents of:
    [`supabase/functions/ops-dispatch/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/ops-dispatch/index.ts)
17. Paste the contents of:
    [`supabase/functions/ops-digest/index.ts`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/functions/ops-digest/index.ts)
18. Deploy only the functions you need. Do not create cron schedules by default.

## Deploy with Supabase CLI

If you install the CLI later, the normal flow is:

```bash
supabase functions deploy places-nearby
supabase functions deploy flight-board
supabase functions deploy aviation-weather
supabase functions deploy tsa-estimates
supabase secrets set GOOGLE_MAPS_API_KEY=your_key_here
supabase secrets set FLIGHTAWARE_API_KEY=your_key_here
supabase secrets set TSA_ESTIMATE_ENDPOINT=https://your-provider.example.com/wait-times
supabase secrets set TSA_ESTIMATE_API_KEY=your_partner_key
# Or, for the built-in TSAWaitTimes.com adapter:
supabase secrets set TSA_WAIT_TIMES_API_KEY=your_tsawaittimes_key
```

If your local project is not initialized yet, run `supabase init` first.

## Fastest live-data rollout order

If the app is showing `TSA Wait Unavailable` or no flight rows, use this order:

1. Install the Supabase CLI locally
2. Link this repo to the correct Supabase project
3. Deploy `flight-board`
4. Set `FLIGHTAWARE_API_KEY`
5. Deploy `aviation-weather`
6. Deploy `tsa-estimates`
7. Set either `TSA_WAIT_TIMES_API_KEY` or `TSA_ESTIMATE_ENDPOINT`
8. Add optional TSA partner secrets if your provider requires auth
9. Run:

```bash
npm run backend:verify
```

Expected healthy responses:

- `tsa-estimates` returns `200` with an `updates` array
- `flight-board` returns `200` with a `flights` array
- `aviation-weather` returns `200` with official METAR-derived weather

Current app behavior when backend is missing:

- TSA shows `Unavailable` instead of fake zero-minute waits
- flight board shows an empty/no-data state instead of fake rows
- weather can stay live through the `aviation-weather` function

## CLI commands once installed

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy flight-board
supabase functions deploy aviation-weather
supabase functions deploy tsa-estimates
supabase secrets set FLIGHTAWARE_API_KEY=your_key_here
supabase secrets set TSA_ESTIMATE_ENDPOINT=https://your-provider.example.com/wait-times
supabase secrets set TSA_ESTIMATE_API_KEY=your_partner_key
supabase secrets set TSA_ESTIMATE_AUTH_HEADER=x-api-key
supabase secrets set TSA_ESTIMATE_SOURCE_LABEL="Partner estimate"
supabase secrets set TSA_ESTIMATE_PROVIDER_ID=partner
# Or use the built-in TSAWaitTimes.com adapter:
supabase secrets set TSA_WAIT_TIMES_API_KEY=your_tsawaittimes_key
```

## Optional app env

You can leave `EXPO_PUBLIC_PLACES_ENDPOINT` blank if you use the same Supabase project.

Only set `EXPO_PUBLIC_PLACES_ENDPOINT` if you want the app to hit a custom backend URL instead of the built-in same-project function path.

Only set `EXPO_PUBLIC_FLIGHT_STATUS_ENDPOINT` if you want the app to hit a custom backend URL instead of the built-in same-project function path.
