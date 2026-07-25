export enum LocationType {
  RESTAURANT = 'RESTAURANT',
  COFFEE = 'COFFEE',
  GYM = 'GYM',
  GROCERY = 'GROCERY',
  NIGHTLIFE = 'NIGHTLIFE',
  SAFE_AREA = 'SAFE_AREA',
  PHARMACY = 'PHARMACY',
  LOUNGE = 'LOUNGE',
  SHOPPING = 'SHOPPING',
  SERVICE = 'SERVICE',
}

export type LocationSource = 'crew' | 'places' | 'fallback' | 'airport';
export type AirportCoreKind =
  | 'TERMINAL'
  | 'SECURITY'
  | 'GROUND'
  | 'SHUTTLE'
  | 'LOUNGE'
  | 'BAGGAGE'
  | 'COFFEE';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CrewLocation {
  id: string;
  name: string;
  type: LocationType;
  airportCode?: string;
  coordinate: Coordinates;
  rating: number;
  reviewCount: number;
  isCrewFavorite: boolean;
  address: string;
  source: LocationSource;
  googlePlaceId?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  phoneNumber?: string;
  businessStatus?: string;
  priceLevel?: string;
  primaryTypeDisplayName?: string;
  currentOpeningHoursText?: string[];
  distanceFromHotel?: string;
  imageUrl?: string;
  isSaved?: boolean;
  crewTip?: string;
  recommendedFor?: string;
  routeHint?: string;
  categoryHeadline?: string;
  categorySummary?: string;
  bestWindow?: string;
  routeContext?: string;
  crewTags?: string[];
  pilotTip?: string;
  flightAttendantTip?: string;
  airportCore?: boolean;
  airportCoreKind?: AirportCoreKind;
  shortLabel?: string;
  level?: string;
  zone?: string;
  x?: number;
  y?: number;
  crewIntelCount?: number;
  crewIntelSummary?: string;
  crewDealLabel?: string;
  isRouteSaved?: boolean;
  tags?: string[];
  description?: string;
  cuisine?: string;
}

export interface CrewSavedRoute {
  id: string;
  airportCode: string;
  locationId: string;
  destinationName: string;
  destinationType: LocationType;
  destinationAddress: string;
  coordinate: Coordinates;
  routeHint?: string;
  categorySummary?: string;
  savedAt: string;
}
