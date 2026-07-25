import { corsHeaders } from '../_shared/cors.ts';

type NormalizedEstimate = {
  airportCode: string;
  terminal: string;
  waitTimeMins: number;
  timestamp: string;
  reportCount: number;
  sourceType: 'partner' | 'official' | 'historical';
  sourceLabel: string;
  providerId: string;
  confidenceScore: number;
  isFallback: boolean;
};

const endpoint = Deno.env.get('TSA_ESTIMATE_ENDPOINT') || '';
const apiKey = Deno.env.get('TSA_ESTIMATE_API_KEY') || '';
const authHeader = Deno.env.get('TSA_ESTIMATE_AUTH_HEADER') || 'x-api-key';
const sourceLabel = Deno.env.get('TSA_ESTIMATE_SOURCE_LABEL') || 'Partner estimate';
const providerId = (Deno.env.get('TSA_ESTIMATE_PROVIDER_ID') || 'partner').trim().toLowerCase();
const tsaWaitTimesApiKey = Deno.env.get('TSA_WAIT_TIMES_API_KEY') || '';
const tsaWaitTimesBaseUrl = Deno.env.get('TSA_WAIT_TIMES_BASE_URL') || 'https://www.tsawaittimes.com/api';

const clampConfidence = (value: number) => Math.max(1, Math.min(99, Math.round(value)));

const normalizeEstimate = (row: Record<string, unknown>, fallbackAirportCode: string): NormalizedEstimate | null => {
  const airportCode = String(row.airportCode || row.airport_code || fallbackAirportCode || '').trim().toUpperCase();
  const terminal = String(row.terminal || row.checkpoint || 'Checkpoint').trim();
  const waitTimeMins = Number(row.waitTimeMins ?? row.wait_time_mins ?? row.waitMinutes);

  if (!airportCode || !Number.isFinite(waitTimeMins)) {
    return null;
  }

  return {
    airportCode,
    terminal,
    waitTimeMins: Math.max(0, Math.round(waitTimeMins)),
    timestamp: String(row.timestamp || row.observedAt || row.observed_at || new Date().toISOString()),
    reportCount: Math.max(1, Number(row.reportCount ?? row.report_count ?? 1)),
    sourceType: 'partner',
    sourceLabel: String(row.sourceLabel || row.source_label || sourceLabel).trim() || sourceLabel,
    providerId: String(row.providerId || row.provider || providerId).trim().toLowerCase() || providerId,
    confidenceScore: clampConfidence(Number(row.confidenceScore ?? row.confidence_score ?? 64)),
    isFallback: Boolean(row.isFallback ?? row.is_fallback ?? false),
  };
};

const waitFromValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
};

const flattenPrecheckCheckpoints = (payload: Record<string, unknown>): string[] => {
  const checkpoints = payload.precheck_checkpoints;

  if (!checkpoints || typeof checkpoints !== 'object' || Array.isArray(checkpoints)) {
    return [];
  }

  const terminalEntries = Object.entries(checkpoints as Record<string, unknown>);

  return terminalEntries.flatMap(([terminal, rawCheckpoints]) => {
    if (!rawCheckpoints || typeof rawCheckpoints !== 'object' || Array.isArray(rawCheckpoints)) {
      return [];
    }

    return Object.entries(rawCheckpoints as Record<string, unknown>)
      .filter(([, state]) => String(state || '').toLowerCase() === 'open')
      .map(([checkpoint]) => `${terminal.replace(/^Terminal\s+/i, '')} ${checkpoint}`.trim());
  });
};

const fetchTsaWaitTimesUpdates = async (airportCode: string): Promise<NormalizedEstimate[]> => {
  if (!tsaWaitTimesApiKey) {
    return [];
  }

  const url = new URL(`${tsaWaitTimesBaseUrl.replace(/\/$/, '')}/airport/${tsaWaitTimesApiKey}/${airportCode}/json`);
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`TSAWaitTimes request failed with ${response.status}: ${details.slice(0, 240)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const rightNowWait = waitFromValue(payload.rightnow);
  const userReportedWait = waitFromValue(payload.user_reported);
  const timestamp = new Date().toISOString();
  const checkpointNames = flattenPrecheckCheckpoints(payload);
  const terminals = checkpointNames.length > 0 ? checkpointNames : ['Airport average'];
  const airportWaitUpdates =
    rightNowWait == null
      ? []
      : terminals.map((terminal) => ({
          airportCode,
          terminal,
          waitTimeMins: rightNowWait,
          timestamp,
          reportCount: 1,
          sourceType: 'partner' as const,
          sourceLabel: 'TSAWaitTimes estimate',
          providerId: 'tsawaittimes',
          confidenceScore: 78,
          isFallback: false,
        }));

  const userReportedUpdate =
    userReportedWait == null
      ? []
      : [
          {
            airportCode,
            terminal: 'Traveler reported',
            waitTimeMins: userReportedWait,
            timestamp,
            reportCount: 1,
            sourceType: 'partner' as const,
            sourceLabel: 'Traveler reported wait',
            providerId: 'tsawaittimes',
            confidenceScore: 66,
            isFallback: false,
          },
        ];

  return [...airportWaitUpdates, ...userReportedUpdate];
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = request.method === 'POST' ? await request.json() : {};
    const airportCode = String(body.airportCode || 'JFK').trim().toUpperCase();

    if (!endpoint) {
      const updates = await fetchTsaWaitTimesUpdates(airportCode);

      return new Response(JSON.stringify({ airportCode, updates }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const url = new URL(endpoint);
    url.searchParams.set('airportCode', airportCode);

    const headers = new Headers({ Accept: 'application/json' });
    if (apiKey) {
      headers.set(authHeader, apiKey);
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      const details = await response.text();
      return new Response(JSON.stringify({ error: 'Partner TSA request failed', details }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const payload = await response.json();
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.updates)
      ? payload.updates
      : Array.isArray(payload?.data)
      ? payload.data
      : [];

    const updates = rows
      .map((row) => normalizeEstimate((row || {}) as Record<string, unknown>, airportCode))
      .filter((row): row is NormalizedEstimate => Boolean(row));

    return new Response(JSON.stringify({ airportCode, updates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
