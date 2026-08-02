import { supabase } from '../lib/supabase';
import { runtimeConfig } from '../config/runtime';
import { AirportCoreKind, Coordinates, CrewLocation, LocationType } from '../types/locations';
import { getAirportCoordinates } from '../utils/airportContext';
import { Platform } from 'react-native';
import { AirportDirectoryService } from './AirportDirectoryService';
import { CrewAccessService } from './CrewAccessService';

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  priceLevel?: string;
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
};

type SharedPlacesResponse = {
  locations?: GooglePlace[];
};

type PlacesSearchGroup = {
  key: string;
  types: string[];
  maxResultCount: number;
};

type FallbackSeed = {
  key: string;
  type: LocationType;
  northMiles: number;
  eastMiles: number;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  crewFavorite?: boolean;
  airportCore?: boolean;
  airportCoreKind?: AirportCoreKind;
  shortLabel?: string;
};

export interface LocationSearchOptions {
  hubCode?: string;
  center?: Coordinates;
  radiusMeters?: number;
  includeProviderPlaces?: boolean;
  bypassCache?: boolean;
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

const DEFAULT_CENTER = {
  latitude: 40.6413,
  longitude: -73.7781,
};

const DEFAULT_TARGET_LOCATION_COUNT = 22;
const MISSING_TABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);
const PROVIDER_CACHE_TTL_MS = 10 * 60 * 1000;
const warnedLocationFallbacks = new Set<string>();
let googlePlacesDisabledUntil = 0;
let googlePlacesSessionRequestCount = 0;
const providerLocationCache = new Map<string, { expiresAt: number; locations: CrewLocation[] }>();

const getGooglePlacesApiKey = () => {
  if (Platform.OS === 'ios' && runtimeConfig.googleMapsIosApiKey) {
    return runtimeConfig.googleMapsIosApiKey;
  }
  return runtimeConfig.googleMapsApiKey;
};

const warnLocationFallbackOnce = (key: string, message: string, error: unknown) => {
  if (warnedLocationFallbacks.has(key)) {
    return;
  }

  warnedLocationFallbacks.add(key);
  console.warn(message, error);
};

const isRateLimitedError = (error: unknown) =>
  error instanceof Error
    ? error.message.includes('429')
    : typeof error === 'string'
      ? error.includes('429')
      : false;

const canUseGooglePlaces = () => {
  if (!runtimeConfig.googlePlacesEnabled || !getGooglePlacesApiKey()) {
    return false;
  }

  if (Platform.OS !== 'web' && !runtimeConfig.googlePlacesNativeEnabled) {
    return false;
  }

  if (Date.now() < googlePlacesDisabledUntil) {
    return false;
  }

  return googlePlacesSessionRequestCount < runtimeConfig.googlePlacesMaxSessionRequests;
};

const buildProviderCacheKey = ({ hubCode, center, radiusMeters }: LocationSearchOptions) => {
  const normalizedHub = (hubCode || runtimeConfig.defaultAirportCode || 'JFK').toUpperCase();
  const latitude = center ? center.latitude.toFixed(4) : 'airport';
  const longitude = center ? center.longitude.toFixed(4) : 'airport';
  const radius = radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters;

  return `${normalizedHub}:${latitude}:${longitude}:${radius}`;
};

const GOOGLE_PLACE_GROUPS: PlacesSearchGroup[] = [
  {
    key: 'crew-meals',
    types: ['restaurant', 'meal_takeaway', 'cafe', 'bakery'],
    maxResultCount: 18,
  },
  {
    key: 'crew-essentials',
    types: ['pharmacy', 'drugstore', 'grocery_store', 'supermarket', 'convenience_store'],
    maxResultCount: 16,
  },
  {
    key: 'crew-reset',
    types: ['gym', 'lodging', 'bar', 'night_club'],
    maxResultCount: 14,
  },
  {
    key: 'crew-ground',
    types: ['parking', 'bus_station', 'transit_station'],
    maxResultCount: 12,
  },
  {
    key: 'airport-amenities',
    types: ['atm', 'bank', 'book_store', 'clothing_store', 'electronics_store', 'jewelry_store', 'shoe_store', 'shopping_mall', 'gift_shop', 'department_store'],
    maxResultCount: 16,
  },
];



const normalizeText = (value: string | undefined) => (value || '').trim().toLowerCase();

const normalizePlaceKey = (location: CrewLocation) => {
  const lat = location.coordinate.latitude.toFixed(3);
  const lon = location.coordinate.longitude.toFixed(3);
  return `${normalizeText(location.name)}|${normalizeText(location.address)}|${lat}|${lon}`;
};

const inferLocationType = (types: string[] = []): LocationType => {
  if (types.includes('cafe') || types.includes('coffee_shop') || types.includes('bakery')) {
    return LocationType.COFFEE;
  }
  if (types.includes('gym')) return LocationType.GYM;
  if (types.includes('pharmacy') || types.includes('drugstore')) return LocationType.PHARMACY;
  if (
    types.includes('grocery_store') ||
    types.includes('supermarket') ||
    types.includes('convenience_store')
  ) {
    return LocationType.GROCERY;
  }
  if (types.includes('night_club') || types.includes('bar')) return LocationType.NIGHTLIFE;
  if (
    types.includes('parking') ||
    types.includes('bus_station') ||
    types.includes('transit_station')
  ) {
    return LocationType.SAFE_AREA;
  }
  if (types.includes('lodging') || types.includes('airport_lounge')) return LocationType.LOUNGE;
  if (
    types.includes('clothing_store') ||
    types.includes('electronics_store') ||
    types.includes('gift_shop') ||
    types.includes('news_stand') ||
    types.includes('book_store') ||
    types.includes('shopping_mall') ||
    types.includes('department_store')
  ) {
    return LocationType.SHOPPING;
  }
  if (types.includes('atm') || types.includes('bank') || types.includes('currency_exchange')) {
    return LocationType.SERVICE;
  }
  return LocationType.RESTAURANT;
};

const formatDistanceLabel = (meters: number) => {
  if (meters <= 350) return '2 min walk';
  if (meters <= 800) return '6 min walk';
  if (meters <= 1800) return '8 min ride';
  if (meters <= 4000) return '12 min ride';
  if (meters <= 6500) return '16 min ride';
  return '20 min ride';
};

const getCrewTip = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.COFFEE:
      return `Fast caffeine stop before heading back into ${airportCode}.`;
    case LocationType.GYM:
      return 'Useful for longer layovers or reserve sits between check-in windows.';
    case LocationType.SAFE_AREA:
      return 'Best option if you are moving solo late or walking with luggage.';
    case LocationType.GROCERY:
      return 'Helpful for stocking commuter food, snacks, and trip essentials.';
    case LocationType.NIGHTLIFE:
      return 'Best for social layovers rather than quick turnarounds.';
    case LocationType.PHARMACY:
      return 'Good backup for late-night essentials, meds, and recovery supplies.';
    case LocationType.LOUNGE:
      return 'Useful when you need a quieter reset before sign-in or deadhead.';
    default:
      return `Solid crew stop around ${airportCode} for a quick reset or meal window.`;
  }
};

const getRecommendedFor = (type: LocationType) => {
  switch (type) {
    case LocationType.COFFEE:
      return 'Quick report';
    case LocationType.GYM:
      return 'Long layover';
    case LocationType.SAFE_AREA:
      return 'Late arrival';
    case LocationType.GROCERY:
      return 'Commuter stock-up';
    case LocationType.NIGHTLIFE:
      return 'Social layover';
    case LocationType.PHARMACY:
      return 'Essentials run';
    case LocationType.LOUNGE:
      return 'Quiet reset';
    default:
      return 'Crew meal window';
  }
};

const getRouteHint = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.SAFE_AREA:
      return `Use this as a safer hotel-to-terminal path around ${airportCode}.`;
    case LocationType.COFFEE:
      return 'Best stop if you only have a few minutes before report.';
    case LocationType.GROCERY:
      return 'Works well on day-one layovers before hotel settle-in.';
    case LocationType.GYM:
      return 'Best after sign-out rather than right before report time.';
    default:
      return `Easy to work into a normal crew route around ${airportCode}.`;
  }
};

const getAirportRouteZone = (airportCode: string) => {
  switch (airportCode) {
    case 'JFK':
      return 'the T4 hotel shuttle and AirTrain corridor';
    case 'LAX':
      return 'the terminal loop and crew pickup curb';
    case 'MIA':
      return 'the North Terminal and hotel shuttle lane';
    case 'MCO':
      return 'the main terminal and hotel coach loop';
    case 'ORD':
      return 'the terminal connector and crew bus lane';
    case 'DFW':
      return 'the Skylink and hotel van corridor';
    case 'ATL':
      return 'the Plane Train corridor and crew pickup zone';
    default:
      return `the ${airportCode} terminal-to-hotel corridor`;
  }
};

const getCategoryHeadline = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.COFFEE:
      return `Best coffee around ${airportCode}`;
    case LocationType.SAFE_AREA:
      return `Crew-safe pickup near ${airportCode}`;
    case LocationType.PHARMACY:
      return `Late-night pharmacy near ${airportCode}`;
    case LocationType.GROCERY:
      return `Fast stock-up near ${airportCode}`;
    case LocationType.GYM:
      return `Reset gym near ${airportCode}`;
    case LocationType.LOUNGE:
      return `Quiet reset near ${airportCode}`;
    case LocationType.NIGHTLIFE:
      return `Social layover pick near ${airportCode}`;
    case LocationType.RESTAURANT:
    default:
      return `Best meal window near ${airportCode}`;
  }
};

const getCategorySummary = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.COFFEE:
      return `Good when the crew room line is slow and you need a fast caffeine reset before report at ${airportCode}.`;
    case LocationType.SAFE_AREA:
      return `Best option for solo pickup, ride-share meetups, or walking with luggage near ${airportCode}.`;
    case LocationType.PHARMACY:
      return `Reliable for meds, hydration, and recovery essentials when you land late into ${airportCode}.`;
    case LocationType.GROCERY:
      return `Solid grocery stop for commuter snacks and quick room stock-ups around ${airportCode}.`;
    case LocationType.GYM:
      return `Useful for longer sits when you want a workout without drifting too far from ${airportCode}.`;
    case LocationType.LOUNGE:
      return 'Better for quiet recovery and laptop time before the next airport push.';
    case LocationType.NIGHTLIFE:
      return 'Works best on social layovers when your turn time is not tight.';
    case LocationType.RESTAURANT:
    default:
      return 'Strong meal stop when you need something dependable between hotel check-in and report time.';
  }
};

const getBestWindow = (type: LocationType) => {
  switch (type) {
    case LocationType.COFFEE:
      return 'Best window: pre-report 05:00-09:00';
    case LocationType.SAFE_AREA:
      return 'Best window: late arrivals and solo pickups';
    case LocationType.PHARMACY:
      return 'Best window: evening arrivals and recovery runs';
    case LocationType.GROCERY:
      return 'Best window: day-one layover stock-up';
    case LocationType.GYM:
      return 'Best window: post-sign-out reset';
    case LocationType.LOUNGE:
      return 'Best window: quiet reset before sign-in';
    case LocationType.NIGHTLIFE:
      return 'Best window: longer overnights';
    case LocationType.RESTAURANT:
    default:
      return 'Best window: meal break between legs';
  }
};

const getRouteContext = (type: LocationType, airportCode: string) => {
  const zone = getAirportRouteZone(airportCode);

  switch (type) {
    case LocationType.COFFEE:
      return `Easiest add-on from ${zone}.`;
    case LocationType.SAFE_AREA:
      return `Best used as a pickup anchor from ${zone}.`;
    case LocationType.PHARMACY:
      return `Fits best after hotel check-in from ${zone}.`;
    case LocationType.GROCERY:
      return `Best on the first hotel run out of ${zone}.`;
    case LocationType.GYM:
      return `Worth the detour once you are clear of ${zone}.`;
    case LocationType.LOUNGE:
      return `Useful when you want to stay close to ${zone} without the terminal noise.`;
    case LocationType.NIGHTLIFE:
      return `Works better after you are fully clear of ${zone} for the night.`;
    case LocationType.RESTAURANT:
    default:
      return `Easy to work into a normal crew route from ${zone}.`;
  }
};

const getDistanceBandTag = (distanceMeters: number) => {
  if (distanceMeters <= 800) return 'Walkable reset';
  if (distanceMeters <= 2500) return 'Quick airport hop';
  if (distanceMeters <= 5000) return 'Hotel shuttle friendly';
  return 'Longer layover pick';
};

const getCrewTypeTag = (type: LocationType) => {
  switch (type) {
    case LocationType.COFFEE:
      return 'Early report';
    case LocationType.RESTAURANT:
      return 'Meal window';
    case LocationType.GROCERY:
      return 'Commuter stock-up';
    case LocationType.SAFE_AREA:
      return 'Solo-safe';
    case LocationType.PHARMACY:
      return 'Late-night';
    case LocationType.GYM:
      return 'Reset';
    case LocationType.NIGHTLIFE:
      return 'Overnight';
    case LocationType.LOUNGE:
      return 'Quiet reset';
    default:
      return 'Crew stop';
  }
};

const getPilotTip = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.COFFEE:
      return `Pilot tip: quick in-and-out stop before report at ${airportCode}.`;
    case LocationType.RESTAURANT:
      return 'Pilot tip: best when you need something dependable without drifting too far from the airport.';
    case LocationType.SAFE_AREA:
      return 'Pilot tip: easiest anchor for deadhead pickup, crew car drop, or late curb meetups.';
    case LocationType.GROCERY:
      return 'Pilot tip: useful for multi-day commuter stocking before heading to the hotel.';
    case LocationType.GYM:
      return 'Pilot tip: better after sign-out than before a tight van call.';
    case LocationType.PHARMACY:
      return 'Pilot tip: strong backup for meds, hydration, and fatigue recovery supplies.';
    case LocationType.NIGHTLIFE:
      return 'Pilot tip: save this for true overnights, not early report turns.';
    case LocationType.LOUNGE:
      return 'Pilot tip: useful for quiet review time before the next push.';
    default:
      return `Pilot tip: easy crew stop to keep inside your ${airportCode} operating bubble.`;
  }
};

const getFlightAttendantTip = (type: LocationType, airportCode: string) => {
  switch (type) {
    case LocationType.COFFEE:
      return `FA tip: helpful when the crew room line is slow and you need a fast reset at ${airportCode}.`;
    case LocationType.RESTAURANT:
      return 'FA tip: good backup when hotel food options are weak or timing is tight.';
    case LocationType.SAFE_AREA:
      return 'FA tip: strong choice for solo pickups, luggage, and later-night returns.';
    case LocationType.GROCERY:
      return 'FA tip: good for snacks, room essentials, and day-one layover stock-up.';
    case LocationType.GYM:
      return 'FA tip: useful on longer sits when you want a reset without a far detour.';
    case LocationType.PHARMACY:
      return 'FA tip: best for late-night essentials, meds, and recovery runs.';
    case LocationType.NIGHTLIFE:
      return 'FA tip: better for social overnights than short layovers.';
    case LocationType.LOUNGE:
      return 'FA tip: quiet choice for decompressing before sign-in or deadhead.';
    default:
      return `FA tip: reliable ${airportCode} layover pick when you need something nearby and simple.`;
  }
};

const getAirportCoreHeadline = (location: CrewLocation, airportCode: string) => {
  switch (location.airportCoreKind) {
    case 'TERMINAL':
      return `${airportCode} terminal ops anchor`;
    case 'SECURITY':
      return `${airportCode} security flow anchor`;
    case 'GROUND':
      return `${airportCode} ground transport anchor`;
    case 'SHUTTLE':
      return `${airportCode} shuttle pickup anchor`;
    case 'BAGGAGE':
      return `${airportCode} baggage claim anchor`;
    case 'COFFEE':
      return `${airportCode} terminal coffee reset`;
    case 'LOUNGE':
      return `${airportCode} quiet crew reset`;
    default:
      return `${airportCode} airport ops anchor`;
  }
};

const getAirportCoreSummary = (location: CrewLocation, airportCode: string) => {
  switch (location.airportCoreKind) {
    case 'TERMINAL':
      return `Terminal-side marker inside ${airportCode} so the default map opens on a real airport operations reference point.`;
    case 'SECURITY':
      return `Useful checkpoint anchor when you want the terminal map to show the main security flow inside ${airportCode}.`;
    case 'GROUND':
      return `Ground access reference point for pickups, ride-share, and curbside movement inside ${airportCode}.`;
    case 'SHUTTLE':
      return `Hotel and crew shuttle reference point so the airport map includes the main transport handoff zone at ${airportCode}.`;
    case 'BAGGAGE':
      return `Arrival-side baggage claim anchor for crew meetups, luggage, and post-arrival orientation inside ${airportCode}.`;
    case 'COFFEE':
      return `Inside-airport coffee reset marker so the terminal view includes at least one quick, useful crew stop.`;
    case 'LOUNGE':
      return `Quiet terminal reset point for decompressing before you leave the main ${airportCode} airport footprint.`;
    default:
      return `Core airport marker inside the ${airportCode} terminal zone so the first map view feels like a real airport operations layout.`;
  }
};

const getAirportCoreRouteHint = (location: CrewLocation, airportCode: string) => {
  switch (location.airportCoreKind) {
    case 'TERMINAL':
      return `Use this as your main inside-terminal anchor before branching into the outer ${airportCode} map.`;
    case 'SECURITY':
      return `Helpful checkpoint reference before you commit to a side of the ${airportCode} terminal flow.`;
    case 'GROUND':
      return `Use this when navigating out to curbside pickup or back into the airport.`;
    case 'SHUTTLE':
      return `Best transport anchor when moving between terminal exits and the hotel shuttle zone.`;
    case 'BAGGAGE':
      return `Best arrival anchor if you are orienting around claim, luggage, or crew meetup points.`;
    case 'COFFEE':
      return `Fast inside-airport stop before you leave the terminal footprint.`;
    case 'LOUNGE':
      return `Best used when you need a quieter airport-side pause before heading out.`;
    default:
      return `Stay inside the ${airportCode} terminal footprint before branching to outside stops.`;
  }
};

const getAirportCorePilotTip = (location: CrewLocation, airportCode: string) => {
  switch (location.airportCoreKind) {
    case 'SECURITY':
      return `Pilot tip: use this as a fast read on checkpoint flow before committing to the wrong side of ${airportCode}.`;
    case 'GROUND':
    case 'SHUTTLE':
      return `Pilot tip: useful for deadhead pickups, curbside handoffs, and hotel van timing at ${airportCode}.`;
    case 'BAGGAGE':
      return `Pilot tip: use this as an arrival-side meeting point when the operation turns into luggage or pickup logistics.`;
    case 'COFFEE':
      return `Pilot tip: quick terminal-side caffeine reset without drifting out of the airport bubble.`;
    case 'LOUNGE':
      return `Pilot tip: good airport-side pause point for quiet reset or review time.`;
    default:
      return `Pilot tip: use this as a terminal-side anchor before heading out of ${airportCode}.`;
  }
};

const getAirportCoreFlightAttendantTip = (location: CrewLocation, airportCode: string) => {
  switch (location.airportCoreKind) {
    case 'SECURITY':
      return `FA tip: helpful checkpoint reference when you need to orient quickly inside the ${airportCode} terminal flow.`;
    case 'GROUND':
    case 'SHUTTLE':
      return `FA tip: strong airport-side marker for shuttle, pickup, luggage, and solo transport movement at ${airportCode}.`;
    case 'BAGGAGE':
      return `FA tip: useful claim-side anchor for luggage, meetups, and arrival handoff timing.`;
    case 'COFFEE':
      return `FA tip: fast inside-airport reset when you need coffee without leaving the terminal footprint.`;
    case 'LOUNGE':
      return `FA tip: quiet terminal-side reset before pushing into the outer layover map.`;
    default:
      return `FA tip: helpful as a terminal reference point when you are still inside the ${airportCode} flow.`;
  }
};

const getRecommendationScore = (location: CrewLocation) => {
  const typeBoost =
    location.type === LocationType.SAFE_AREA
      ? 18
      : location.type === LocationType.COFFEE
        ? 14
        : location.type === LocationType.GROCERY
          ? 12
          : location.type === LocationType.GYM
            ? 10
            : 8;

  const reviewBoost = Math.min(location.reviewCount, 120) / 10;
  const ratingBoost = location.rating * 3;
  const favoriteBoost = location.isCrewFavorite ? 12 : 0;
  const airportCoreBoost = location.airportCore ? 10 : 0;

  return typeBoost + reviewBoost + ratingBoost + favoriteBoost + airportCoreBoost;
};

const buildCrewTags = (
  location: CrewLocation,
  airportCode: string,
  distanceMeters: number
) => {
  if (location.source === 'places' && !location.airportCore) {
    return Array.from(
      new Set(
        [
          'Google Places',
          getCrewTypeTag(location.type),
          getDistanceBandTag(distanceMeters),
          'Airport area',
        ].filter((value): value is string => Boolean(value))
      )
    ).slice(0, 4);
  }

  return Array.from(
    new Set(
      [
        location.airportCore
          ? 'Airport ops'
          : location.isCrewFavorite
            ? 'Crew favorite'
            : location.source === 'crew'
              ? 'Crew submitted'
              : 'Live nearby',
        getCrewTypeTag(location.type),
        getDistanceBandTag(distanceMeters),
        airportCode ? `${airportCode} radius` : null,
      ].filter((value): value is string => Boolean(value))
    )
  ).slice(0, 4);
};

const offsetCoordinates = (center: Coordinates, northMiles: number, eastMiles: number): Coordinates => ({
  latitude: center.latitude + northMiles / 69,
  longitude: center.longitude + eastMiles / (Math.cos(toRadians(center.latitude)) * 69),
});

const pickPreferredLocation = (left: CrewLocation, right: CrewLocation) => {
  const leftScore =
    (left.source === 'crew'
      ? 12
      : left.source === 'airport'
        ? 9
        : left.source === 'fallback'
          ? 6
          : 0) +
    (left.isCrewFavorite ? 8 : 0) +
    left.reviewCount;
  const rightScore =
    (right.source === 'crew'
      ? 12
      : right.source === 'airport'
        ? 9
        : right.source === 'fallback'
          ? 6
          : 0) +
    (right.isCrewFavorite ? 8 : 0) +
    right.reviewCount;

  const preferred = rightScore > leftScore ? right : left;
  const secondary = rightScore > leftScore ? left : right;

  return {
    ...preferred,
    x: preferred.x !== undefined && preferred.x !== null ? preferred.x : secondary.x,
    y: preferred.y !== undefined && preferred.y !== null ? preferred.y : secondary.y,
    level: preferred.level || secondary.level,
    zone: preferred.zone || secondary.zone,
  };
};

const dedupeLocations = (locations: CrewLocation[]) => {
  const deduped = new Map<string, CrewLocation>();

  locations.forEach((location) => {
    const key = normalizePlaceKey(location);
    const existing = deduped.get(key);
    deduped.set(key, existing ? pickPreferredLocation(existing, location) : location);
  });

  return [...deduped.values()];
};

const transformSupabaseLocation = (row: any): CrewLocation => ({
  id: row.id,
  name: row.name,
  type: row.type as LocationType,
  coordinate: {
    latitude: row.latitude,
    longitude: row.longitude,
  },
  rating: row.rating ?? 0,
  reviewCount: 0,
  isCrewFavorite: row.is_verified,
  address: row.city,
  source: 'crew',
  level: row.level || undefined,
  zone: row.zone || undefined,
});

const transformGooglePlace = (place: GooglePlace): CrewLocation | null => {
  if (!place.location?.latitude || !place.location?.longitude || !place.displayName?.text) {
    return null;
  }

  return {
    id: place.id || place.displayName.text,
    googlePlaceId: place.id,
    name: place.displayName.text,
    type: inferLocationType(place.types),
    coordinate: {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
    },
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    isCrewFavorite: false,
    address: place.formattedAddress || 'Nearby crew spot',
    source: 'places',
    googleMapsUri: place.googleMapsUri,
    websiteUri: place.websiteUri,
    phoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber,
    businessStatus: place.businessStatus,
    priceLevel: place.priceLevel,
    primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
    currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
  };
};



const enrichLocation = (
  location: CrewLocation,
  airportCode: string,
  searchCenter: Coordinates
): CrewLocation => {
  const distanceMeters = distanceInMeters(searchCenter, location.coordinate);
  const isGoogleBusiness = location.source === 'places' && !location.airportCore;
  const typeLabel = getCrewTypeTag(location.type);
  const reviewSummary =
    location.rating > 0
      ? `${location.rating.toFixed(1)} rating${location.reviewCount ? ` from ${location.reviewCount} Google reviews` : ''}.`
      : 'Google Places listing near the selected airport.';

  return {
    ...location,
    airportCode,
    distanceFromHotel: location.distanceFromHotel || formatDistanceLabel(distanceMeters),
    crewTip:
      location.crewTip ||
      (isGoogleBusiness
        ? `${location.name} is a ${typeLabel.toLowerCase()} listing from Google Places. Check route and current details before heading over.`
        : location.airportCore
        ? `Airport-core marker for ${airportCode}. Useful while you are still inside the terminal flow.`
        : getCrewTip(location.type, airportCode)),
    recommendedFor:
      location.recommendedFor ||
      (isGoogleBusiness ? typeLabel : location.airportCore ? 'Inside-airport ops' : getRecommendedFor(location.type)),
    routeHint:
      location.routeHint ||
      (isGoogleBusiness
        ? `Route directly to ${location.name}.`
        : location.airportCore
        ? getAirportCoreRouteHint(location, airportCode)
        : getRouteHint(location.type, airportCode)),
    categoryHeadline:
      location.categoryHeadline ||
      (isGoogleBusiness
        ? location.name
        : location.airportCore
          ? getAirportCoreHeadline(location, airportCode)
          : getCategoryHeadline(location.type, airportCode)),
    categorySummary:
      location.categorySummary ||
      (isGoogleBusiness
        ? `${reviewSummary} Address: ${location.address}`
        : location.airportCore
        ? getAirportCoreSummary(location, airportCode)
        : getCategorySummary(location.type, airportCode)),
    bestWindow: location.bestWindow || (isGoogleBusiness ? 'Verify current hours in Maps' : location.airportCore ? 'Best window: active airport movement' : getBestWindow(location.type)),
    routeContext:
      location.routeContext ||
      (isGoogleBusiness
        ? 'Google business place.'
        : location.airportCore
        ? `Use this as an inside-airport anchor before moving to the outer ${airportCode} radius.`
        : getRouteContext(location.type, airportCode)),
    crewTags: location.crewTags?.length ? location.crewTags : buildCrewTags(location, airportCode, distanceMeters),
    pilotTip:
      location.pilotTip ||
      (location.airportCore
        ? getAirportCorePilotTip(location, airportCode)
        : getPilotTip(location.type, airportCode)),
    flightAttendantTip:
      location.flightAttendantTip ||
      (location.airportCore
        ? getAirportCoreFlightAttendantTip(location, airportCode)
        : getFlightAttendantTip(location.type, airportCode)),
  };
};

const fetchGoogleNearbyPlacesLegacy = async (
  group: PlacesSearchGroup,
  center: Coordinates,
  radiusMeters: number
): Promise<CrewLocation[]> => {
  const apiKey = getGooglePlacesApiKey();
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${center.latitude},${center.longitude}&radius=${radiusMeters}&key=${apiKey}`;
  
  const headers: Record<string, string> = {};
  if (Platform.OS === 'ios') {
    headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Legacy Places API request failed with status: ${response.status}`);
  }

  const payload = await response.json() as {
    results?: Array<{
      place_id: string;
      name: string;
      geometry: {
        location: {
          lat: number;
          lng: number;
        };
      };
      types: string[];
      rating?: number;
      user_ratings_total?: number;
      vicinity?: string;
    }>;
  };

  const results = payload.results || [];
  
  const groupTypesSet = new Set(group.types);
  const filtered = results.filter(item => {
    if (group.types && group.types.length > 0) {
      return item.types.some(t => groupTypesSet.has(t));
    }
    return true;
  });

  return filtered.map(item => {
    const googlePlace: GooglePlace = {
      id: item.place_id,
      displayName: { text: item.name },
      location: { latitude: item.geometry.location.lat, longitude: item.geometry.location.lng },
      types: item.types,
      rating: item.rating,
      userRatingCount: item.user_ratings_total,
      formattedAddress: item.vicinity || 'Nearby crew spot',
      googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
    };
    return transformGooglePlace(googlePlace);
  }).filter((location): location is CrewLocation => Boolean(location));
};

const getGooglePlaceDetailsLegacy = async (
  placeId: string,
  name: string,
  coordinate: Coordinates
): Promise<GooglePlace | null> => {
  const apiKey = getGooglePlacesApiKey();
  const fields = 'place_id,name,geometry,type,rating,user_ratings_total,formatted_address,website,formatted_phone_number,opening_hours,url';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
  
  const headers: Record<string, string> = {};
  if (Platform.OS === 'ios') {
    headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Legacy Place Details API request failed with status: ${response.status}`);
  }

  const payload = await response.json() as {
    result?: {
      place_id: string;
      name: string;
      geometry: {
        location: {
          lat: number;
          lng: number;
        };
      };
      types: string[];
      rating?: number;
      user_ratings_total?: number;
      formatted_address?: string;
      website?: string;
      formatted_phone_number?: string;
      opening_hours?: {
        weekday_text?: string[];
      };
      url?: string;
    };
  };

  const result = payload.result;
  if (!result) return null;

  return {
    id: result.place_id,
    displayName: { text: result.name },
    location: { latitude: result.geometry.location.lat, longitude: result.geometry.location.lng },
    types: result.types,
    rating: result.rating,
    userRatingCount: result.user_ratings_total,
    formattedAddress: result.formatted_address,
    googleMapsUri: result.url,
    websiteUri: result.website,
    nationalPhoneNumber: result.formatted_phone_number,
    currentOpeningHours: result.opening_hours ? {
      weekdayDescriptions: result.opening_hours.weekday_text
    } : undefined
  };
};

const fetchGoogleNearbyPlaces = async (
  group: PlacesSearchGroup,
  center: Coordinates,
  radiusMeters: number
) => {
  googlePlacesSessionRequestCount += 1;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getGooglePlacesApiKey(),
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.googleMapsUri',
    };
    if (Platform.OS === 'ios') {
      headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        includedTypes: group.types,
        maxResultCount: group.maxResultCount,
        locationRestriction: {
          circle: {
            center: {
              latitude: center.latitude,
              longitude: center.longitude,
            },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Places request failed with ${response.status} for ${group.key}`);
    }

    const payload = (await response.json()) as { places?: GooglePlace[] };
    const results = (payload.places || [])
      .map(transformGooglePlace)
      .filter((location): location is CrewLocation => Boolean(location));
    console.log(`[Google Places] Successfully fetched ${results.length} places for group ${group.key}`);
    return results;
  } catch (error) {
    console.warn(`Google Places v1 failed for ${group.key}, falling back to legacy API:`, error);
    try {
      return await fetchGoogleNearbyPlacesLegacy(group, center, radiusMeters);
    } catch (legacyError) {
      console.error(`Legacy Google Places API fallback failed:`, legacyError);
      return [];
    }
  }
};

export const LocationService = {
  async getLocations({
    hubCode,
    center,
    radiusMeters,
    includeProviderPlaces = false,
    bypassCache = false,
  }: LocationSearchOptions): Promise<CrewLocation[]> {
    const searchRadiusMeters = radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters;
    const searchCenter =
      center ||
      getAirportCoordinates(hubCode) ||
      getAirportCoordinates(runtimeConfig.defaultAirportCode) ||
      DEFAULT_CENTER;

    const { data, error } = await supabase.from('locations').select('*');

    if (error) {
      const isMissingLocationsTable =
        typeof error.code === 'string' && MISSING_TABLE_ERROR_CODES.has(error.code);

      if (isMissingLocationsTable) {
        warnLocationFallbackOnce(
          'missing-locations-table',
          'Supabase locations table unavailable, using provider and fallback crew spots:',
          error
        );
      } else {
        warnLocationFallbackOnce(
          `locations-table-${error.code || 'unknown'}`,
          'Location table fetch failed, using provider and fallback crew spots:',
          error
        );
      }
    }

    const normalizedAirportCode = (hubCode || runtimeConfig.defaultAirportCode || 'JFK').toUpperCase();

    const supabaseLocations = (data || [])
      .filter((row: any) => {
        return (
          typeof row.latitude === 'number' &&
          typeof row.longitude === 'number' &&
          distanceInMeters(searchCenter, {
            latitude: row.latitude,
            longitude: row.longitude,
          }) <= searchRadiusMeters
        );
      })
      .map(transformSupabaseLocation)
      .map((location: CrewLocation) => enrichLocation(location, normalizedAirportCode, searchCenter));

    const curatedPlaces = await AirportDirectoryService.getCuratedPlaces(
      normalizedAirportCode,
      searchCenter,
      searchRadiusMeters,
      bypassCache
    );
    const enrichedCuratedPlaces = curatedPlaces.map((location) => 
      enrichLocation(location, normalizedAirportCode, searchCenter)
    );

    const providerLocations: CrewLocation[] = [];
    if (includeProviderPlaces) {
      // 1. Fetch around the main airport center (covers Terminal A/B generally)
      const mainPlaces = await this.getProviderLocations({
        hubCode,
        center: searchCenter,
        radiusMeters: searchRadiusMeters,
      });
      providerLocations.push(...mainPlaces);

      // 2. Fetch around remote terminals (like Terminal C) that are far from the main center
      const remoteTerminals = curatedPlaces.filter(
        (loc) => loc.airportCore && loc.airportCoreKind === 'TERMINAL'
      );

      const uniqueRemoteTerminals: CrewLocation[] = [];
      for (const term of remoteTerminals) {
        const isDuplicate = uniqueRemoteTerminals.some(
          (uniqueTerm) => distanceInMeters(uniqueTerm.coordinate, term.coordinate) < 300
        );
        if (!isDuplicate) {
          uniqueRemoteTerminals.push(term);
        }
      }

      for (const term of uniqueRemoteTerminals) {
        const dist = distanceInMeters(searchCenter, term.coordinate);
        // If a terminal is further than 800m, Nearby Search at center will miss it entirely
        if (dist > 800) {
          const terminalPlaces = await this.getProviderLocations({
            hubCode,
            center: term.coordinate,
            radiusMeters: 600, // Focused radius on the terminal structure
          });
          providerLocations.push(...terminalPlaces);
        }
      }
    }

    const enrichedProviderLocations = providerLocations.map((location) =>
      enrichLocation(location, normalizedAirportCode, searchCenter)
    );

    return dedupeLocations([
      ...supabaseLocations,
      ...enrichedCuratedPlaces,
      ...enrichedProviderLocations,
    ])
      .sort((left, right) => getRecommendationScore(right) - getRecommendationScore(left))
      .slice(0, 120); // Increased slice to 120 so remote terminal spots aren't cut off
  },

  async getProviderLocations(options: LocationSearchOptions): Promise<CrewLocation[]> {
    const cacheKey = buildProviderCacheKey(options);
    const cached = providerLocationCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.locations;
    }

    const providerAttempts: Array<() => Promise<CrewLocation[]>> = [];

    // Prioritize OpenStreetMap for high-accuracy indoor level maps
    providerAttempts.push(() => this.getOSMPlaces(options));

    if (canUseGooglePlaces()) {
      providerAttempts.push(() => this.getGooglePlaces(options));
    }

    if (runtimeConfig.placesEndpoint) {
      providerAttempts.push(() => this.getSharedPlaces(options));
    }

    providerAttempts.push(() => this.getSupabasePlaces(options));

    for (const getProviderResult of providerAttempts) {
      const locations = dedupeLocations(await getProviderResult());

      if (locations.length > 0) {
        providerLocationCache.set(cacheKey, {
          expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
          locations,
        });
        return locations;
      }
    }

    providerLocationCache.set(cacheKey, {
      expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
      locations: [],
    });
    return [];
  },

  async getSupabasePlaces({ hubCode, center, radiusMeters }: LocationSearchOptions): Promise<CrewLocation[]> {
    try {
      const { data, error } = await supabase.functions.invoke('places-nearby', {
        body: {
          hubCode,
          latitude: center?.latitude,
          longitude: center?.longitude,
          radiusMeters: radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters,
        },
      });

      if (error) {
        throw error;
      }

      const payload = (data || {}) as SharedPlacesResponse;
      return (payload.locations || [])
        .map(transformGooglePlace)
        .filter((location): location is CrewLocation => Boolean(location));
    } catch (error) {
      warnLocationFallbackOnce(
        'supabase-places-function',
        'Supabase places function unavailable, falling back:',
        error
      );
      return [];
    }
  },

  async getSharedPlaces({ hubCode, center, radiusMeters }: LocationSearchOptions): Promise<CrewLocation[]> {
    try {
      const url = new URL(runtimeConfig.placesEndpoint);
      url.searchParams.set('hubCode', hubCode || runtimeConfig.defaultAirportCode);
      if (center) {
        url.searchParams.set('latitude', String(center.latitude));
        url.searchParams.set('longitude', String(center.longitude));
      }
      url.searchParams.set(
        'radiusMeters',
        String(radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters)
      );

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Shared places endpoint failed with ${response.status}`);
      }

      const payload = (await response.json()) as SharedPlacesResponse;
      return (payload.locations || [])
        .map(transformGooglePlace)
        .filter((location): location is CrewLocation => Boolean(location));
    } catch (error) {
      warnLocationFallbackOnce('shared-places-endpoint', 'Shared places endpoint unavailable, falling back locally:', error);
      return [];
    }
  },

  async getGooglePlaces({ hubCode, center, radiusMeters }: LocationSearchOptions): Promise<CrewLocation[]> {
    if (!canUseGooglePlaces()) {
      return [];
    }

    const searchCenter =
      center ||
      getAirportCoordinates(hubCode) ||
      getAirportCoordinates(runtimeConfig.defaultAirportCode) ||
      DEFAULT_CENTER;
    const searchRadiusMeters = radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters;

    const results: CrewLocation[] = [];

    // Run Google Places queries in parallel for high speed!
    const promises = GOOGLE_PLACE_GROUPS.map(async (group) => {
      if (!canUseGooglePlaces()) {
        return [];
      }

      try {
        return await fetchGoogleNearbyPlaces(group, searchCenter, searchRadiusMeters);
      } catch (error) {
        if (isRateLimitedError(error)) {
          googlePlacesDisabledUntil = Date.now() + 5 * 60 * 1000;
        }

        warnLocationFallbackOnce(
          `google-places-${group.key}`,
          `Google Places group ${group.key} unavailable:`,
          error
        );
        return [];
      }
    });

    const groupResults = await Promise.all(promises);
    for (const res of groupResults) {
      results.push(...res);
    }

    return dedupeLocations(results);
  },

  async getGooglePlaceDetails({
    airportCode,
    placeId,
    name,
    coordinate,
  }: {
    airportCode: string;
    placeId: string;
    name: string;
    coordinate: Coordinates;
  }): Promise<CrewLocation | null> {
    if (!canUseGooglePlaces()) {
      return enrichLocation(
        {
          id: placeId || name,
          googlePlaceId: placeId,
          name,
          type: LocationType.RESTAURANT,
          coordinate,
          rating: 0,
          reviewCount: 0,
          isCrewFavorite: false,
          address: `${airportCode} nearby`,
          source: 'places',
        },
        airportCode,
        coordinate
      );
    }

    try {
      googlePlacesSessionRequestCount += 1;
      const fieldMask = runtimeConfig.googlePlacesRichDetailsEnabled
        ? 'id,displayName,primaryTypeDisplayName,formattedAddress,location,rating,userRatingCount,types,businessStatus,googleMapsUri,websiteUri,nationalPhoneNumber,internationalPhoneNumber,priceLevel,currentOpeningHours'
        : 'id,displayName,primaryTypeDisplayName,formattedAddress,location,types,businessStatus,googleMapsUri';
      const headers: Record<string, string> = {
        'X-Goog-Api-Key': getGooglePlacesApiKey(),
        'X-Goog-FieldMask': fieldMask,
      };
      if (Platform.OS === 'ios') {
        headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
      }

      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Google Place details failed with ${response.status}`);
      }

      const place = (await response.json()) as GooglePlace;
      const transformed =
        transformGooglePlace(place) ||
        ({
          id: placeId,
          googlePlaceId: placeId,
          name,
          type: inferLocationType(place.types),
          coordinate,
          rating: place.rating ?? 0,
          reviewCount: place.userRatingCount ?? 0,
          isCrewFavorite: false,
          address: place.formattedAddress || `${airportCode} nearby`,
          source: 'places' as const,
          googleMapsUri: place.googleMapsUri,
          websiteUri: place.websiteUri,
          phoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber,
          businessStatus: place.businessStatus,
          priceLevel: place.priceLevel,
          primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
          currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
        } satisfies CrewLocation);

      return enrichLocation(transformed, airportCode, coordinate);
    } catch (error) {
      console.warn('Google Places v1 details failed, trying legacy:', error);
      try {
        const place = await getGooglePlaceDetailsLegacy(placeId, name, coordinate);
        if (place) {
          const transformed = transformGooglePlace(place);
          if (transformed) {
            return enrichLocation(transformed, airportCode, coordinate);
          }
        }
      } catch (legacyError) {
        console.error('Legacy Google Place details also failed:', legacyError);
      }

      return enrichLocation(
        {
          id: placeId || name,
          googlePlaceId: placeId,
          name,
          type: LocationType.RESTAURANT,
          coordinate,
          rating: 0,
          reviewCount: 0,
          isCrewFavorite: false,
          address: `${airportCode} nearby`,
          source: 'places',
        },
        airportCode,
        coordinate
      );
    }
  },

  async getGooglePlaceFromMapTap({
    airportCode,
    coordinate,
  }: {
    airportCode: string;
    coordinate: Coordinates;
  }): Promise<CrewLocation | null> {
    if (!canUseGooglePlaces()) {
      return null;
    }

    try {
      const nearbyGroups = GOOGLE_PLACE_GROUPS.map((group) => ({
        ...group,
        maxResultCount: Math.min(group.maxResultCount, 8),
      }));
      const results = await Promise.all(
        nearbyGroups.map((group) => fetchGoogleNearbyPlaces(group, coordinate, 85).catch(() => []))
      );
      const nearest = dedupeLocations(results.flat())
        .map((location) => ({
          location,
          distanceMeters: distanceInMeters(coordinate, location.coordinate),
        }))
        .filter((item) => item.distanceMeters <= 110)
        .sort((left, right) => left.distanceMeters - right.distanceMeters)[0]?.location;

      return nearest ? enrichLocation(nearest, airportCode, coordinate) : null;
    } catch (error) {
      if (isRateLimitedError(error)) {
        googlePlacesDisabledUntil = Date.now() + 5 * 60 * 1000;
      }

      warnLocationFallbackOnce('google-map-tap-place', 'Google Places map tap lookup unavailable:', error);
      return null;
    }
  },

  async searchGooglePlaces({
    query,
    center,
    radiusMeters,
  }: {
    query: string;
    center: Coordinates;
    radiusMeters?: number;
  }): Promise<CrewLocation[]> {
    const searchRadiusMeters = radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters;
    const apiKey = getGooglePlacesApiKey();

    googlePlacesSessionRequestCount += 1;

    // 1. Fetch from OSM
    const osmResultsPromise = this.getOSMPlaces({ center, radiusMeters: searchRadiusMeters }).then(places =>
      places.filter(place => {
        const name = (place.name || '').toLowerCase();
        const address = (place.address || '').toLowerCase();
        const tags = (place.tags || []).join(' ').toLowerCase();
        const q = query.toLowerCase();
        return name.includes(q) || address.includes(q) || tags.includes(q);
      })
    );

    // 2. Fetch from Google Places
    let googleResults: CrewLocation[] = [];
    if (canUseGooglePlaces() && query.trim()) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.googleMapsUri',
        };
        if (Platform.OS === 'ios') {
          headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
        }

        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            textQuery: query,
            locationBias: {
              circle: {
                center: {
                  latitude: center.latitude,
                  longitude: center.longitude,
                },
                radius: searchRadiusMeters,
              },
            },
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { places?: GooglePlace[] };
          googleResults = (payload.places || [])
            .map(transformGooglePlace)
            .filter((location): location is CrewLocation => Boolean(location));
        }
      } catch (error) {
        console.warn(`Google Places search v1 failed for "${query}", falling back to legacy:`, error);
        try {
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
            query
          )}&location=${center.latitude},${center.longitude}&radius=${searchRadiusMeters}&key=${apiKey}`;

          const legacyHeaders: Record<string, string> = {};
          if (Platform.OS === 'ios') {
            legacyHeaders['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
          }

          const response = await fetch(url, { headers: legacyHeaders });
          if (response.ok) {
            const payload = (await response.json()) as {
              results?: Array<{
                place_id: string;
                name: string;
                geometry: {
                  location: {
                    lat: number;
                    lng: number;
                  };
                };
                types: string[];
                rating?: number;
                user_ratings_total?: number;
                formatted_address?: string;
              }>;
            };

            googleResults = (payload.results || []).map((item) => {
              const googlePlace: GooglePlace = {
                id: item.place_id,
                displayName: { text: item.name },
                location: { latitude: item.geometry.location.lat, longitude: item.geometry.location.lng },
                types: item.types,
                rating: item.rating,
                userRatingCount: item.user_ratings_total,
                formattedAddress: item.formatted_address || 'Nearby crew spot',
                googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${item.place_id}`,
              };
              return transformGooglePlace(googlePlace);
            }).filter((location): location is CrewLocation => Boolean(location));
          }
        } catch (legacyError) {
          console.error('Legacy Google Places text search fallback failed:', legacyError);
        }
      }
    }

    const osmResults = await osmResultsPromise;
    return dedupeLocations([...osmResults, ...googleResults]);
  },

  async getOSMPlaces({ hubCode, center, radiusMeters }: LocationSearchOptions): Promise<CrewLocation[]> {
    const lat = center?.latitude ?? DEFAULT_CENTER.latitude;
    const lon = center?.longitude ?? DEFAULT_CENTER.longitude;
    const radiusM = radiusMeters ?? runtimeConfig.googlePlacesRadiusMeters;
    const delta = radiusM / 111000;

    const latMin = lat - delta;
    const latMax = lat + delta;
    const lonMin = lon - delta / Math.cos(toRadians(lat));
    const lonMax = lon + delta / Math.cos(toRadians(lat));

    try {
      const overpassUrl = 'https://overpass-api.de/api/interpreter';
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"restaurant|cafe|fast_food|bar|pub|bank|atm|car_rental|charging_station"](${latMin},${lonMin},${latMax},${lonMax});
          way["amenity"~"restaurant|cafe|fast_food|bar|pub|bank|atm|car_rental|charging_station"](${latMin},${lonMin},${latMax},${lonMax});
          node["tourism"~"hotel|motel|guest_house"](${latMin},${lonMin},${latMax},${lonMax});
          way["tourism"~"hotel|motel|guest_house"](${latMin},${lonMin},${latMax},${lonMax});
          node["shop"](${latMin},${lonMin},${latMax},${lonMax});
          way["shop"](${latMin},${lonMin},${latMax},${lonMax});
          node["leisure"~"fitness_centre|sports_centre"](${latMin},${lonMin},${latMax},${lonMax});
        );
        out body center;
      `;

      const response = await fetch(overpassUrl, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`OSM HTTP error: ${response.status}`);
      }

      const rawJson = await response.json();
      const elements = rawJson.elements || [];

      const normalizedAirportCode = (hubCode || runtimeConfig.defaultAirportCode || 'JFK').toUpperCase();

      return elements
        .map((el: any) => {
          const tags = el.tags || {};
          const elLat = el.lat !== undefined ? el.lat : (el.center ? el.center.lat : null);
          const elLon = el.lon !== undefined ? el.lon : (el.center ? el.center.lon : null);

          if (elLat === null || elLon === null) return null;

          let name = tags.name || tags.operator || tags.brand;
          if (!name) {
            if (tags.amenity === 'atm') name = 'Airport ATM';
            else if (tags.amenity === 'charging_station') name = 'Charging Station';
            else if (tags.amenity === 'car_rental') name = `${tags.operator || 'Airport'} Car Rental`;
            else if (tags.tourism === 'hotel') name = 'Airport Hotel';
            else if (tags.shop) name = `${tags.shop.charAt(0).toUpperCase() + tags.shop.slice(1)} Shop`;
            else name = 'Airport Directory Location';
          }

          let type = LocationType.RESTAURANT;
          if (tags.amenity === 'cafe') type = LocationType.COFFEE;
          else if (tags.leisure === 'fitness_centre' || tags.leisure === 'sports_centre') type = LocationType.GYM;
          else if (tags.amenity === 'bank' || tags.amenity === 'atm' || tags.amenity === 'charging_station') type = LocationType.SERVICE;
          else if (tags.shop) type = LocationType.SHOPPING;
          else if (tags.tourism === 'hotel') type = LocationType.LOUNGE;
          else if (tags.amenity === 'bar' || tags.amenity === 'pub') type = LocationType.NIGHTLIFE;

          // Parse floor level
          let levelStr = '1';
          if (tags.level !== undefined && tags.level !== null) {
            const levelVal = String(tags.level).trim();
            if (levelVal === '0') levelStr = '1';
            else if (levelVal === '1') levelStr = '2';
            else if (levelVal === '2') levelStr = '3';
            else if (levelVal === '3') levelStr = '4';
            else levelStr = levelVal;
          } else {
            const lowerName = name.toLowerCase();
            const lowerAddr = (tags.address || '').toLowerCase();
            if (lowerName.includes('departures') || lowerName.includes('depart') || lowerAddr.includes('depart')) {
              levelStr = '3';
            } else if (lowerName.includes('arrivals') || lowerName.includes('baggage') || lowerAddr.includes('arrival')) {
              levelStr = '2';
            } else if (lowerName.includes('ground') || lowerName.includes('shuttle') || lowerName.includes('car rental')) {
              levelStr = '1';
            } else if (lowerName.includes('tunnel') || lowerName.includes('train')) {
              levelStr = 'B';
            }
          }

          let zoneStr = 'ALL';
          const lowerName = name.toLowerCase();
          const lowerAddr = (tags.address || tags['addr:terminal'] || '').toLowerCase();
          if (lowerName.includes('terminal 1') || lowerAddr.includes('t1') || lowerAddr.includes('terminal 1')) zoneStr = 'T1';
          else if (lowerName.includes('terminal 4') || lowerAddr.includes('t4') || lowerAddr.includes('terminal 4')) zoneStr = 'T4';
          else if (lowerName.includes('terminal 5') || lowerAddr.includes('t5') || lowerAddr.includes('terminal 5')) zoneStr = 'T5';
          else if (lowerName.includes('terminal 7') || lowerAddr.includes('t7') || lowerAddr.includes('terminal 7')) zoneStr = 'T7';
          else if (lowerName.includes('terminal 8') || lowerAddr.includes('t8') || lowerAddr.includes('terminal 8')) zoneStr = 'T8';
          else if (lowerName.includes('federal circle') || lowerAddr.includes('federal circle')) zoneStr = 'FED_CIRCLE';
          else if (lowerName.includes('twa') || lowerAddr.includes('twa')) zoneStr = 'TWA';
          else if (normalizedAirportCode === 'MCO') {
            if (lowerName.includes('terminal c') || lowerAddr.includes('terminal c')) zoneStr = 'MAIN_C';
            else if (lowerName.includes('airside 1') || lowerAddr.includes('airside 1')) zoneStr = 'AS1';
            else if (lowerName.includes('airside 2') || lowerAddr.includes('airside 2')) zoneStr = 'AS2';
            else if (lowerName.includes('airside 3') || lowerAddr.includes('airside 3')) zoneStr = 'AS3';
            else if (lowerName.includes('airside 4') || lowerAddr.includes('airside 4')) zoneStr = 'AS4';
            else if (lowerName.includes('train') || lowerAddr.includes('train')) zoneStr = 'TRAIN';
            else zoneStr = 'MAIN_AB';
          }

          return {
            id: `osm-${el.id}`,
            name,
            type,
            coordinate: {
              latitude: elLat,
              longitude: elLon,
            },
            rating: tags.rating ? parseFloat(tags.rating) : 4.0 + (el.id % 10) * 0.1,
            reviewCount: tags.review_count ? parseInt(tags.review_count) : 10 + (el.id % 30),
            isCrewFavorite: false,
            address: tags.address || tags['addr:full'] || (tags['addr:terminal'] ? `Terminal ${tags['addr:terminal']}` : 'Airport Terminal'),
            source: 'places',
            level: levelStr,
            zone: zoneStr,
            tags: [
              ...(tags.cuisine ? tags.cuisine.toLowerCase().split(';') : []),
              ...(tags.brand ? [tags.brand.toLowerCase()] : []),
              ...(tags.operator ? [tags.operator.toLowerCase()] : []),
              ...(tags.shop ? [tags.shop.toLowerCase()] : []),
              ...(tags.amenity ? [tags.amenity.toLowerCase()] : []),
            ],
          };
        })
        .filter((loc: any): loc is CrewLocation => loc !== null);
    } catch (err) {
      console.warn('Overpass API failed in LocationService:', err);
      return [];
    }
  },

  async addCustomLocation({
    name,
    type,
    coordinate,
    address,
    level,
    zone,
  }: {
    name: string;
    type: LocationType;
    coordinate: Coordinates;
    address: string;
    level?: string;
    zone?: string;
  }): Promise<CrewLocation> {
    await CrewAccessService.requireVerifiedCrew();

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name,
        type,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        city: address || '',
        level: level || null,
        zone: zone || null,
        is_verified: false,
        rating: 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformSupabaseLocation(data);
  },
};
