import { runtimeConfig } from '../config/runtime';
import { TSAService } from './TSAService';
import { TSASourceType } from '../types/tsa';

export interface AirportStatus {
  airportCode: string;
  faaDelay: boolean;
  faaDelayReason?: string;
  tsaWaitTimeMins: number | null;
  tsaSourceType: TSASourceType;
  tsaSourceLabel: string;
  tsaConfidenceScore: number;
  lastUpdated: string;
}

interface AirportStatusApiResponse {
  faaDelay?: boolean;
  faaDelayReason?: string;
  lastUpdated?: string;
}

export const FlightDataService = {
  getAirportStatus: async (code: string): Promise<AirportStatus> => {
    const tsaUpdates = await TSAService.getLatestUpdates(code);
    const matchingAirportReports = tsaUpdates.filter(
      (update) => update.airportCode === code.toUpperCase() && update.waitTimeMins > 0
    );
    const leadCheckpoint = matchingAirportReports[0];
    const tsaWaitTimeMins =
      matchingAirportReports.length > 0
        ? Math.round(
            matchingAirportReports.reduce((total, update) => total + update.waitTimeMins, 0) /
              matchingAirportReports.length
          )
        : null;

    let faaDelay = false;
    let faaDelayReason: string | undefined;
    let lastUpdated = new Date().toISOString();

    if (runtimeConfig.airportStatusEndpoint) {
      try {
        const response = await fetch(
          `${runtimeConfig.airportStatusEndpoint}?airportCode=${encodeURIComponent(code)}`
        );

        if (response.ok) {
          const payload = (await response.json()) as AirportStatusApiResponse;
          faaDelay = Boolean(payload.faaDelay);
          faaDelayReason = payload.faaDelayReason;
          lastUpdated = payload.lastUpdated || lastUpdated;
        }
      } catch (error) {
        console.warn('Airport status endpoint unavailable, using TSA-only status:', error);
      }
    }

    return {
      airportCode: code,
      faaDelay,
      faaDelayReason,
      tsaWaitTimeMins,
      tsaSourceType: leadCheckpoint?.sourceType || 'historical',
      tsaSourceLabel: leadCheckpoint?.sourceLabel || 'Live unavailable',
      tsaConfidenceScore: leadCheckpoint?.confidenceScore || 0,
      lastUpdated,
    };
  },
};
