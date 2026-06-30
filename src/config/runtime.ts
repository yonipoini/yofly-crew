const normalize = (value: string | undefined) => value?.trim() ?? '';
const normalizeFlag = (value: string | undefined) => ['1', 'true', 'yes', 'on'].includes(normalize(value).toLowerCase());
const normalizePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(normalize(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const runtimeConfig = {
  defaultAirportCode: normalize(process.env.EXPO_PUBLIC_DEFAULT_AIRPORT_CODE) || 'JFK',
  defaultAirportIcao: normalize(process.env.EXPO_PUBLIC_DEFAULT_AIRPORT_ICAO) || 'KJFK',
  googleMapsApiKey: normalize(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
  googleMapsIosApiKey: normalize(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY),
  googlePlacesEnabled: normalizeFlag(process.env.EXPO_PUBLIC_GOOGLE_PLACES_ENABLED),
  googlePlacesNativeEnabled: normalizeFlag(process.env.EXPO_PUBLIC_GOOGLE_PLACES_NATIVE_ENABLED),
  googlePlacesRichDetailsEnabled: normalizeFlag(process.env.EXPO_PUBLIC_GOOGLE_PLACES_RICH_DETAILS_ENABLED),
  googlePlacesMaxSessionRequests: normalizePositiveNumber(
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_MAX_SESSION_REQUESTS,
    5
  ),
  googlePlacesRadiusMeters: normalizePositiveNumber(process.env.EXPO_PUBLIC_GOOGLE_PLACES_RADIUS_METERS, 8000),
  googleGeocodingEnabled: normalizeFlag(process.env.EXPO_PUBLIC_GOOGLE_GEOCODING_ENABLED),
  googleGeocodingMaxSessionRequests: normalizePositiveNumber(
    process.env.EXPO_PUBLIC_GOOGLE_GEOCODING_MAX_SESSION_REQUESTS,
    3
  ),
  placesEndpoint: normalize(process.env.EXPO_PUBLIC_PLACES_ENDPOINT),
  airportStatusEndpoint: normalize(process.env.EXPO_PUBLIC_AIRPORT_STATUS_ENDPOINT),
  flightStatusEndpoint: normalize(process.env.EXPO_PUBLIC_FLIGHT_STATUS_ENDPOINT),
  tsaEstimateEndpoint: normalize(process.env.EXPO_PUBLIC_TSA_ESTIMATE_ENDPOINT),
};
