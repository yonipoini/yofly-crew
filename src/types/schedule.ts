export interface ImportedScheduleLeg {
  id: string;
  date?: string;
  reportTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightNumber?: string;
  departureAirport: string;
  arrivalAirport: string;
  rawText?: string;
  isDeadhead?: boolean;
  sourceEventId?: string;
}

export interface ImportedScheduleSourceDetails {
  platform: 'ios' | 'android' | 'web' | 'unknown';
  kind: 'screenshot' | 'calendar';
  label?: string;
  calendarId?: string;
  calendarTitle?: string;
  calendarSource?: string;
  calendarOwner?: string;
  eventIds?: string[];
  importWindowStart?: string;
  importWindowEnd?: string;
}

export interface ImportedSchedule {
  id: string;
  source: 'screenshot' | 'calendar';
  importedAt: string;
  timezone: string;
  imageUri?: string;
  rawText?: string;
  rawSummary?: string;
  airlineHint?: string;
  active: boolean;
  legs: ImportedScheduleLeg[];
  sourceDetails?: ImportedScheduleSourceDetails;
}

export interface DerivedScheduleContext {
  mode: 'TRIP' | 'LAYOVER';
  activeAirport: string;
  tripAirport: string;
  layoverAirport: string;
  favoriteAirports: string[];
  activeLegId?: string;
  summary: string;
}
