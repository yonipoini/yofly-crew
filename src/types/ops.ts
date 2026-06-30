import type { Alert } from './alerts';
import type { TSAUpdate } from './tsa';
import type { AviationWeather, WeatherAlert } from './weather';
import type { AirportStatus } from '../services/FlightDataService';

export type OpsUrgency = 'normal' | 'watch' | 'critical';

export interface OpsSignal {
  id: string;
  label: string;
  value: string;
  urgency: OpsUrgency;
  detail: string;
}

export interface FlightBoardEntry {
  id: string;
  flightNumber: string;
  route: string;
  scheduledTime: string;
  movementType: 'departure' | 'arrival';
  statusLabel: string;
  gate?: string;
  terminal?: string;
  urgency: OpsUrgency;
  detail?: string;
  source: 'live' | 'fallback';
}

export interface CrewOpsSnapshot {
  airportCode: string;
  airportName: string;
  icao: string;
  collectedAt: string;
  airportStatus: AirportStatus;
  weather: AviationWeather;
  weatherAlerts: WeatherAlert[];
  tsaUpdates: TSAUpdate[];
  headlineAlerts: Alert[];
  flightBoard: FlightBoardEntry[];
  operationalSignals: OpsSignal[];
}
