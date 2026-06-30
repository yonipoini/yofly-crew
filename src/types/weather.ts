export interface AviationWeather {
  icao: string;
  airportName: string;
  observedAt: string;
  temperatureF: number | null;
  conditionLabel: string;
  iconName: string;
  wind: string;
  visibility: string;
  altimeter: string;
  flightCategory: string;
  rawReport?: string;
  source: 'official' | 'fallback';
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: 'normal' | 'watch' | 'critical';
  area: string;
  effective?: string;
  expires?: string;
  description?: string;
}
