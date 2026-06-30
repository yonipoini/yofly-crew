export enum AlertType {
  SHUTTLE = 'SHUTTLE',
  HOTEL = 'HOTEL',
  SAFETY = 'SAFETY',
  TSA_KCM = 'TSA_KCM',
  GATE_TERMINAL = 'GATE_TERMINAL',
  CREW_ROOM = 'CREW_ROOM',
  MAINTENANCE = 'MAINTENANCE',
  CATERING = 'CATERING',
  BAGGAGE = 'BAGGAGE',
  WEATHER = 'WEATHER',
  SCHEDULING = 'SCHEDULING',
  PARKING = 'PARKING',
  GENERAL = 'GENERAL',
}

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  location: string;
  latitude?: number;
  longitude?: number;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  userId: string;
  username: string;
  userRole?: 'PILOT' | 'FA' | 'DISPATCH';
  verifications?: number;
  isCritical?: boolean;
  isPrivate?: boolean;
}
