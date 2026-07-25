const fs = require('fs');

const fileContent = fs.readFileSync('src/services/LocationService.ts', 'utf8');

// A rough regex/parsing isn't strictly necessary if we can just grab the objects.
// Wait, we can just execute the objects directly if we extract them.
// Actually, let's just write a regex or eval the blocks.

let sql = '-- Seed Data for Airport Directory\n\n';

function extractAndConvert(varName) {
  const regex = new RegExp(`const ${varName}[^=]*=([^;]+);`);
  const match = fileContent.match(regex);
  if (!match) return null;
  let code = match[1];
  // To eval it safely, we need to mock LocationType
  const LocationType = {
    SAFE_AREA: 'SAFE_AREA',
    COFFEE: 'COFFEE',
    BAGGAGE: 'BAGGAGE',
    GROUND: 'GROUND',
    TERMINAL: 'TERMINAL',
    SECURITY: 'SECURITY',
    SHUTTLE: 'SHUTTLE',
    LOUNGE: 'LOUNGE',
    PHARMACY: 'PHARMACY',
    GROCERY: 'GROCERY',
    GYM: 'GYM',
    NIGHTLIFE: 'NIGHTLIFE',
    RESTAURANT: 'RESTAURANT'
  };
  
  // Replace the typescript type annotations if any
  code = code.replace(/:\s*FallbackSeed\[\]/g, '');
  code = code.replace(/:\s*Record<string, FallbackSeed\[\]>/g, '');
  
  try {
    const data = eval(`(function(LocationType) { return ${code} })(LocationType)`);
    return data;
  } catch(e) {
    console.error("Eval error for " + varName, e);
    return null;
  }
}

const AIRPORT_CORE_SEEDS_BY_AIRPORT = extractAndConvert('AIRPORT_CORE_SEEDS_BY_AIRPORT');
const GENERIC_AIRPORT_CORE_SEEDS = extractAndConvert('GENERIC_AIRPORT_CORE_SEEDS');
const FALLBACK_SEEDS_BY_AIRPORT = extractAndConvert('FALLBACK_SEEDS_BY_AIRPORT');
const GENERIC_FALLBACK_SEEDS = extractAndConvert('GENERIC_FALLBACK_SEEDS');

const escapeStr = str => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

function toSql(airportCode, seed) {
  // Center coordinates (rough approx based on HUBS in index.ts or DEFAULT)
  const centers = {
    JFK: { lat: 40.6413, lon: -73.7781 },
    LAX: { lat: 33.9416, lon: -118.4085 },
    MIA: { lat: 25.7959, lon: -80.2870 },
    MCO: { lat: 28.4312, lon: -81.3081 }
  };
  const center = centers[airportCode] || centers['JFK'];
  
  const toRadians = (v) => (v * Math.PI) / 180;
  const lat = center.lat + seed.northMiles / 69;
  const lon = center.lon + seed.eastMiles / (Math.cos(toRadians(center.lat)) * 69);

  return `INSERT INTO airport_directory_places (airport_code, key, name, type, latitude, longitude, address, rating, review_count, crew_favorite, airport_core, airport_core_kind, short_label)
VALUES (
  '${airportCode}', 
  '${airportCode.toLowerCase()}-${seed.key}', 
  ${escapeStr(seed.name)}, 
  '${seed.type}', 
  ${lat}, 
  ${lon}, 
  ${escapeStr(airportCode + ' ' + seed.address)}, 
  ${seed.rating || 0}, 
  ${seed.reviewCount || 0}, 
  ${seed.crewFavorite ? 'TRUE' : 'FALSE'}, 
  ${seed.airportCore ? 'TRUE' : 'FALSE'}, 
  ${escapeStr(seed.airportCoreKind)}, 
  ${escapeStr(seed.shortLabel)}
) ON CONFLICT (key) DO NOTHING;`;
}

if (AIRPORT_CORE_SEEDS_BY_AIRPORT) {
  for (const airportCode of Object.keys(AIRPORT_CORE_SEEDS_BY_AIRPORT)) {
    for (const seed of AIRPORT_CORE_SEEDS_BY_AIRPORT[airportCode]) {
      sql += toSql(airportCode, seed) + '\n';
    }
  }
}

if (FALLBACK_SEEDS_BY_AIRPORT) {
  for (const airportCode of Object.keys(FALLBACK_SEEDS_BY_AIRPORT)) {
    for (const seed of FALLBACK_SEEDS_BY_AIRPORT[airportCode]) {
      sql += toSql(airportCode, seed) + '\n';
    }
  }
}

// Write the output
fs.writeFileSync('supabase/seed_airport_directory.sql', sql);
console.log('Seed SQL generated at supabase/seed_airport_directory.sql');

