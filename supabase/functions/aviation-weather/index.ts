import { corsHeaders } from '../_shared/cors.ts';

type AviationWeatherMetarResponse = {
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = request.method === 'POST' ? await request.json() : {};
    const icao =
      typeof body.icao === 'string' && body.icao.trim()
        ? body.icao.trim().toUpperCase()
        : 'KJFK';
    const response = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`METAR request failed with ${response.status}`);
    }

    const payload = (await response.json()) as AviationWeatherMetarResponse[];
    const metar = payload[0];

    if (!metar) {
      return new Response(JSON.stringify({ error: `No METAR found for ${icao}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({
        icao: metar.icaoId || icao,
        airportName: metar.name || `${icao} Airport`,
        observedAt: metar.reportTime || new Date().toISOString(),
        temperatureF: metar.temp != null ? celsiusToFahrenheit(metar.temp) : null,
        conditionLabel: humanizeWeather(metar),
        iconName: mapFlightCategoryToIcon(metar.fltCat, metar.wxString),
        wind: metar.wspd != null ? `${metar.wspd} kts ${degreesToCardinal(metar.wdir)}` : null,
        visibility: metar.visib != null ? `${metar.visib} SM` : null,
        altimeter: metar.altim != null ? `${hpaToInHg(metar.altim)} inHg` : null,
        flightCategory: metar.fltCat || 'VFR',
        rawReport: metar.rawOb,
        source: 'official',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown weather error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
