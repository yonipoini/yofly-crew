import { runtimeConfig } from '../config/runtime';
import { AirportSearchService } from '../services/AirportSearchService';
import type { ProfileState } from '../context/ProfileContext';

const normalizeCode = (value?: string) => (value || '').trim().toUpperCase();

const getDefaultAirportCode = () => normalizeCode(runtimeConfig.defaultAirportCode) || 'JFK';

export const getActiveOpsAirportCode = (
  profile?: Pick<ProfileState, 'baseAirport' | 'preferences'>
) => {
  const fallbackAirport = normalizeCode(profile?.baseAirport) || getDefaultAirportCode();
  const preferences = profile?.preferences;

  if (!preferences) {
    return fallbackAirport;
  }

  if (preferences.opsContextMode === 'LAYOVER' && preferences.layoverAirport) {
    return normalizeCode(preferences.layoverAirport) || fallbackAirport;
  }

  if (preferences.opsContextMode === 'TRIP' && preferences.tripAirport) {
    return normalizeCode(preferences.tripAirport) || fallbackAirport;
  }

  if (preferences.opsContextMode === 'MANUAL' && preferences.activeOpsAirport) {
    return normalizeCode(preferences.activeOpsAirport) || fallbackAirport;
  }

  return fallbackAirport;
};

export const getAirportOption = (airportCode?: string) => {
  const normalizedCode = normalizeCode(airportCode) || getDefaultAirportCode();
  return AirportSearchService.getAirportByCode(normalizedCode);
};

export const getAirportDisplayName = (airportCode?: string) => {
  const normalizedCode = normalizeCode(airportCode) || getDefaultAirportCode();
  return getAirportOption(normalizedCode)?.name || `${normalizedCode} Airport`;
};

export const getAirportCoordinates = (airportCode?: string) => {
  const code = (airportCode || '').trim().toUpperCase();

  // Precise coordinates centered on passenger terminal buildings
  if (code === 'MCO') return { latitude: 28.4316, longitude: -81.3081 };
  if (code === 'JFK') return { latitude: 40.6438, longitude: -73.7820 };
  if (code === 'LAX') return { latitude: 33.9416, longitude: -118.4085 };
  if (code === 'MIA') return { latitude: 25.7959, longitude: -80.2870 };
  if (code === 'ORD') return { latitude: 41.9742, longitude: -87.9073 };
  if (code === 'DFW') return { latitude: 32.8998, longitude: -97.0403 };
  if (code === 'ATL') return { latitude: 33.6407, longitude: -84.4277 };

  const airport = getAirportOption(airportCode);

  if (!airport) {
    return null;
  }

  return {
    latitude: airport.latitude,
    longitude: airport.longitude,
  };
};
