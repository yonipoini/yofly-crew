## Shared Web + App Supabase Setup

Run the shared bridge SQL in the Supabase SQL Editor:

- file: [shared_web_app_sync.sql](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/shared_web_app_sync.sql)

What it does:

- upgrades `profiles` to the app's canonical shape
- creates any missing app community and marketplace tables
- keeps legacy website tables `vent_posts` and `marketplace_listings` synced with app `posts` and `listings`
- auto-creates a `profiles` row when a new `auth.users` record appears
- adds missing owner-write RLS policies for profiles, posts, listings, comments, saved posts, votes, and messages
- adds the shared tables to `supabase_realtime`

Recommended rollout order:

1. Open Supabase `SQL Editor`
2. Paste the contents of [shared_web_app_sync.sql](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/shared_web_app_sync.sql)
3. Run it once
4. Test:
   - sign up on the website and confirm a `profiles` row appears
   - create a vent on the website and confirm it appears in app `posts`
   - create a listing in the app and confirm it appears in website `marketplace_listings`

Notes:

- Canonical tables after this migration are `profiles`, `posts`, and `listings`
- The legacy website tables can keep working while the Antigravity frontend is still pointed at them
- Once the website is updated to read/write the canonical tables directly, the legacy bridge can be removed
