import { ProfileState } from '../context/ProfileContext';
import { supabase } from '../lib/supabase';
import { ProfileMediaService } from './ProfileMediaService';
import { CrewVerificationMethod, CrewVerificationStatus } from '../types/verification';
import { EmergencyContact } from '../types/safety';
import { getPrimaryEmergencyPhone, normalizeEmergencyContacts } from '../utils/beaconSOS';
import { runtimeConfig } from '../config/runtime';

const DEFAULT_AIRPORT_CODE = (runtimeConfig.defaultAirportCode || 'JFK').trim().toUpperCase() || 'JFK';

const defaultPreferences: ProfileState['preferences'] = {
  intelPush: true,
  opsPush: true,
  dailyDigest: true,
  layoverChat: true,
  dealsAndPerks: true,
  visibleOnCrewMap: true,
  opsContextMode: 'BASE',
  activeOpsAirport: DEFAULT_AIRPORT_CODE,
  layoverAirport: '',
  tripAirport: '',
  favoriteAirports: [DEFAULT_AIRPORT_CODE],
  preferredAirlines: [],
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: 'PILOT' | 'FA' | 'DISPATCH' | null;
  airline: string | null;
  airline_email: string | null;
  base_airport: string | null;
  aircraft: string | null;
  avatar_url: string | null;
  emergency_contact_phone: string | null;
  is_sos_active: boolean | null;
  verification_airline: string | null;
  verification_status: CrewVerificationStatus | null;
  verification_method: CrewVerificationMethod | null;
  verified_crew: boolean | null;
  verified_marketplace: boolean | null;
  preferences: (Partial<ProfileState['preferences']> & { beaconEmergencyContacts?: EmergencyContact[] }) | null;
};

const mapRoleToDb = (roleLabel: string) => (roleLabel === 'Flight Attendant' ? 'FA' : 'PILOT');
const mapDbRoleToLabel = (role?: string | null) => (role === 'FA' ? 'Flight Attendant' : 'Pilot');
const omitUndefinedValues = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
const normalizeCode = (value?: string | null) => (value || '').trim().toUpperCase();
const isAirportCode = (value?: string | null) => /^[A-Z]{3,4}$/.test(normalizeCode(value));

const normalizePreferencesForBase = (
  preferences: Partial<ProfileState['preferences']> | null | undefined,
  baseAirport: string
): ProfileState['preferences'] => {
  const normalizedBaseAirport = isAirportCode(baseAirport) ? normalizeCode(baseAirport) : DEFAULT_AIRPORT_CODE;
  const opsContextMode = preferences?.opsContextMode || defaultPreferences.opsContextMode;
  const activeOpsAirport =
    opsContextMode === 'BASE'
      ? normalizedBaseAirport
      : isAirportCode(preferences?.activeOpsAirport)
        ? normalizeCode(preferences?.activeOpsAirport)
        : normalizedBaseAirport;
  const layoverAirport = isAirportCode(preferences?.layoverAirport) ? normalizeCode(preferences?.layoverAirport) : '';
  const tripAirport = isAirportCode(preferences?.tripAirport) ? normalizeCode(preferences?.tripAirport) : '';
  const favoriteAirports = Array.from(
    new Set([normalizedBaseAirport, ...(preferences?.favoriteAirports || defaultPreferences.favoriteAirports)])
  )
    .map((airportCode) => normalizeCode(airportCode))
    .filter((airportCode) => isAirportCode(airportCode));

  return {
    ...defaultPreferences,
    ...preferences,
    opsContextMode,
    activeOpsAirport,
    layoverAirport,
    tripAirport,
    favoriteAirports,
    preferredAirlines: Array.from(
      new Set((preferences?.preferredAirlines || defaultPreferences.preferredAirlines).map((code) => normalizeCode(code)).filter(Boolean))
    ),
  };
};

export const ProfileRemoteService = {
  async fetchProfile(userId: string): Promise<Partial<ProfileState> | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, role, airline, airline_email, base_airport, aircraft, avatar_url, emergency_contact_phone, is_sos_active, verification_airline, verification_status, verification_method, verified_crew, verified_marketplace, preferences'
      )
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const preferencePayload = data.preferences || {};
    const { beaconEmergencyContacts, ...cleanPreferences } = preferencePayload;
    const emergencyContacts = normalizeEmergencyContacts(
      beaconEmergencyContacts,
      data.emergency_contact_phone || undefined
    );

    const baseAirport = isAirportCode(data.base_airport) ? normalizeCode(data.base_airport) : undefined;
    const preferences = normalizePreferencesForBase(cleanPreferences, baseAirport || defaultPreferences.activeOpsAirport);

    return omitUndefinedValues({
      fullName: data.full_name || undefined,
      roleLabel: mapDbRoleToLabel(data.role),
      airline: data.airline || undefined,
      workEmail: data.airline_email || undefined,
      baseAirport,
      aircraft: data.aircraft || undefined,
      avatarUri: (await ProfileMediaService.resolveAvatarUrl(data.avatar_url)) || undefined,
      emergencyPhone: getPrimaryEmergencyPhone(emergencyContacts, data.emergency_contact_phone || undefined) || undefined,
      emergencyContacts,
      sosEnabled: Boolean(data.is_sos_active),
      verificationAirline: data.verification_airline || undefined,
      verificationStatus: data.verification_status || undefined,
      verificationMethod: data.verification_method || undefined,
      verifiedCrew: data.verified_crew ?? undefined,
      verifiedMarketplace: data.verified_marketplace ?? undefined,
      preferences,
    } as Partial<ProfileState> & Record<string, unknown>) as Partial<ProfileState>;
  },

  async saveProfile(
    userId: string,
    profile: ProfileState,
    overrides: Partial<Record<string, unknown>> = {}
  ) {
    const baseAirport = isAirportCode(profile.baseAirport) ? normalizeCode(profile.baseAirport) : DEFAULT_AIRPORT_CODE;
    const preferences = normalizePreferencesForBase(profile.preferences, baseAirport);
    const payload = {
      id: userId,
      full_name: profile.fullName,
      role: mapRoleToDb(profile.roleLabel),
      airline: profile.airline,
      airline_email: profile.workEmail || null,
      base_airport: baseAirport,
      aircraft: profile.aircraft,
      avatar_url: profile.avatarUri || null,
      emergency_contact_phone: getPrimaryEmergencyPhone(profile.emergencyContacts, profile.emergencyPhone) || null,
      is_sos_active: profile.sosEnabled,
      verification_airline: profile.verificationAirline || null,
      verification_status: profile.verificationStatus,
      verification_method: profile.verificationMethod || null,
      verified_crew: profile.verifiedCrew,
      verified_marketplace: profile.verifiedMarketplace,
      preferences: {
        ...preferences,
        beaconEmergencyContacts: profile.emergencyContacts,
      },
      ...overrides,
    };

    const { error } = await supabase.from('profiles').upsert(payload);

    if (error) {
      throw error;
    }
  },
};
