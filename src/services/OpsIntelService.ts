import { Alert, AlertType } from '../types/alerts';
import { supabase } from '../lib/supabase';
import { CrewOpsSnapshot, FlightBoardEntry, OpsSignal, OpsUrgency } from '../types/ops';
import { TSAStatus, TSAUpdate } from '../types/tsa';
import { runtimeConfig } from '../config/runtime';
import { AlertService } from './AlertService';
import { AviationWeatherService } from './AviationWeatherService';
import { AirportStatus, FlightDataService } from './FlightDataService';
import { TSAService } from './TSAService';
import { WeatherAlertService } from './WeatherAlertService';

const AIRPORT_DIRECTORY: Record<string, { name: string; icao: string }> = {
  ATL: { name: 'Hartsfield-Jackson Atlanta International', icao: 'KATL' },
  DFW: { name: 'Dallas Fort Worth International', icao: 'KDFW' },
  DEN: { name: 'Denver International', icao: 'KDEN' },
  EWR: { name: 'Newark Liberty International', icao: 'KEWR' },
  JFK: { name: 'John F. Kennedy International', icao: 'KJFK' },
  LAS: { name: 'Harry Reid International', icao: 'KLAS' },
  LAX: { name: 'Los Angeles International', icao: 'KLAX' },
  MCO: { name: 'Orlando International', icao: 'KMCO' },
  MIA: { name: 'Miami International', icao: 'KMIA' },
  ORD: { name: "O'Hare International", icao: 'KORD' },
  PHX: { name: 'Phoenix Sky Harbor International', icao: 'KPHX' },
  SEA: { name: 'Seattle-Tacoma International', icao: 'KSEA' },
  SFO: { name: 'San Francisco International', icao: 'KSFO' },
};

interface FlightStatusApiEntry {
  id?: string;
  flightNumber?: string;
  route?: string;
  scheduledTime?: string;
  movementType?: 'departure' | 'arrival';
  statusLabel?: string;
  gate?: string;
  terminal?: string;
  urgency?: OpsUrgency;
  detail?: string;
}

interface FlightBoardFunctionResponse {
  flights?: FlightStatusApiEntry[];
  airportStatus?: {
    faaDelay?: boolean;
    faaDelayReason?: string;
    lastUpdated?: string;
  };
}

const emptyFlightBoard = (): FlightBoardEntry[] => [];

const dedupeLatestTsa = (updates: TSAUpdate[], airportCode: string) => {
  const filtered = updates.filter((update) => update.airportCode === airportCode);
  const latestByTerminal = new Map<string, TSAUpdate>();

  filtered.forEach((update) => {
    const current = latestByTerminal.get(update.terminal);
    if (!current || new Date(update.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      latestByTerminal.set(update.terminal, update);
    }
  });

  return Array.from(latestByTerminal.values()).sort((left, right) => right.waitTimeMins - left.waitTimeMins);
};

const inferWeatherUrgency = (flightCategory: string, conditionLabel: string): OpsUrgency => {
  const normalized = `${flightCategory} ${conditionLabel}`.toLowerCase();
  if (normalized.includes('lifr') || normalized.includes('ifr') || normalized.includes('thunder')) {
    return 'critical';
  }
  if (normalized.includes('mvfr') || normalized.includes('rain') || normalized.includes('snow')) {
    return 'watch';
  }
  return 'normal';
};

const inferTsaUrgency = (status: AirportStatus, tsaUpdates: TSAUpdate[]): OpsUrgency => {
  if ((status.tsaWaitTimeMins || 0) >= 35 || tsaUpdates.some((update) => update.status === TSAStatus.CRITICAL)) {
    return 'critical';
  }
  if ((status.tsaWaitTimeMins || 0) >= 20 || tsaUpdates.some((update) => update.status === TSAStatus.BUSY)) {
    return 'watch';
  }
  return 'normal';
};

const hasUsableWeather = (weather: CrewOpsSnapshot['weather'] | undefined | null) =>
  Boolean(weather?.conditionLabel && weather?.flightCategory && weather?.wind && weather?.airportName);

const createOperationalSignals = (
  airportStatus: AirportStatus,
  weather: CrewOpsSnapshot['weather'],
  weatherAlerts: CrewOpsSnapshot['weatherAlerts'],
  alerts: Alert[],
  tsaUpdates: TSAUpdate[]
): OpsSignal[] => {
  const weatherUrgency = inferWeatherUrgency(weather.flightCategory, weather.conditionLabel);
  const tsaUrgency = inferTsaUrgency(airportStatus, tsaUpdates);
  const criticalAlerts = alerts.filter((alert) => alert.isCritical || alert.type === AlertType.SAFETY).length;
  const alertUrgency: OpsUrgency = criticalAlerts >= 2 ? 'critical' : criticalAlerts === 1 ? 'watch' : 'normal';

  return [
    {
      id: 'faa-flow',
      label: 'FAA flow',
      value: airportStatus.faaDelay ? 'Delayed' : 'Normal',
      urgency: airportStatus.faaDelay ? 'critical' : 'normal',
      detail: airportStatus.faaDelayReason || 'No major ATC program reported',
    },
    {
      id: 'tsa-flow',
      label: 'TSA/KCM',
      value: airportStatus.tsaWaitTimeMins != null ? `${airportStatus.tsaWaitTimeMins} min` : 'Live unavailable',
      urgency: tsaUrgency,
      detail:
        tsaUpdates[0]?.terminal
          ? `${tsaUpdates[0].terminal} • ${tsaUpdates[0].sourceLabel} • ${tsaUpdates[0].confidenceScore}% confidence`
          : 'Real checkpoint times need live crew reports or a connected TSA estimate feed',
    },
    {
      id: 'wx',
      label: 'Weather',
      value: weatherAlerts.length > 0 ? weatherAlerts[0].event : weather.flightCategory || 'Weather pending',
      urgency: weatherAlerts[0]?.urgency || weatherUrgency,
      detail:
        weatherAlerts.length > 0
          ? `${weatherAlerts[0].severity} • ${weatherAlerts[0].area}`
          : `${weather.conditionLabel || 'Live weather unavailable'} • ${weather.wind || 'Wind pending'}`,
    },
    {
      id: 'crew-intel',
      label: 'Crew intel',
      value: `${alerts.length} active`,
      urgency: alertUrgency,
      detail:
        criticalAlerts > 0
          ? `${criticalAlerts} high-priority crew report${criticalAlerts === 1 ? '' : 's'} need attention`
          : 'No high-priority crew reports right now',
    },
  ];
};

const getAirportInfo = (airportCode: string) => {
  const normalized = airportCode.toUpperCase();
  const fallback = {
    name: `${normalized} Operations`,
    icao: normalized === runtimeConfig.defaultAirportCode ? runtimeConfig.defaultAirportIcao : `K${normalized}`,
  };

  return AIRPORT_DIRECTORY[normalized] || fallback;
};

const getCachedSnapshot = async (airportCode: string): Promise<CrewOpsSnapshot | null> => {
  try {
    const { data, error } = await supabase
      .from('ops_snapshots')
      .select('snapshot, expires_at')
      .eq('airport_code', airportCode)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data?.snapshot) {
      return null;
    }

    const snapshot = data.snapshot as CrewOpsSnapshot;
    if (!hasUsableWeather(snapshot.weather)) {
      return null;
    }
    const normalizedTsaUpdates = TSAService.normalizeUpdates(
      (snapshot as { tsaUpdates?: unknown[] }).tsaUpdates || [],
      airportCode
    );
    const liveTsaUpdates = await TSAService.getLatestUpdates(airportCode).catch((error) => {
      console.warn('Live TSA refresh unavailable while hydrating cached ops snapshot:', error);
      return [] as TSAUpdate[];
    });
    const effectiveTsaUpdates =
      liveTsaUpdates.length > 0
        ? dedupeLatestTsa(TSAService.normalizeUpdates(liveTsaUpdates, airportCode), airportCode).slice(0, 3)
        : normalizedTsaUpdates;
    const normalizedAirportStatus: AirportStatus = {
      ...snapshot.airportStatus,
      tsaWaitTimeMins:
        effectiveTsaUpdates.length > 0
          ? Math.round(
              effectiveTsaUpdates.reduce((total, update) => total + update.waitTimeMins, 0) /
                effectiveTsaUpdates.length
            )
          : snapshot.airportStatus.tsaWaitTimeMins ?? null,
      tsaSourceType: effectiveTsaUpdates[0]?.sourceType || snapshot.airportStatus.tsaSourceType || 'historical',
      tsaSourceLabel: effectiveTsaUpdates[0]?.sourceLabel || snapshot.airportStatus.tsaSourceLabel || 'Live unavailable',
      tsaConfidenceScore:
        effectiveTsaUpdates[0]?.confidenceScore || snapshot.airportStatus.tsaConfidenceScore || 0,
    };

    return {
      ...snapshot,
      airportStatus: normalizedAirportStatus,
      tsaUpdates: effectiveTsaUpdates,
      operationalSignals: createOperationalSignals(
        normalizedAirportStatus,
        snapshot.weather,
        snapshot.weatherAlerts || [],
        snapshot.headlineAlerts || [],
        effectiveTsaUpdates
      ),
    };
  } catch (error) {
    console.warn('Ops snapshot cache unavailable, falling back to live aggregation:', error);
    return null;
  }
};

const fetchFlightBoard = async (
  airportCode: string
): Promise<{
  flights: FlightBoardEntry[];
  airportStatusOverride?: {
    faaDelay?: boolean;
    faaDelayReason?: string;
    lastUpdated?: string;
  };
}> => {
  if (!runtimeConfig.flightStatusEndpoint) {
    try {
      const { data, error } = await supabase.functions.invoke('flight-board', {
        body: {
          airportCode,
          maxFlights: 15,
        },
      });

      if (error) {
        throw error;
      }

      const payload = (data || {}) as FlightBoardFunctionResponse;
      if (!Array.isArray(payload.flights) || payload.flights.length === 0) {
        return {
          flights: emptyFlightBoard(),
          airportStatusOverride: payload.airportStatus,
        };
      }

      return {
        airportStatusOverride: payload.airportStatus,
        flights: payload.flights.slice(0, 30).map((entry, index) => ({
          id: entry.id || `${airportCode.toLowerCase()}-fn-${index}`,
          flightNumber: entry.flightNumber || 'TBD',
          route: entry.route || `${airportCode} route pending`,
          scheduledTime: entry.scheduledTime || '--:--',
          movementType: entry.movementType || 'departure',
          statusLabel: entry.statusLabel || 'Monitoring',
          gate: entry.gate,
          terminal: entry.terminal,
          urgency: entry.urgency || 'watch',
          detail: entry.detail,
          source: 'live',
        })),
      };
    } catch (error) {
      console.warn('Supabase flight-board function unavailable, showing empty flight board:', error);
      return { flights: emptyFlightBoard() };
    }
  }

  try {
    const response = await fetch(
      `${runtimeConfig.flightStatusEndpoint}?airportCode=${encodeURIComponent(airportCode)}`
    );

    if (!response.ok) {
      throw new Error(`Flight board endpoint failed with ${response.status}`);
    }

    const payload = (await response.json()) as FlightStatusApiEntry[];

    if (!Array.isArray(payload) || payload.length === 0) {
      return { flights: emptyFlightBoard() };
    }

    return {
      flights: payload.slice(0, 30).map((entry, index) => ({
        id: entry.id || `${airportCode.toLowerCase()}-live-${index}`,
        flightNumber: entry.flightNumber || 'TBD',
        route: entry.route || `${airportCode} route pending`,
        scheduledTime: entry.scheduledTime || '--:--',
        movementType: entry.movementType || 'departure',
        statusLabel: entry.statusLabel || 'Monitoring',
        gate: entry.gate,
        terminal: entry.terminal,
        urgency: entry.urgency || 'watch',
        detail: entry.detail,
        source: 'live',
      })),
    };
  } catch (error) {
    console.warn('Flight board endpoint unavailable, showing empty flight board:', error);
    return { flights: emptyFlightBoard() };
  }
};

export const OpsIntelService = {
  async getSnapshot(baseAirport: string): Promise<CrewOpsSnapshot> {
    const airportCode = (baseAirport || runtimeConfig.defaultAirportCode).toUpperCase();
    const airportInfo = getAirportInfo(airportCode);
    const cachedSnapshot = await getCachedSnapshot(airportCode);

    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ops-refresh', {
        body: {
          airportCode,
        },
      });

      if (!error && data?.ok && data?.snapshots?.[airportCode]) {
        const snapshot = data.snapshots[airportCode];
        return {
          airportCode,
          airportName: airportInfo.name,
          icao: airportInfo.icao,
          collectedAt: snapshot.collectedAt || new Date().toISOString(),
          airportStatus: snapshot.airportStatus,
          weather: snapshot.weather,
          weatherAlerts: snapshot.weatherAlerts || [],
          tsaUpdates: snapshot.tsaUpdates || [],
          headlineAlerts: snapshot.headlineAlerts || [],
          flightBoard: snapshot.flightBoard || [],
          operationalSignals: createOperationalSignals(
            snapshot.airportStatus,
            snapshot.weather,
            snapshot.weatherAlerts || [],
            snapshot.headlineAlerts || [],
            snapshot.tsaUpdates || []
          ),
        };
      }
    } catch (error) {
      console.warn('Edge Function ops-refresh invocation failed, falling back to client-side aggregation:', error);
    }

    const [airportStatus, weather, weatherAlerts, alerts, tsaUpdates, flightBoardResponse] = await Promise.all([
      FlightDataService.getAirportStatus(airportCode),
      AviationWeatherService.getCurrentWeather(airportInfo.icao),
      WeatherAlertService.getAirportAlerts(airportCode),
      AlertService.getAlerts(airportCode).catch((error) => {
        console.warn('Alert feed unavailable, continuing with empty crew intel:', error);
        return [] as Alert[];
      }),
      TSAService.getLatestUpdates(airportCode).catch((error) => {
        console.warn('TSA feed unavailable, continuing with empty checkpoint data:', error);
        return [] as TSAUpdate[];
      }),
      fetchFlightBoard(airportCode),
    ]);
    const effectiveAirportStatus = flightBoardResponse.airportStatusOverride
      ? {
          ...airportStatus,
          faaDelay: Boolean(flightBoardResponse.airportStatusOverride.faaDelay),
          faaDelayReason:
            flightBoardResponse.airportStatusOverride.faaDelayReason || airportStatus.faaDelayReason,
          lastUpdated:
            flightBoardResponse.airportStatusOverride.lastUpdated || airportStatus.lastUpdated,
        }
      : airportStatus;

    const headlineAlerts = alerts
      .slice()
      .sort((left, right) => Number(Boolean(right.isCritical)) - Number(Boolean(left.isCritical)))
      .slice(0, 3);
    const currentAirportTsa = dedupeLatestTsa(TSAService.normalizeUpdates(tsaUpdates, airportCode), airportCode).slice(0, 3);

    return {
      airportCode,
      airportName: airportInfo.name,
      icao: airportInfo.icao,
      collectedAt: new Date().toISOString(),
      airportStatus: effectiveAirportStatus,
      weather,
      weatherAlerts,
      tsaUpdates: currentAirportTsa,
      headlineAlerts,
      flightBoard: flightBoardResponse.flights,
      operationalSignals: createOperationalSignals(
        effectiveAirportStatus,
        weather,
        weatherAlerts,
        headlineAlerts,
        currentAirportTsa
      ),
    };
  },
};
