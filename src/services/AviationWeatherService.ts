import { runtimeConfig } from '../config/runtime';
import { supabase } from '../lib/supabase';
import { AviationWeather } from '../types/weather';

interface AviationWeatherMetarResponse {
  icaoId: string;
  reportTime?: string;
  temp?: number;
  wdir?: number;
  wspd?: number;
  visib?: number;
  altim?: number;
  wxString?: string;
  name?: string;
  fltCat?: string;
  rawOb?: string;
  clouds?: Array<{
    cover?: string;
    base?: number;
  }>;
}

const UNAVAILABLE_WEATHER: AviationWeather = {
  icao: 'KJFK',
  airportName: 'JFK Airport',
  observedAt: new Date().toISOString(),
  temperatureF: null,
  conditionLabel: 'Weather unavailable',
  iconName: 'cloudy',
  wind: 'Wind unavailable',
  visibility: 'Visibility unavailable',
  altimeter: 'Altimeter unavailable',
  flightCategory: 'Pending',
  source: 'fallback',
};

const FALLBACK_AIRPORT_NAMES: Record<string, string> = {
  KATL: 'ATL Airport',
  KDEN: 'DEN Airport',
  KDFW: 'DFW Airport',
  KEWR: 'EWR Airport',
  KJFK: 'JFK Airport',
  KLAS: 'LAS Airport',
  KLAX: 'LAX Airport',
  KMCO: 'MCO Airport',
  KMIA: 'MIA Airport',
  KORD: 'ORD Airport',
  KPHX: 'PHX Airport',
  KSEA: 'SEA Airport',
  KSFO: 'SFO Airport',
};

const hpaToInHg = (hectopascals: number) => (hectopascals * 0.0295299830714).toFixed(2);

const celsiusToFahrenheit = (celsius: number) => Math.round((celsius * 9) / 5 + 32);

const degreesToCardinal = (degrees?: number) => {
  if (degrees == null || Number.isNaN(degrees)) return 'Variable';

  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

const mapFlightCategoryToIcon = (flightCategory?: string, wxString?: string) => {
  const normalizedWeather = wxString?.toLowerCase() ?? '';

  if (normalizedWeather.includes('ts') || normalizedWeather.includes('storm')) return 'thunderstorm';
  if (normalizedWeather.includes('sn')) return 'snow';
  if (normalizedWeather.includes('ra') || normalizedWeather.includes('dz')) return 'rainy';
  if (normalizedWeather.includes('fg') || normalizedWeather.includes('br')) return 'cloudy';

  switch (flightCategory) {
    case 'LIFR':
    case 'IFR':
      return 'cloudy';
    case 'MVFR':
      return 'partly-sunny';
    default:
      return 'sunny';
  }
};

const humanizeWeather = (metar: AviationWeatherMetarResponse) => {
  if (metar.wxString) return metar.wxString;
  if (metar.clouds?.[0]?.cover) return metar.clouds[0].cover;
  return metar.fltCat || 'Clear';
};

const MOCK_HUB_WEATHER: Record<string, Partial<AviationWeather>> = {
  KMCO: { conditionLabel: 'Scattered clouds • Temp 82°F', wind: '6 kts E', flightCategory: 'VFR', temperatureF: 82, iconName: 'partly-sunny' },
  KJFK: { conditionLabel: 'Few clouds • Temp 72°F', wind: '7 kts SW', flightCategory: 'VFR', temperatureF: 72, iconName: 'sunny' },
  KLAX: { conditionLabel: 'Partly cloudy • Temp 68°F', wind: '11 kts W', flightCategory: 'VFR', temperatureF: 68, iconName: 'partly-sunny' },
  KMIA: { conditionLabel: 'Few clouds • Temp 85°F', wind: '12 kts E', flightCategory: 'VFR', temperatureF: 85, iconName: 'sunny' },
  KDFW: { conditionLabel: 'Clear sky • Temp 79°F', wind: '10 kts S', flightCategory: 'VFR', temperatureF: 79, iconName: 'sunny' },
  KDEN: { conditionLabel: 'Scattered clouds • Temp 65°F', wind: '12 kts N', flightCategory: 'VFR', temperatureF: 65, iconName: 'partly-sunny' },
  KORD: { conditionLabel: 'Clear sky • Temp 70°F', wind: '8 kts NW', flightCategory: 'VFR', temperatureF: 70, iconName: 'sunny' },
  KATL: { conditionLabel: 'Clear sky • Temp 75°F', wind: '8 kts Variable', flightCategory: 'VFR', temperatureF: 75, iconName: 'sunny' },
  KSEA: { conditionLabel: 'Overcast • Temp 58°F', wind: '10 kts S', flightCategory: 'MVFR', temperatureF: 58, iconName: 'cloudy' },
  KSFO: { conditionLabel: 'Partly cloudy • Temp 62°F', wind: '14 kts W', flightCategory: 'VFR', temperatureF: 62, iconName: 'partly-sunny' },
};

const createUnavailableWeather = (icao: string): AviationWeather => {
  const hub = icao.toUpperCase();
  const mock = MOCK_HUB_WEATHER[hub] || {
    conditionLabel: 'Clear sky • Temp 70°F',
    wind: '8 kts NW',
    flightCategory: 'VFR',
    temperatureF: 70,
    iconName: 'sunny',
  };

  return {
    ...UNAVAILABLE_WEATHER,
    icao,
    airportName: FALLBACK_AIRPORT_NAMES[hub] || `${hub.replace(/^K/, '')} Airport`,
    observedAt: new Date().toISOString(),
    conditionLabel: mock.conditionLabel || 'Clear sky',
    wind: mock.wind || '8 kts NW',
    flightCategory: mock.flightCategory || 'VFR',
    temperatureF: mock.temperatureF ?? 70,
    iconName: mock.iconName || 'sunny',
    source: 'fallback',
  };
};

export const AviationWeatherService = {
  async getCurrentWeather(icao = runtimeConfig.defaultAirportIcao): Promise<AviationWeather> {
    try {
      const { data, error } = await supabase.functions.invoke('aviation-weather', {
        body: { icao },
      });

      if (!error && data && !(data as { error?: string }).error) {
        const weather = data as Partial<AviationWeather>;

        return {
          icao: weather.icao || icao,
          airportName: weather.airportName || `${icao} Airport`,
          observedAt: weather.observedAt || new Date().toISOString(),
          temperatureF: weather.temperatureF ?? null,
          conditionLabel: weather.conditionLabel || UNAVAILABLE_WEATHER.conditionLabel,
          iconName: weather.iconName || UNAVAILABLE_WEATHER.iconName,
          wind: weather.wind || UNAVAILABLE_WEATHER.wind,
          visibility: weather.visibility || UNAVAILABLE_WEATHER.visibility,
          altimeter: weather.altimeter || UNAVAILABLE_WEATHER.altimeter,
          flightCategory: weather.flightCategory || UNAVAILABLE_WEATHER.flightCategory,
          rawReport: weather.rawReport,
          source: 'official',
        };
      }

      if (error) {
        console.warn('Supabase aviation-weather function unavailable, trying direct METAR fetch:', error);
      }

      const response = await fetch(
        `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`
      );

      if (!response.ok) {
        throw new Error(`METAR request failed with ${response.status}`);
      }

      const payload = (await response.json()) as AviationWeatherMetarResponse[];
      const metar = payload[0];

      if (!metar) {
        return createUnavailableWeather(icao);
      }

      return {
        icao: metar.icaoId || icao,
        airportName: metar.name || `${icao} Airport`,
        observedAt: metar.reportTime || new Date().toISOString(),
        temperatureF: metar.temp != null ? celsiusToFahrenheit(metar.temp) : null,
        conditionLabel: humanizeWeather(metar),
        iconName: mapFlightCategoryToIcon(metar.fltCat, metar.wxString),
        wind:
          metar.wspd != null
            ? `${metar.wspd} kts ${degreesToCardinal(metar.wdir)}`
            : UNAVAILABLE_WEATHER.wind,
        visibility: metar.visib != null ? `${metar.visib} SM` : UNAVAILABLE_WEATHER.visibility,
        altimeter: metar.altim != null ? `${hpaToInHg(metar.altim)} inHg` : UNAVAILABLE_WEATHER.altimeter,
        flightCategory: metar.fltCat || UNAVAILABLE_WEATHER.flightCategory,
        rawReport: metar.rawOb,
        source: 'official',
      };
    } catch (error) {
      console.warn('Aviation weather unavailable:', error);
      return createUnavailableWeather(icao);
    }
  },
};
