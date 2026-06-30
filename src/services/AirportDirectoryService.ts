import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrewLocation, LocationType, AirportCoreKind, Coordinates } from '../types/locations';
import mcoRealPlaces from './mcoRealPlaces.json';

const DIRECTORY_CACHE_KEY_PREFIX = '@yofly_airport_dir_';
const DIRECTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AirportDirectoryPlace {
  id: string;
  airport_code: string;
  key: string;
  name: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  address: string;
  rating: number;
  review_count: number;
  crew_favorite: boolean;
  airport_core: boolean;
  airport_core_kind?: AirportCoreKind;
  short_label?: string;
  level?: string;
  zone?: string;
  x?: number;
  y?: number;
  crew_note?: string;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInMeters = (origin: Coordinates, destination: Coordinates) => {
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

export const AirportDirectoryService = {
  async getCuratedPlaces(
    airportCode: string,
    searchCenter: Coordinates,
    searchRadiusMeters: number,
    bypassCache: boolean = false
  ): Promise<CrewLocation[]> {
    const cacheKey = `${DIRECTORY_CACHE_KEY_PREFIX}${airportCode.toUpperCase()}`;
    let places: AirportDirectoryPlace[] = [];

    try {
      if (!bypassCache) {
        const cachedString = await AsyncStorage.getItem(cacheKey);
        if (cachedString) {
          const cachedData = JSON.parse(cachedString);
          if (
            cachedData.timestamp &&
            Date.now() - cachedData.timestamp < DIRECTORY_CACHE_TTL_MS &&
            cachedData.places &&
            cachedData.places.length > 0
          ) {
            places = cachedData.places;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to read airport directory cache:', err);
    }

    // Validate cache: if places exist but none of them have level info or coordinate info (x/y), it's stale
    const hasLevels = places.some((p) => p.level !== undefined && p.level !== null);
    const hasCoords = places.some((p) => p.x !== undefined && p.x !== null);
    if (places.length > 0 && (!hasLevels || !hasCoords)) {
      console.log('Stale directory cache detected (no levels or coordinates). Reloading...');
      places = [];
    }

    if (!places || places.length === 0) {
      const { data, error } = await supabase
        .from('airport_directory_places')
        .select('*')
        .eq('airport_code', airportCode.toUpperCase());

      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        console.warn('Error fetching airport directory:', error);
      } else if (data) {
        places = data as AirportDirectoryPlace[];
        try {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ timestamp: Date.now(), places })
          );
        } catch (err) {
          console.warn('Failed to cache airport directory:', err);
        }
      }
    }

    // Manually ensure visible MCO places are present in MCO directory
    if (airportCode.toUpperCase() === 'MCO') {
      const mcoExtraPlaces = mcoRealPlaces as AirportDirectoryPlace[];
      for (const extra of mcoExtraPlaces) {
        const existingIdx = places.findIndex((p) => p.key === extra.key || p.id === extra.id);
        if (existingIdx !== -1) {
          // Merge local curated coordinates, level, and zone into the database/cached place
          places[existingIdx] = {
            ...places[existingIdx],
            ...extra,
            x: extra.x !== undefined && extra.x !== null ? extra.x : places[existingIdx].x,
            y: extra.y !== undefined && extra.y !== null ? extra.y : places[existingIdx].y,
            level: extra.level || places[existingIdx].level,
            zone: extra.zone || places[existingIdx].zone,
          };
        } else {
          places.push(extra);
        }
      }
    }

    // Filter by radius and convert to CrewLocation
    return places
      .filter((place) => {
        const placeCoords = { latitude: place.latitude, longitude: place.longitude };
        return distanceInMeters(searchCenter, placeCoords) <= searchRadiusMeters;
      })
      .map((place) => ({
        id: place.id || place.key,
        airportCode: place.airport_code,
        name: place.name,
        type: place.type,
        coordinate: {
          latitude: place.latitude,
          longitude: place.longitude,
        },
        address: place.address,
        rating: place.rating,
        reviewCount: place.review_count,
        isCrewFavorite: place.crew_favorite,
        source: 'airport',
        airportCore: place.airport_core,
        airportCoreKind: place.airport_core_kind,
        shortLabel: place.short_label,
        level: place.level,
        zone: place.zone,
        x: place.x,
        y: place.y,
        crewTip: place.crew_note,
      }));
  },
};
