import { AlertType } from '../types/alerts';

export const CREW_INTEL_CATEGORIES = [
  { type: AlertType.CATERING, icon: 'restaurant-outline', label: 'Food/Restaurants' },
  { type: AlertType.CREW_ROOM, icon: 'wine-outline', label: 'Lounges/Clubs' },
  { type: AlertType.GATE_TERMINAL, icon: 'trail-sign-outline', label: 'Gates' },
  { type: AlertType.SCHEDULING, icon: 'people-outline', label: 'Airline Check-in' },
  { type: AlertType.GENERAL, icon: 'cart-outline', label: 'Shops' },
  { type: AlertType.MAINTENANCE, icon: 'water-outline', label: 'Restrooms' },
  { type: AlertType.SHUTTLE, icon: 'bus-outline', label: 'Shuttle' },
  { type: AlertType.HOTEL, icon: 'bed-outline', label: 'Hotel' },
  { type: AlertType.SAFETY, icon: 'warning-outline', label: 'Safety' },
  { type: AlertType.TSA_KCM, icon: 'body-outline', label: 'TSA/KCM' },
  { type: AlertType.BAGGAGE, icon: 'bag-handle-outline', label: 'Baggage' },
  { type: AlertType.WEATHER, icon: 'thunderstorm-outline', label: 'Weather' },
  { type: AlertType.PARKING, icon: 'car-outline', label: 'Parking' },
] as const;

export const CREW_INTEL_FILTERS = [
  { type: 'ALL', icon: 'apps-outline', label: 'All' },
  ...CREW_INTEL_CATEGORIES,
] as const;

export const getCrewIntelCategory = (type: AlertType | string) =>
  CREW_INTEL_CATEGORIES.find((category) => category.type === type) ||
  CREW_INTEL_CATEGORIES[CREW_INTEL_CATEGORIES.length - 1];
