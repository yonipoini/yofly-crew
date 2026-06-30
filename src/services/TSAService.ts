import { supabase } from '../lib/supabase';
import { runtimeConfig } from '../config/runtime';
import { TSASourceType, TSAUpdate, TSAStatus } from '../types/tsa';
import { CrewAccessService } from './CrewAccessService';

const CREW_FRESHNESS_WINDOW_MINS = 120;
const DEFAULT_PARTNER_CONFIDENCE = 64;
const UPDATE_CACHE_TTL_MS = 90 * 1000;

type CachedTsaUpdates = {
  expiresAt: number;
  promise?: Promise<TSAUpdate[]>;
  updates?: TSAUpdate[];
};

const updateCache = new Map<string, CachedTsaUpdates>();

type TsaRawInput = {
  airportCode?: string;
  airport_code?: string;
  terminal?: string;
  checkpoint?: string;
  status?: TSAStatus | string;
  waitTimeMins?: number;
  wait_time_mins?: number;
  timestamp?: string;
  observedAt?: string;
  created_at?: string;
  reportCount?: number;
  report_count?: number;
  sourceType?: TSASourceType | string;
  sourceLabel?: string;
  providerId?: string;
  provider?: string;
  confidenceScore?: number;
  confidence_score?: number;
  isFallback?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const deriveStatusFromWait = (waitTimeMins: number): TSAStatus => {
  if (waitTimeMins >= 35) return TSAStatus.CRITICAL;
  if (waitTimeMins >= 20) return TSAStatus.BUSY;
  if (waitTimeMins >= 10) return TSAStatus.MODERATE;
  return TSAStatus.CLEAR;
};

const normalizeSourceType = (value?: string): TSASourceType => {
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

const getSourceLabel = (sourceType: TSASourceType, label?: string) => {
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

const getProviderId = (sourceType: TSASourceType, providerId?: string) => {
  if (providerId?.trim()) return providerId.trim().toLowerCase();

  switch (sourceType) {
    case 'official':
      return 'tsa';
    case 'partner':
      return 'partner';
    case 'historical':
      return 'historical';
    default:
      return 'crew';
  }
};

const getFreshnessMins = (timestamp: string) =>
  Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));

const buildCrewConfidence = (reportCount: number, timestamp: string) => {
  const freshnessPenalty = Math.min(getFreshnessMins(timestamp), CREW_FRESHNESS_WINDOW_MINS) / 8;
  return clamp(Math.round(56 + Math.min(reportCount, 4) * 9 - freshnessPenalty), 36, 96);
};

const normalizeUpdate = (input: TsaRawInput, fallbackAirportCode?: string): TSAUpdate | null => {
  const airportCode = (input.airportCode || input.airport_code || fallbackAirportCode || '').trim().toUpperCase();
  const terminal = String(input.terminal || input.checkpoint || 'Checkpoint').trim();
  const waitTimeMins = Number(input.waitTimeMins ?? input.wait_time_mins);

  if (!airportCode || !Number.isFinite(waitTimeMins)) {
    return null;
  }

  const timestamp = input.timestamp || input.observedAt || input.created_at || new Date().toISOString();
  const sourceType = normalizeSourceType(typeof input.sourceType === 'string' ? input.sourceType : undefined);
  if (sourceType !== 'crew' && waitTimeMins <= 0) {
    return null;
  }
  const reportCount = Math.max(1, Number(input.reportCount ?? input.report_count ?? 1));
  const confidenceScore =
    Number(input.confidenceScore ?? input.confidence_score) ||
    (sourceType === 'crew' ? buildCrewConfidence(reportCount, timestamp) : DEFAULT_PARTNER_CONFIDENCE);

  return {
    airportCode,
    terminal,
    status:
      typeof input.status === 'string' && input.status in TSAStatus
        ? (input.status as TSAStatus)
        : deriveStatusFromWait(waitTimeMins),
    waitTimeMins: Math.max(0, Math.round(waitTimeMins)),
    timestamp,
    reportCount,
    sourceType,
    sourceLabel: getSourceLabel(sourceType, input.sourceLabel),
    providerId: getProviderId(sourceType, input.providerId || input.provider),
    confidenceScore: clamp(Math.round(confidenceScore), 1, 99),
    isFallback:
      typeof input.isFallback === 'boolean'
        ? input.isFallback
        : sourceType === 'partner' || sourceType === 'historical',
  };
};

const scoreUpdate = (update: TSAUpdate) => {
  const sourceWeight: Record<TSASourceType, number> = {
    official: 400,
    crew: 300,
    partner: 200,
    historical: 100,
  };

  const freshnessPenalty = Math.min(getFreshnessMins(update.timestamp), 240) / 4;
  return sourceWeight[update.sourceType] + update.confidenceScore - freshnessPenalty + update.reportCount * 2;
};

const mergeUpdates = (updates: TSAUpdate[]) => {
  const bestByTerminal = new Map<string, TSAUpdate>();

  updates.forEach((update) => {
    const key = `${update.airportCode}-${update.terminal}`.toLowerCase();
    const current = bestByTerminal.get(key);

    if (!current || scoreUpdate(update) > scoreUpdate(current)) {
      bestByTerminal.set(key, update);
    }
  });

  return Array.from(bestByTerminal.values()).sort((left, right) => right.waitTimeMins - left.waitTimeMins);
};

const isExpectedFetchError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '').toLowerCase()
      : '';

  return (
    code === '42P01' ||
    code === 'PGRST116' ||
    code === 'PGRST205' ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('permission denied') ||
    message.includes('jwt')
  );
};

const fetchCrewUpdates = async (airportCode?: string): Promise<TSAUpdate[]> => {
  let query = supabase
    .from('tsa_reports')
    .select('airport_code, terminal, wait_time_mins, status, created_at')
    .order('created_at', { ascending: false })
    .limit(60);

  if (airportCode) {
    query = query.eq('airport_code', airportCode.toUpperCase());
  }

  const { data, error } = await query;

  if (error) {
    if (!isExpectedFetchError(error)) {
      console.warn('TSA crew report fetch failed, continuing without live crew updates:', error);
    }
    return [];
  }

  const grouped = new Map<string, TsaRawInput[]>();
  const freshestAllowed = Date.now() - CREW_FRESHNESS_WINDOW_MINS * 60 * 1000;

  (data || []).forEach((row) => {
    const timestamp = new Date(row.created_at).getTime();
    if (Number.isNaN(timestamp) || timestamp < freshestAllowed) {
      return;
    }

    const key = `${row.airport_code}-${row.terminal}`.toLowerCase();
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.values())
    .map((rows) => {
      const latest = rows[0];
      const averageWait =
        rows.reduce((total, row) => total + Number(row.wait_time_mins || 0), 0) / rows.length;

      return normalizeUpdate(
        {
          airport_code: latest.airport_code,
          terminal: latest.terminal,
          wait_time_mins: averageWait,
          status: latest.status,
          created_at: latest.created_at,
          reportCount: rows.length,
          sourceType: 'crew',
          sourceLabel: 'Crew reports',
          providerId: 'crew',
        },
        airportCode
      );
    })
    .filter((update): update is TSAUpdate => Boolean(update));
};

const parsePartnerPayload = (payload: unknown, airportCode: string): TSAUpdate[] => {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { updates?: unknown[] })?.updates)
    ? ((payload as { updates: unknown[] }).updates || [])
    : [];

  return rows
    .map((row) =>
      normalizeUpdate(
        {
          ...(row as Record<string, unknown>),
          airportCode,
          sourceType: (row as { sourceType?: string }).sourceType || 'partner',
          sourceLabel: (row as { sourceLabel?: string }).sourceLabel || 'Partner estimate',
          providerId: (row as { providerId?: string; provider?: string }).providerId ||
            (row as { provider?: string }).provider ||
            'partner',
          confidenceScore:
            Number((row as { confidenceScore?: number; confidence_score?: number }).confidenceScore) ||
            Number((row as { confidence_score?: number }).confidence_score) ||
            DEFAULT_PARTNER_CONFIDENCE,
          isFallback: Boolean((row as { isFallback?: boolean; is_fallback?: boolean }).isFallback ??
            (row as { is_fallback?: boolean }).is_fallback ??
            true),
        },
        airportCode
      )
    )
    .filter((update): update is TSAUpdate => Boolean(update));
};

const fetchPartnerUpdates = async (airportCode: string): Promise<TSAUpdate[]> => {
  if (runtimeConfig.tsaEstimateEndpoint) {
    try {
      const response = await fetch(
        `${runtimeConfig.tsaEstimateEndpoint}?airportCode=${encodeURIComponent(airportCode)}`
      );

      if (!response.ok) {
        throw new Error(`TSA estimate endpoint failed with ${response.status}`);
      }

      return parsePartnerPayload(await response.json(), airportCode);
    } catch (error) {
      console.warn('Custom TSA estimate endpoint unavailable, trying Supabase function:', error);
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('tsa-estimates', {
      body: { airportCode },
    });

    if (error) {
      throw error;
    }

    return parsePartnerPayload(data || {}, airportCode);
  } catch (error) {
    console.warn('Supabase tsa-estimates function unavailable:', error);
    return [];
  }
};

export const TSAService = {
  /**
   * Fetch latest TSA status for the requested airport, merged across crew and fallback providers.
   */
  async getLatestUpdates(airportCode?: string): Promise<TSAUpdate[]> {
    const normalizedAirportCode = airportCode?.trim().toUpperCase();
    const cacheKey = normalizedAirportCode || 'ALL';
    const cached = updateCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      if (cached.updates) {
        return cached.updates;
      }

      if (cached.promise) {
        return cached.promise;
      }
    }

    const promise = Promise.all([
      fetchCrewUpdates(normalizedAirportCode),
      normalizedAirportCode ? fetchPartnerUpdates(normalizedAirportCode) : Promise.resolve([]),
    ])
      .then(([crewUpdates, partnerUpdates]) => {
        const updates = mergeUpdates([...crewUpdates, ...partnerUpdates]);
        updateCache.set(cacheKey, {
          expiresAt: Date.now() + UPDATE_CACHE_TTL_MS,
          updates,
        });
        return updates;
      })
      .catch((error) => {
        updateCache.delete(cacheKey);
        throw error;
      });

    updateCache.set(cacheKey, {
      expiresAt: now + UPDATE_CACHE_TTL_MS,
      promise,
    });

    return promise;
  },

  normalizeUpdates(rawUpdates: unknown[], fallbackAirportCode?: string): TSAUpdate[] {
    return mergeUpdates(
      (rawUpdates || [])
        .map((update) => normalizeUpdate((update || {}) as TsaRawInput, fallbackAirportCode))
        .filter((update): update is TSAUpdate => Boolean(update))
    );
  },

  /**
   * Submit a new TSA report
   */
  async reportWaitTime(airportCode: string, terminal: string, waitTime: number, status: TSAStatus) {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { error } = await supabase
      .from('tsa_reports')
      .insert({
        reporter_id: user.id,
        airport_code: airportCode,
        terminal,
        wait_time_mins: waitTime,
        status,
      });

    if (error) throw error;
    updateCache.delete(airportCode.trim().toUpperCase());
    updateCache.delete('ALL');
  },

  /**
   * Subscribe to real-time TSA updates
   */
  subscribeToUpdates(onUpdate: (payload: any) => void) {
    return supabase
      .channel('tsa_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tsa_reports' }, onUpdate)
      .subscribe();
  }
};
