import { corsHeaders } from '../_shared/cors.ts';

type FlightAwareFlight = {
  fa_flight_id?: string;
  ident?: string;
  ident_iata?: string;
  operator_iata?: string;
  flight_number?: string;
  origin?: { code_iata?: string; code?: string };
  destination?: { code_iata?: string; code?: string };
  scheduled_out?: string | null;
  scheduled_off?: string | null;
  estimated_out?: string | null;
  actual_out?: string | null;
  gate_origin?: string | null;
  terminal_origin?: string | null;
  status?: string | null;
};

type FlightAwareAirportFlightsResponse = {
  arrivals?: FlightAwareFlight[];
  scheduled_arrivals?: FlightAwareFlight[];
  departures?: FlightAwareFlight[];
  scheduled_departures?: FlightAwareFlight[];
};

const DEFAULT_MAX_FLIGHTS = 15;
const PASSENGER_OPERATOR_ALLOWLIST = new Set([
  '9E', // Endeavor Air (Delta Connection)
  'AA',
  'AS',
  'B6',
  'BA',
  'C5', // CommuteAir (United Express)
  'DL',
  'EI',
  'F9',
  'G7', // GoJet Airlines (United Express)
  'HA',
  'IB',
  'JL',
  'KL',
  'LA',
  'LH',
  'LX',
  'MQ', // Envoy Air (American Eagle)
  'NK',
  'OH', // PSA Airlines (American Eagle)
  'OO', // SkyWest
  'PT', // Piedmont Airlines (American Eagle)
  'QF',
  'QR',
  'QX', // Horizon Air (Alaska)
  'SK',
  'TP',
  'UA',
  'UX',
  'VA',
  'VS',
  'WN',
  'WS',
  'YV', // Mesa Airlines (United Express)
  'YX', // Republic Airways
]);

const toTimeLabel = (value?: string | null) => {
  if (!value) return '--:--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/New_York',
  }).format(date);
};

const getRoute = (flight: FlightAwareFlight, airportCode: string) => {
  const origin = flight.origin?.code_iata || flight.origin?.code || airportCode;
  const destination = flight.destination?.code_iata || flight.destination?.code || 'TBD';
  return `${origin} -> ${destination}`;
};

const getFlightNumber = (flight: FlightAwareFlight) => {
  if (flight.ident_iata) return flight.ident_iata;
  if (flight.operator_iata && flight.flight_number) return `${flight.operator_iata}${flight.flight_number}`;
  return flight.ident || 'TBD';
};

const isAirlineRelevant = (flight: FlightAwareFlight) => {
  const operator = (flight.operator_iata || '').toUpperCase();
  const identIata = (flight.ident_iata || '').toUpperCase();
  const ident = (flight.ident || '').toUpperCase();
  const routeHasIata =
    Boolean(flight.origin?.code_iata && flight.origin.code_iata.length === 3) &&
    Boolean(flight.destination?.code_iata && flight.destination.code_iata.length === 3);

  if (operator && PASSENGER_OPERATOR_ALLOWLIST.has(operator) && routeHasIata) return true;
  if (identIata) {
    const code = identIata.replace(/[0-9].*$/, '');
    if (PASSENGER_OPERATOR_ALLOWLIST.has(code) && routeHasIata) return true;
  }

  if (!ident) return false;

  if (/^N\d+[A-Z0-9]*$/.test(ident)) {
    return false;
  }

  const identCode = ident.replace(/[0-9].*$/, '');
  if (!PASSENGER_OPERATOR_ALLOWLIST.has(identCode)) {
    return false;
  }

  return routeHasIata && /^[A-Z0-9]{2,3}\d+/.test(ident);
};

const normalizeUrgency = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();

  if (
    normalized.includes('cancel') ||
    normalized.includes('divert') ||
    normalized.includes('delay') ||
    normalized.includes('hold')
  ) {
    return 'critical';
  }

  if (
    normalized.includes('taxi') ||
    normalized.includes('gate') ||
    normalized.includes('board') ||
    normalized.includes('sched')
  ) {
    return 'watch';
  }

  return 'normal';
};

const stripTags = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fetchAirportStatus = async (airportCode: string) => {
  try {
    const response = await fetch(
      `https://www.fly.faa.gov/fly/flyfaa/flyfaaindex?ARPT=${encodeURIComponent(airportCode)}&p=1`,
      { headers: { Accept: 'text/html' } }
    );

    if (!response.ok) {
      throw new Error(`FAA airport status request failed with ${response.status}`);
    }

    const html = await response.text();
    const text = stripTags(html);
    const departureMatch = text.match(
      /General Departure Delays:\s*(.+?)(?=General Arrival Delays:|This information was last updated:|$)/i
    );
    const updatedMatch = text.match(
      /This information was last updated:\s*(.+?)(?=Glossary|Back|$)/i
    );
    const departureText =
      departureMatch?.[1]?.trim() || 'General departure delays are 15 minutes or less.';
    const hasDelay =
      /delay|gate hold|ground stop|ground delay|taxi/i.test(departureText) &&
      !/15 minutes or less/i.test(departureText);

    return {
      faaDelay: hasDelay,
      faaDelayReason: departureText,
      lastUpdated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
    };
  } catch (error) {
    console.warn('FAA airport status lookup failed:', error);
    return undefined;
  }
};

const mapFlight = (
  flight: FlightAwareFlight,
  airportCode: string,
  movementType: 'departure' | 'arrival',
  index: number
) => ({
  id: flight.fa_flight_id || `${airportCode}-${movementType}-${index}`,
  flightNumber: getFlightNumber(flight),
  route:
    movementType === 'departure'
      ? getRoute(flight, airportCode)
      : `${flight.origin?.code_iata || flight.origin?.code || 'TBD'} -> ${airportCode}`,
  scheduledTime: toTimeLabel(
    flight.scheduled_out || flight.estimated_out || flight.scheduled_off || flight.actual_out
  ),
  movementType,
  statusLabel: flight.status || 'Monitoring',
  gate: flight.gate_origin || undefined,
  terminal: flight.terminal_origin || undefined,
  urgency: normalizeUrgency(flight.status),
  detail: flight.actual_out ? 'Aircraft moving' : 'Upcoming movement',
  source: 'live',
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FLIGHTAWARE_API_KEY');
    if (!apiKey) {
      throw new Error('Missing FLIGHTAWARE_API_KEY secret');
    }

    const body = request.method === 'POST' ? await request.json() : {};
    const airportCode =
      typeof body.airportCode === 'string' && body.airportCode.trim()
        ? body.airportCode.trim().toUpperCase()
        : 'JFK';
    const maxFlights =
      typeof body.maxFlights === 'number' && body.maxFlights > 0
        ? Math.min(Math.floor(body.maxFlights), 15)
        : DEFAULT_MAX_FLIGHTS;

    const url = new URL(`https://aeroapi.flightaware.com/aeroapi/airports/${airportCode}/flights`);
    url.searchParams.set('max_pages', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'x-apikey': apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: 'FlightAware request failed',
          details: errorText,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status,
        }
      );
    }

    const payload = (await response.json()) as FlightAwareAirportFlightsResponse;
    const departureLimit = maxFlights;
    const arrivalLimit = maxFlights;
    const departures = [...(payload.departures || []), ...(payload.scheduled_departures || [])]
      .filter(isAirlineRelevant)
      .slice(0, departureLimit)
      .map((flight, index) => mapFlight(flight, airportCode, 'departure', index));
    const arrivals = [...(payload.arrivals || []), ...(payload.scheduled_arrivals || [])]
      .filter(isAirlineRelevant)
      .slice(0, arrivalLimit)
      .map((flight, index) => mapFlight(flight, airportCode, 'arrival', index));
    const airportStatus = await fetchAirportStatus(airportCode);
    const flights = [...departures, ...arrivals].slice(0, departureLimit + arrivalLimit);

    return new Response(
      JSON.stringify({
        airportCode,
        fetchedAt: new Date().toISOString(),
        airportStatus,
        flights,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
