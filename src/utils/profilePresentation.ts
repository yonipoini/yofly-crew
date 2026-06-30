import type { ImageSourcePropType } from 'react-native';
import type { ProfileState } from '../context/ProfileContext';
import { getAirportDisplayName } from './airportContext';

const CAPT_RILEY_SAMPLE_AVATAR = require('../../assets/dallas.png');

const normalize = (value?: string) => (value || '').trim();

export const getProfileAvatarSource = (
  profile: Pick<ProfileState, 'avatarUri' | 'fullName'>
): ImageSourcePropType | null => {
  if (normalize(profile.avatarUri)) {
    return { uri: profile.avatarUri! };
  }

  if (normalize(profile.fullName).toLowerCase().startsWith('capt. riley')) {
    return CAPT_RILEY_SAMPLE_AVATAR;
  }

  return null;
};

export const getFullAirportLabel = (airportCode?: string) => {
  const code = (airportCode || 'JFK').trim().toUpperCase() || 'JFK';
  return `${code} - ${getAirportDisplayName(code)}`;
};

export const getProfileDisplayName = (profile: Pick<ProfileState, 'fullName'>) =>
  normalize(profile.fullName) || 'Crew Member';

export const getProfileDisplayAirline = (profile: Pick<ProfileState, 'airline'>) =>
  normalize(profile.airline) || 'YoFly Crew';

export const getProfileDisplayEmail = (
  profile: Pick<ProfileState, 'workEmail'>,
  userEmail?: string | null
) => normalize(profile.workEmail) || normalize(userEmail || undefined) || 'Work email not added yet';
