# YoFly Crew Workspace Supabase Setup

This workspace is intended to use a separate Supabase project from the Antigravity version.

## Goal

Keep these two environments isolated:

- Original Antigravity app copy and backend
- New local workspace app copy and backend

That lets you keep building here without risking the original project state.

## 1. Create a new Supabase project

In Supabase, create a brand new project for the workspace copy.

Recommended name:

- `yofly-crew-workspace`

## 2. Apply the existing schema

Open the SQL editor in the new Supabase project and run:

- [`supabase/schema.sql`](/Users/yoni/Documents/New%20project/yofly-crew-workspace/supabase/schema.sql)

That reuses the existing tables and basic policies so you do not need to start from scratch.

## 3. Update the workspace environment variables

Copy `.env.example` to `.env`, then replace the values with the new project's credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-new-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key
```

## 4. Keep environments separate

Use this rule going forward:

- Antigravity folder uses its original Supabase project
- Workspace folder uses the new Supabase project only

## 5. Reusable pieces already in this repo

You are reusing:

- Expo / React Native app structure
- Supabase service layer in `src/services/`
- existing database schema
- existing UI and navigation
- existing feature models for alerts, community, marketplace, TSA, and map data

## 6. Recommended next build order

After the new Supabase project is connected, the safest sequence is:

1. Verify read access for posts, alerts, listings, and locations
2. Verify create flows for posts, alerts, TSA reports, and listings
3. Add auth and profile creation flow
4. Replace mock services one by one for weather, airport status, and SOS
