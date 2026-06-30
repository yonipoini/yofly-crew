export enum TSAStatus {
  CLEAR = 'CLEAR',
  MODERATE = 'MODERATE',
  BUSY = 'BUSY',
  CRITICAL = 'CRITICAL',
}

export type TSASourceType = 'official' | 'crew' | 'partner' | 'historical';

export interface TSAUpdate {
  airportCode: string;
  terminal: string;
  status: TSAStatus;
  waitTimeMins: number;
  timestamp: string; // ISO string
  reportCount: number;
  sourceType: TSASourceType;
  sourceLabel: string;
  providerId: string;
  confidenceScore: number;
  isFallback: boolean;
}
