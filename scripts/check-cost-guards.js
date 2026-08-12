const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const allowedGoogleApiFiles = new Set([
  path.join(root, 'scripts/check-cost-guards.js'),
  path.join(root, 'src/services/LocationService.ts'),
  path.join(root, 'src/services/MarketplaceLocationService.ts'),
  path.join(root, 'src/config/runtime.ts'),
  path.join(root, 'supabase/functions/places-nearby/index.ts'),
]);

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.expo' || entry.name === '.expo-export' || entry.name === 'dist') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
};

const problems = [];

for (const file of walk(root)) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  const mentionsGoogleEndpoint =
    source.includes('places.googleapis.com') ||
    source.includes('maps.googleapis.com') ||
    source.includes('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');

  if (mentionsGoogleEndpoint && !allowedGoogleApiFiles.has(file)) {
    problems.push(
      `${relative}: direct Google API/key usage is not allowed. Route paid Google calls through LocationService cost guards.`
    );
  }
}

const runtimeSource = fs.readFileSync(path.join(root, 'src/config/runtime.ts'), 'utf8');
for (const requiredFlag of [
  'googlePlacesEnabled',
  'googlePlacesRichDetailsEnabled',
  'googlePlacesMaxSessionRequests',
  'googleGeocodingEnabled',
  'googleGeocodingMaxSessionRequests',
]) {
  if (!runtimeSource.includes(requiredFlag)) {
    problems.push(`src/config/runtime.ts: missing ${requiredFlag} cost guard.`);
  }
}

const locationSource = fs.readFileSync(path.join(root, 'src/services/LocationService.ts'), 'utf8');
for (const requiredText of [
  'canUseGooglePlaces',
  'googlePlacesSessionRequestCount',
  'runtimeConfig.googlePlacesEnabled',
  'runtimeConfig.googlePlacesMaxSessionRequests',
]) {
  if (!locationSource.includes(requiredText)) {
    problems.push(`src/services/LocationService.ts: missing ${requiredText} cost guard.`);
  }
}

if (locationSource.includes('places.rating,places.userRatingCount')) {
  problems.push('src/services/LocationService.ts: background Nearby Search requests include Enterprise fields.');
}

const marketplaceLocationSource = fs.readFileSync(path.join(root, 'src/services/MarketplaceLocationService.ts'), 'utf8');
for (const requiredText of [
  'canUseGoogleGeocoding',
  'googleGeocodingSessionRequestCount',
  'runtimeConfig.googleGeocodingEnabled',
  'runtimeConfig.googleGeocodingMaxSessionRequests',
]) {
  if (!marketplaceLocationSource.includes(requiredText)) {
    problems.push(`src/services/MarketplaceLocationService.ts: missing ${requiredText} cost guard.`);
  }
}

for (const [relative, source] of [
  ['app/(tabs)/index.tsx', fs.readFileSync(path.join(root, 'app/(tabs)/index.tsx'), 'utf8')],
  ['app/(tabs)/alerts.tsx', fs.readFileSync(path.join(root, 'app/(tabs)/alerts.tsx'), 'utf8')],
  ['app/(tabs)/map.tsx', fs.readFileSync(path.join(root, 'app/(tabs)/map.tsx'), 'utf8')],
]) {
  if (source.includes('setInterval(')) {
    problems.push(`${relative}: background polling is not allowed. Fetch on screen focus or explicit user refresh.`);
  }
}

const placesFunctionPath = path.join(root, 'supabase/functions/places-nearby/index.ts');
if (fs.existsSync(placesFunctionPath)) {
  const placesFunctionSource = fs.readFileSync(placesFunctionPath, 'utf8');
  for (const requiredText of [
    'GOOGLE_PLACES_ENABLED',
    'GOOGLE_PLACES_MAX_INSTANCE_REQUESTS',
    'googlePlacesInstanceRequestCount',
  ]) {
    if (!placesFunctionSource.includes(requiredText)) {
      problems.push(`supabase/functions/places-nearby/index.ts: missing ${requiredText} cost guard.`);
    }
  }

  if (placesFunctionSource.includes('places.rating,places.userRatingCount')) {
    problems.push('supabase/functions/places-nearby/index.ts: Nearby Search requests include Enterprise fields.');
  }
}

if (problems.length > 0) {
  console.error('Cost guard check failed:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('Cost guard check passed.');
