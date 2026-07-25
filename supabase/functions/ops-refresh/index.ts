import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { corsHeaders } from '../_shared/cors.ts';

type OpsEventSeed = {
  eventType: string;
  severity: 'normal' | 'watch' | 'critical';
  title: string;
  message: string;
  payload: Record<string, unknown>;
};

type TsaSourceType = 'official' | 'crew' | 'partner' | 'historical';

type NormalizedTsaUpdate = {
  airportCode: string;
  terminal: string;
  status: 'CLEAR' | 'MODERATE' | 'BUSY' | 'CRITICAL';
  waitTimeMins: number;
  timestamp: string;
  reportCount: number;
  sourceType: TsaSourceType;
  sourceLabel: string;
  providerId: string;
  confidenceScore: number;
  isFallback: boolean;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const averageWait = (updates: NormalizedTsaUpdate[]) =>
  updates.length > 0
    ? Math.round(updates.reduce((total, update) => total + update.waitTimeMins, 0) / updates.length)
    : 0;

const inferTsaSeverity = (waitTimeMins: number) => {
  if (waitTimeMins >= 35) return 'critical';
  if (waitTimeMins >= 20) return 'watch';
  return 'normal';
};

const inferStatusFromWait = (waitTimeMins: number): NormalizedTsaUpdate['status'] => {
  if (waitTimeMins >= 35) return 'CRITICAL';
  if (waitTimeMins >= 20) return 'BUSY';
  if (waitTimeMins >= 10) return 'MODERATE';
  return 'CLEAR';
};

const normalizeSourceType = (value?: string): TsaSourceType => {
  switch ((value || '').toLowerCase()) {
    case 'official':
      return 'official';
    case 'partner':
      return 'partner';
    case 'historical':
      return 'historical';
    default:
      return 'crew';
  }
};

const getSourceLabel = (sourceType: TsaSourceType, label?: string) => {
  if (label?.trim()) return label.trim();

  switch (sourceType) {
    case 'official':
      return 'Official feed';
    case 'partner':
      return 'Partner estimate';
    case 'historical':
      return 'Historical estimate';
    default:
      return 'Crew reports';
  }
};

const clampConfidence = (value: number) => Math.max(1, Math.min(99, Math.round(value)));

const normalizeTsaUpdate = (
  raw: Record<string, unknown>,
  fallbackAirportCode: string,
  fallbackSourceType: TsaSourceType
): NormalizedTsaUpdate | null => {
  const airportCode = String(raw.airportCode || raw.airport_code || fallbackAirportCode || '').trim().toUpperCase();
  const terminal = String(raw.terminal || raw.checkpoint || 'Checkpoint').trim();
  const waitTimeMins = Number(raw.waitTimeMins ?? raw.wait_time_mins);

  if (!airportCode || !Number.isFinite(waitTimeMins)) {
    return null;
  }

  const sourceType = normalizeSourceType(String(raw.sourceType || raw.source_type || fallbackSourceType));
  const timestamp = String(raw.timestamp || raw.observedAt || raw.created_at || new Date().toISOString());

  return {
    airportCode,
    terminal,
    status: inferStatusFromWait(waitTimeMins),
    waitTimeMins: Math.max(0, Math.round(waitTimeMins)),
    timestamp,
    reportCount: Math.max(1, Number(raw.reportCount ?? raw.report_count ?? 1)),
    sourceType,
    sourceLabel: getSourceLabel(sourceType, String(raw.sourceLabel || raw.source_label || '')),
    providerId: String(raw.providerId || raw.provider || (sourceType === 'crew' ? 'crew' : 'partner'))
      .trim()
      .toLowerCase(),
    confidenceScore: clampConfidence(
      Number(raw.confidenceScore ?? raw.confidence_score ?? (sourceType === 'crew' ? 82 : 64))
    ),
    isFallback:
      typeof raw.isFallback === 'boolean' ? raw.isFallback : sourceType === 'partner' || sourceType === 'historical',
  };
};

const getFreshnessPenalty = (timestamp: string) =>
  Math.min(Math.max(0, Date.now() - new Date(timestamp).getTime()) / 60000, 240) / 4;

const scoreTsaUpdate = (update: NormalizedTsaUpdate) => {
  const sourceWeight: Record<TsaSourceType, number> = {
    official: 400,
    crew: 300,
    partner: 200,
    historical: 100,
  };

  return sourceWeight[update.sourceType] + update.confidenceScore - getFreshnessPenalty(update.timestamp) + update.reportCount * 2;
};

const mergeTsaUpdates = (updates: NormalizedTsaUpdate[]) => {
  const bestByTerminal = new Map<string, NormalizedTsaUpdate>();

  updates.forEach((update) => {
    const key = `${update.airportCode}-${update.terminal}`.toLowerCase();
    const current = bestByTerminal.get(key);
    if (!current || scoreTsaUpdate(update) > scoreTsaUpdate(current)) {
      bestByTerminal.set(key, update);
    }
  });

  return Array.from(bestByTerminal.values()).sort((left, right) => right.waitTimeMins - left.waitTimeMins);
};

const buildEvents = (previousSnapshot: any | null, nextSnapshot: any, airportCode: string): OpsEventSeed[] => {
  const events: OpsEventSeed[] = [];
  const previousDelay = Boolean(previousSnapshot?.airportStatus?.faaDelay);
  const nextDelay = Boolean(nextSnapshot?.airportStatus?.faaDelay);
  const previousTsa = Number(previousSnapshot?.airportStatus?.tsaWaitTimeMins || 0);
  const nextTsa = Number(nextSnapshot?.airportStatus?.tsaWaitTimeMins || 0);
  const criticalWeatherAlerts = (nextSnapshot?.weatherAlerts || []).filter((alert: any) => alert.urgency === 'critical');
  const latestCrewAlert = (nextSnapshot?.headlineAlerts || [])[0];

  if (!previousDelay && nextDelay) {
    events.push({
      eventType: 'FAA_DELAY',
      severity: 'critical',
      title: `${airportCode} delay program active`,
      message: nextSnapshot.airportStatus.faaDelayReason || 'FAA delay program is active.',
      payload: { airportCode },
    });
  }

  if (nextTsa >= 20 && previousTsa < 20) {
    events.push({
      eventType: 'TSA_SPIKE',
      severity: inferTsaSeverity(nextTsa),
      title: `${airportCode} TSA spike`,
      message: `Checkpoint waits are averaging ${nextTsa} minutes.`,
      payload: { airportCode, tsaWaitTimeMins: nextTsa },
    });
  }

  if (criticalWeatherAlerts.length > 0 && (previousSnapshot?.weatherAlerts || []).length === 0) {
    const first = criticalWeatherAlerts[0];
    events.push({
      eventType: 'WEATHER_ALERT',
      severity: 'critical',
      title: `${airportCode} severe weather alert`,
      message: first.headline || first.event,
      payload: { airportCode, alertId: first.id },
    });
  }

  if (latestCrewAlert?.type === 'SAFETY' && latestCrewAlert?.id !== previousSnapshot?.headlineAlerts?.[0]?.id) {
    events.push({
      eventType: 'CREW_INTEL',
      severity: latestCrewAlert.isCritical ? 'critical' : 'watch',
      title: `${airportCode} crew intel`,
      message: latestCrewAlert.title,
      payload: { airportCode, alertId: latestCrewAlert.id },
    });
  }

  return events;
};

const fetchPartnerTsaUpdates = async (airportCode: string): Promise<NormalizedTsaUpdate[]> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/tsa-estimates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ airportCode }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.updates) ? payload.updates : [];

    return rows
      .map((row) => normalizeTsaUpdate(row as Record<string, unknown>, airportCode, 'partner'))
      .filter((update): update is NormalizedTsaUpdate => Boolean(update));
  } catch (error) {
    console.warn('Partner TSA estimate lookup failed:', error);
    return [];
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = request.method === 'POST' ? await request.json() : {};
    const airportCodes = Array.isArray(body.airportCodes)
      ? body.airportCodes.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean)
      : [String(body.airportCode || 'JFK').trim().toUpperCase()];

    const results: Record<string, unknown> = {};

    for (const airportCode of airportCodes) {
      const previousSnapshotRow = await supabase
        .from('ops_snapshots')
        .select('snapshot')
        .eq('airport_code', airportCode)
        .maybeSingle();

      const flightBoardResponse = await fetch(`${supabaseUrl}/functions/v1/flight-board`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ airportCode, maxFlights: 15 }),
      });
      const flightBoard = await flightBoardResponse.json();

      const weatherResponse = await fetch(
        `https://aviationweather.gov/api/data/metar?ids=K${airportCode}&format=json`
      );
      const weatherPayload = await weatherResponse.json();

      const nwsResponse = await fetch(`https://api.weather.gov/alerts/active?area=${airportCode.substring(0, 2)}`, {
        headers: {
          'User-Agent': 'YoFlyCrew/1.0 (ops@yoflycrew.app)',
          Accept: 'application/geo+json',
        },
      });
      const nwsPayload = await nwsResponse.json();

      const [{ data: tsaReports }, { data: alerts }, partnerTsaUpdates] = await Promise.all([
        supabase
          .from('tsa_reports')
          .select('airport_code, terminal, wait_time_mins, status, created_at')
          .eq('airport_code', airportCode)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('alerts')
          .select('id, type, title, description, airport_code, created_at, expires_at')
          .eq('airport_code', airportCode)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(3),
        fetchPartnerTsaUpdates(airportCode),
      ]);

      const crewTsaUpdates = (tsaReports || [])
        .map((row) =>
          normalizeTsaUpdate(
            {
              ...row,
              reportCount: 1,
              sourceType: 'crew',
              sourceLabel: 'Crew reports',
              providerId: 'crew',
              confidenceScore: 82,
              isFallback: false,
            },
            airportCode,
            'crew'
          )
        )
        .filter((update): update is NormalizedTsaUpdate => Boolean(update));

      const mergedTsaUpdates = mergeTsaUpdates([...crewTsaUpdates, ...partnerTsaUpdates]);
      const leadTsaUpdate = mergedTsaUpdates[0];

      const nextSnapshot = {
        airportCode,
        collectedAt: new Date().toISOString(),
        airportStatus: {
          airportCode,
          faaDelay: Boolean(flightBoard.airportStatus?.faaDelay),
          faaDelayReason: flightBoard.airportStatus?.faaDelayReason,
          tsaWaitTimeMins: averageWait(mergedTsaUpdates),
          tsaSourceType: leadTsaUpdate?.sourceType || 'historical',
          tsaSourceLabel: leadTsaUpdate?.sourceLabel || 'No live source',
          tsaConfidenceScore: leadTsaUpdate?.confidenceScore || 20,
          lastUpdated: flightBoard.airportStatus?.lastUpdated || new Date().toISOString(),
        },
        weather: weatherPayload?.[0] || null,
        weatherAlerts: (nwsPayload?.features || []).slice(0, 3).map((feature: any) => ({
          id: feature.id,
          event: feature.properties?.event,
          headline: feature.properties?.headline,
          severity: feature.properties?.severity,
          urgency:
            feature.properties?.severity === 'Severe' || feature.properties?.severity === 'Extreme'
              ? 'critical'
              : feature.properties?.severity === 'Moderate'
              ? 'watch'
              : 'normal',
          area: feature.properties?.areaDesc,
        })),
        tsaUpdates: mergedTsaUpdates,
        headlineAlerts:
          (alerts || []).map((alert: any) => ({
            id: alert.id,
            type: alert.type,
            title: alert.title,
            message: alert.description,
            location: alert.airport_code,
            createdAt: alert.created_at,
            expiresAt: alert.expires_at,
            userId: 'system',
            username: 'Crew',
            isCritical: alert.type === 'SAFETY',
          })) || [],
        flightBoard: flightBoard.flights || [],
      };

      await supabase.from('ops_snapshots').upsert({
        airport_code: airportCode,
        snapshot: nextSnapshot,
        snapshot_hash: crypto.randomUUID(),
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      const events = buildEvents(previousSnapshotRow.data?.snapshot || null, nextSnapshot, airportCode);
      if (events.length > 0) {
        await supabase.from('ops_events').insert(
          events.map((event) => ({
            airport_code: airportCode,
            event_type: event.eventType,
            severity: event.severity,
            title: event.title,
            message: event.message,
            payload: event.payload,
          }))
        );
      }

      results[airportCode] = nextSnapshot;
    }

    return new Response(JSON.stringify({ ok: true, snapshots: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
