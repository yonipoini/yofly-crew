# Getting Started with YoFly Crew 🚀

Welcome to the **YoFly Crew** project! You are now ready to view the premium aviation-first mobile app on your own device.

## Prerequisites
1.  **Node.js**: Ensure you have Node.js installed (LTS recommended).
2.  **Expo Go**: Download the "Expo Go" app on your [iOS](https://apps.apple.com/app/expo-go/id982107779) or [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) device.

## Step 1: Install Dependencies
Open your terminal in the `yofly-crew` directory and run:
```bash
npm install --legacy-peer-deps
```

## Step 2: Set Up Supabase
The app is meant to run from real user-triggered data. To connect to your backend:
1.  Create a project at [supabase.com](https://supabase.com).
2.  Copy `.env.example` to `.env`.
3.  Fill in your `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4.  If you are working from the isolated local copy, create a brand new Supabase project for this workspace instead of reusing the Antigravity backend.
5.  Run the SQL in `supabase/schema.sql` against that new project before testing write flows.

## Step 3: Optional live APIs
- Aviation weather: already wired to the official Aviation Weather METAR feed and falls back only when live data is unavailable.
- Google Places for the map: keep disabled unless you intentionally opt in with `EXPO_PUBLIC_GOOGLE_PLACES_ENABLED=true`, a restricted Google key, and a low `EXPO_PUBLIC_GOOGLE_PLACES_MAX_SESSION_REQUESTS` cap.
- Marketplace address geocoding: keep disabled unless you intentionally opt in with `EXPO_PUBLIC_GOOGLE_GEOCODING_ENABLED=true` and a low `EXPO_PUBLIC_GOOGLE_GEOCODING_MAX_SESSION_REQUESTS` cap.
- Production-ready places flow: set `EXPO_PUBLIC_PLACES_ENDPOINT` to a shared backend or Supabase Edge Function so iOS and Android use the same normalized location feed.
- Airport delay/status: keep using Supabase TSA reports until you add a backend endpoint to `EXPO_PUBLIC_AIRPORT_STATUS_ENDPOINT`.
- Supabase Edge Function setup for places is documented in `SUPABASE_EDGE_FUNCTIONS.md`.

## Step 4: Run the App
Launch the Expo development server:
```bash
npx expo start
```
-   **Scan the QR Code**: Open your phone's camera (iOS) or the Expo Go app (Android) and scan the QR code in the terminal.
-   **View in Browser**: Press `w` to open the web version (though mobile-first is recommended).

## Features to Test
-   **Home**: Check the horizontal TSA wait times and your flight stats.
-   **Alerts**: Try posting a new layover alert via the FAB (+ button).
-   **Map**: Explore the interactive aviation-style map around your selected airport.
-   **Community**: Scroll through the feed and try "Anonymous" posting.
-   **Marketplace**: Filter crash pads by airport (JFK, LAX, MIA).

## Deployment
When you're ready to share with others, use **Expo EAS**:
```bash
npx eas build --profile development
```

Clear for takeoff! ✈️✨
