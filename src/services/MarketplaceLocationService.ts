import { runtimeConfig } from '../config/runtime';
import { AirportOption, AirportSearchService } from './AirportSearchService';
import { Platform } from 'react-native';

export type MarketplaceCoordinate = {
  latitude: number;
  longitude: number;
};

export type MarketplaceGeocodeResult = {
  coordinate: MarketplaceCoordinate;
  label: string;
  source: 'google' | 'fallback';
  message?: string;
};

const getAirport = (airportCode: string) =>
  AirportSearchService.getAirportByCode(airportCode) || AirportSearchService.getAirportByCode('JFK');

let googleGeocodingSessionRequestCount = 0;

const canUseGoogleGeocoding = () =>
  runtimeConfig.googleGeocodingEnabled &&
  Boolean(runtimeConfig.googleMapsApiKey) &&
  googleGeocodingSessionRequestCount < runtimeConfig.googleGeocodingMaxSessionRequests;

const hashText = (value: string) =>
  value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

const buildFallbackCoordinate = (query: string, airport: AirportOption): MarketplaceCoordinate => {
  const hash = hashText(query || airport.code);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.018 + (hash % 18) / 1000;

  return {
    latitude: airport.latitude + Math.sin(angle) * radius,
    longitude: airport.longitude + Math.cos(angle) * radius,
  };
};

const buildAreaLabel = (address: string, airportCode: string) => {
  const [firstPart] = address.split(',');
  const label = firstPart?.trim();
  return label ? `${label} area` : `${airportCode.toUpperCase()} pickup area`;
};

const normalizeAddress = (address: string, airportCode: string, airport?: AirportOption | null) =>
  [address.trim(), airportCode.toUpperCase(), airport?.name].filter(Boolean).join(', ');

export const MarketplaceLocationService = {
  getAirportCenter(airportCode: string): MarketplaceCoordinate {
    const airport = getAirport(airportCode);

    return {
      latitude: airport?.latitude || 40.6413,
      longitude: airport?.longitude || -73.7781,
    };
  },

  async geocodeAddress(address: string, airportCode: string): Promise<MarketplaceGeocodeResult> {
    const trimmedAddress = address.trim();
    const airport = getAirport(airportCode);

    if (!trimmedAddress || !airport) {
      return {
        coordinate: this.getAirportCenter(airportCode),
        label: `${airportCode.toUpperCase()} pickup area`,
        source: 'fallback',
        message: 'Add an address, cross street, or neighborhood to place the pin.',
      };
    }

    if (canUseGoogleGeocoding()) {
      try {
        googleGeocodingSessionRequestCount += 1;
        const params = new URLSearchParams({
          address: normalizeAddress(trimmedAddress, airportCode, airport),
          key: runtimeConfig.googleMapsApiKey,
        });
        const headers: Record<string, string> = {};
        if (Platform.OS === 'ios') {
          headers['X-Ios-Bundle-Identifier'] = 'com.yoflycrew.app';
        }
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, { headers });

        if (response.ok) {
          const payload = (await response.json()) as {
            status?: string;
            error_message?: string;
            results?: Array<{
              formatted_address?: string;
              geometry?: { location?: { lat?: number; lng?: number } };
            }>;
          };
          const match = payload.results?.[0];
          const location = match?.geometry?.location;

          if (typeof location?.lat === 'number' && typeof location?.lng === 'number') {
            return {
              coordinate: {
                latitude: location.lat,
                longitude: location.lng,
              },
              label: match?.formatted_address?.split(',').slice(0, 2).join(', ') || buildAreaLabel(trimmedAddress, airportCode),
              source: 'google',
            };
          }

          if (payload.status && payload.status !== 'OK') {
            console.warn('Address geocoding did not return a usable match:', payload.status, payload.error_message);
          }
        }
      } catch (error) {
        console.warn('Address geocoding unavailable, using airport-area fallback:', error);
      }
    }

    return {
      coordinate: buildFallbackCoordinate(trimmedAddress, airport),
      label: buildAreaLabel(trimmedAddress, airportCode),
      source: 'fallback',
      message: 'Address verification is off. We placed an approximate airport-area pin; drag it near the public pickup area.',
    };
  },
};
