type RawAirport = {
  iata?: string;
  lat?: string;
  lon?: string;
  iso?: string;
  status?: number;
  type?: string;
  size?: string | null;
  name?: string;
};

export type AirportOption = {
  code: string;
  name: string;
  size: string | null;
  latitude: number;
  longitude: number;
};

const rawAirports = require('airports') as RawAirport[];

const US_AIRPORTS: AirportOption[] = rawAirports
  .filter((airport) => {
    return (
      airport.iso === 'US' &&
      airport.status === 1 &&
      airport.type === 'airport' &&
      typeof airport.iata === 'string' &&
      /^[A-Z]{3}$/.test(airport.iata) &&
      typeof airport.name === 'string'
    );
  })
  .map((airport) => ({
    code: airport.iata as string,
    name: airport.name as string,
    size: airport.size ?? null,
    latitude: Number(airport.lat),
    longitude: Number(airport.lon),
  }))
  .sort((a, b) => {
    const aLarge = a.size === 'large' ? 0 : a.size === 'medium' ? 1 : 2;
    const bLarge = b.size === 'large' ? 0 : b.size === 'medium' ? 1 : 2;

    if (aLarge !== bLarge) {
      return aLarge - bLarge;
    }

    return a.code.localeCompare(b.code);
  });

const normalize = (value: string) => value.trim().toLowerCase();

const getMatchScore = (airport: AirportOption, query: string) => {
  const normalizedQuery = normalize(query);
  const code = airport.code.toLowerCase();
  const name = airport.name.toLowerCase();

  if (code === normalizedQuery) return 0;
  if (code.startsWith(normalizedQuery)) return 1;
  if (name.startsWith(normalizedQuery)) return 2;
  if (name.includes(normalizedQuery)) return 3;
  return 10;
};

export const AirportSearchService = {
  searchUsAirports(query: string, limit = 8): AirportOption[] {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return US_AIRPORTS.slice(0, limit);
    }

    return US_AIRPORTS
      .filter((airport) => {
        const code = airport.code.toLowerCase();
        const name = airport.name.toLowerCase();
        return code.includes(normalizedQuery) || name.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const scoreDiff = getMatchScore(a, normalizedQuery) - getMatchScore(b, normalizedQuery);
        if (scoreDiff !== 0) return scoreDiff;
        return a.code.localeCompare(b.code);
      })
      .slice(0, limit);
  },

  resolveUsAirport(query: string): AirportOption | null {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return null;

    return (
      US_AIRPORTS.find((airport) => airport.code.toLowerCase() === normalizedQuery) ||
      US_AIRPORTS.find((airport) => airport.name.toLowerCase() === normalizedQuery) ||
      null
    );
  },

  resolveUsAirportInput(query: string): AirportOption | null {
    return this.resolveUsAirport(query) || this.searchUsAirports(query, 1)[0] || null;
  },

  getAirportByCode(code: string): AirportOption | null {
    return this.resolveUsAirport(code);
  },

  getDistanceMiles(
    pointA: { latitude: number; longitude: number },
    pointB: { latitude: number; longitude: number }
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;
    const deltaLat = toRad(pointB.latitude - pointA.latitude);
    const deltaLon = toRad(pointB.longitude - pointA.longitude);
    const lat1 = toRad(pointA.latitude);
    const lat2 = toRad(pointB.latitude);
    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return earthRadiusMiles * arc;
  },

  findNearestAirport(
    coords: { latitude: number; longitude: number },
    maxDistanceMiles = 50
  ): { airport: AirportOption; distanceMiles: number } | null {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      return null;
    }

    let closest: { airport: AirportOption; distanceMiles: number } | null = null;

    for (const airport of US_AIRPORTS) {
      if (typeof airport.latitude !== 'number' || typeof airport.longitude !== 'number') continue;
      const distance = this.getDistanceMiles(coords, {
        latitude: airport.latitude,
        longitude: airport.longitude,
      });

      if (!closest || distance < closest.distanceMiles) {
        closest = { airport, distanceMiles: distance };
      }
    }

    if (closest && (maxDistanceMiles <= 0 || closest.distanceMiles <= maxDistanceMiles)) {
      return closest;
    }
    return null;
  },
};
