import { ProfileState } from '../context/ProfileContext';
import { runtimeConfig } from '../config/runtime';

const normalizeCode = (value: string) => value.trim().toUpperCase();
const isAirportCode = (value: string) => /^[A-Z]{3,4}$/.test(normalizeCode(value));
const getFallbackAirportCode = () => normalizeCode(runtimeConfig.defaultAirportCode || 'JFK') || 'JFK';

export const syncProfileAirportSelection = (
  profile: ProfileState,
  nextBaseAirport: string,
  previousBaseAirport?: string
): ProfileState => {
  const normalizedCandidateBase = normalizeCode(nextBaseAirport || '');
  const normalizedBaseAirport = isAirportCode(normalizedCandidateBase)
    ? normalizedCandidateBase
    : normalizeCode(profile.baseAirport || getFallbackAirportCode()) || getFallbackAirportCode();
  const priorBaseAirport = normalizeCode(previousBaseAirport || profile.baseAirport || normalizedBaseAirport);
  const nextFavoriteAirports = Array.from(
    new Set(
      [normalizedBaseAirport, ...profile.preferences.favoriteAirports]
        .map((airportCode) => normalizeCode(airportCode))
        .filter((airportCode) => isAirportCode(airportCode))
    )
  );

  const shouldFollowBaseAirport =
    profile.preferences.opsContextMode === 'BASE' ||
    !profile.preferences.activeOpsAirport ||
    normalizeCode(profile.preferences.activeOpsAirport) === priorBaseAirport;

  return {
    ...profile,
    baseAirport: normalizedBaseAirport,
    preferences: {
      ...profile.preferences,
      activeOpsAirport: shouldFollowBaseAirport
        ? normalizedBaseAirport
        : isAirportCode(profile.preferences.activeOpsAirport || '')
          ? normalizeCode(profile.preferences.activeOpsAirport || normalizedBaseAirport)
          : normalizedBaseAirport,
      favoriteAirports: nextFavoriteAirports,
    },
  };
};
