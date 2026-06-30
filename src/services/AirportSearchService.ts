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
};
