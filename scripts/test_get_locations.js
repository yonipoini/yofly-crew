const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Mock react-native Platform
global.Platform = { OS: 'ios' };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mock AsyncStorage
const mockStorage = {};
const AsyncStorage = {
  getItem: async (key) => mockStorage[key] || null,
  setItem: async (key, val) => { mockStorage[key] = val; }
};

// We will recreate the getCuratedPlaces and getLocations logic here to see what it does
const toRadians = (value) => (value * Math.PI) / 180;
const distanceInMeters = (origin, destination) => {
  const earthRadius = 6371000;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(originLat) * Math.cos(destinationLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

// MCO coordinates from airports package:
const searchCenter = { latitude: 28.432177, longitude: -81.308304 };
const searchRadiusMeters = 2500;

async function run() {
  // Let's fetch from DB
  const { data: places, error } = await supabase
    .from('airport_directory_places')
    .select('*')
    .eq('airport_code', 'MCO');
    
  if (error) {
    console.error("Error fetching airport directory:", error);
    return;
  }
  
  console.log(`Fetched places count: ${places.length}`);
  
  // Filter by distance
  const filtered = places.filter((place) => {
    const placeCoords = { latitude: place.latitude, longitude: place.longitude };
    const dist = distanceInMeters(searchCenter, placeCoords);
    return dist <= searchRadiusMeters;
  });
  
  console.log(`Filtered places count (within 2500m): ${filtered.length}`);
  if (filtered.length > 0) {
    console.log(`First filtered place:`, filtered[0]);
  }
}

run();
