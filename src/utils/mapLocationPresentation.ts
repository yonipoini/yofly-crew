import { AppTheme } from '../theme/theme';
import { CrewLocation, LocationType } from '../types/locations';

const TYPE_LABELS: Record<LocationType, string> = {
  [LocationType.RESTAURANT]: 'Crew Meal',
  [LocationType.COFFEE]: 'Coffee Stop',
  [LocationType.GYM]: 'Fitness Reset',
  [LocationType.GROCERY]: 'Stock-Up',
  [LocationType.NIGHTLIFE]: 'Layover Social',
  [LocationType.SAFE_AREA]: 'Safe Spot',
  [LocationType.PHARMACY]: 'Essentials',
  [LocationType.LOUNGE]: 'Quiet Lounge',
  [LocationType.SHOPPING]: 'Shopping',
  [LocationType.SERVICE]: 'Services',
};

const TYPE_HINTS: Record<LocationType, string> = {
  [LocationType.RESTAURANT]: 'Good for a quick crew meal between report windows.',
  [LocationType.COFFEE]: 'Fast caffeine stop when timing is tight.',
  [LocationType.GYM]: 'Best for longer sits or overnight layovers.',
  [LocationType.GROCERY]: 'Useful for commuter snacks and room restocks.',
  [LocationType.NIGHTLIFE]: 'Better for social layovers than short turns.',
  [LocationType.SAFE_AREA]: 'Useful when you want the safest nearby option.',
  [LocationType.PHARMACY]: 'Helpful for meds, essentials, and recovery supplies.',
  [LocationType.LOUNGE]: 'Best when you want a quieter reset.',
  [LocationType.SHOPPING]: 'Good for last-minute gifts and essentials.',
  [LocationType.SERVICE]: 'Useful for ATMs and other travel services.',
};

const getBaseMarkerColor = (theme: AppTheme, type: LocationType) => {
  switch (type) {
    case LocationType.COFFEE:
      return '#7BE7F7';
    case LocationType.GYM:
      return '#6DDE8A';
    case LocationType.SAFE_AREA:
      return '#64E392';
    case LocationType.GROCERY:
      return '#70D4FF';
    case LocationType.PHARMACY:
      return '#8ED8FF';
    case LocationType.LOUNGE:
      return '#FFC86B';
    case LocationType.NIGHTLIFE:
      return '#F35CF9';
    case LocationType.RESTAURANT:
    default:
      return theme.colors.primary;
  }
};

export const getLocationTypeLabel = (type: LocationType) => TYPE_LABELS[type];

export const getLocationContextHint = (location: CrewLocation) =>
  location.crewTip || TYPE_HINTS[location.type];

export const getLocationMarkerColors = (
  theme: AppTheme,
  location: Pick<CrewLocation, 'type' | 'isCrewFavorite' | 'isSaved' | 'airportCore'>
) => {
  const baseColor = getBaseMarkerColor(theme, location.type);

  if (location.isCrewFavorite) {
    return {
      fill: theme.colors.primary,
      border: baseColor,
      halo: theme.colors.primary + '33',
    };
  }

  if (location.isSaved) {
    return {
      fill: baseColor,
      border: theme.colors.primary,
      halo: baseColor + '30',
    };
  }

  if (location.airportCore) {
    return {
      fill: theme.colors.surface,
      border: theme.colors.accent,
      halo: theme.colors.accent + '28',
    };
  }

  return {
    fill: baseColor,
    border: theme.colors.surface,
    halo: baseColor + '24',
  };
};

export const getLocationSourceBadge = (location: Pick<CrewLocation, 'source' | 'isCrewFavorite'>) => {
  if (location.isCrewFavorite) {
    return 'CREW FAV';
  }

  if (location.source === 'airport') {
    return 'AIRPORT OPS';
  }

  if (location.source === 'crew') {
    return 'CREW VERIFIED';
  }

  if (location.source === 'places') {
    return 'LIVE NEARBY';
  }

  return 'AIRPORT PICK';
};
