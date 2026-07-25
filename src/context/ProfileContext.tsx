import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CrewVerificationMethod, CrewVerificationStatus } from '../types/verification';
import { EmergencyContact } from '../types/safety';
import { supabase } from '../lib/supabase';
import { UserScopedStorage } from '../services/UserScopedStorage';
import { ProfileRemoteService } from '../services/ProfileRemoteService';
import { ScheduleImportService } from '../services/ScheduleImportService';
import { buildFallbackEmergencyContacts, getPrimaryEmergencyPhone, normalizeEmergencyContacts } from '../utils/beaconSOS';
import { runtimeConfig } from '../config/runtime';

export interface ProfilePreferences {
  intelPush: boolean;
  opsPush: boolean;
  dailyDigest: boolean;
  layoverChat: boolean;
  dealsAndPerks: boolean;
  visibleOnCrewMap: boolean;
  opsContextMode: 'BASE' | 'LAYOVER' | 'TRIP' | 'MANUAL';
  activeOpsAirport: string;
  layoverAirport: string;
  tripAirport: string;
  favoriteAirports: string[];
  preferredAirlines: string[];
}

export interface ProfileState {
  fullName: string;
  baseAirport: string;
  aircraft: string;
  roleLabel: string;
  airline: string;
  workEmail: string;
  verificationAirline?: string;
  verificationStatus: CrewVerificationStatus;
  verificationMethod?: CrewVerificationMethod;
  verifiedCrew: boolean;
  verifiedMarketplace: boolean;
  avatarUri?: string;
  emergencyPhone: string;
  emergencyContacts: EmergencyContact[];
  sosEnabled: boolean;
  preferences: ProfilePreferences;
}

type ProfileMergeInput = Partial<Omit<ProfileState, 'preferences'>> & {
  preferences?: Partial<ProfilePreferences>;
};

interface ProfileContextValue {
  profile: ProfileState;
  isReady: boolean;
  lastLocalWriteAt: number;
  updateProfile: (next: ProfileState) => void;
  mergeProfile: (next: ProfileMergeInput, options?: { source?: 'local' | 'remote' }) => void;
  resetProfile: () => void;
}

const STORAGE_KEY = 'yofly.profile';

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

const isAirportCode = (value: string) => /^[A-Z]{3,4}$/.test(normalizeCode(value));
const DEFAULT_AIRPORT_CODE = normalizeCode(runtimeConfig.defaultAirportCode) || 'JFK';

const normalizeList = (values: string[] | undefined, fallback: string[] = []) =>
  Array.from(
    new Set(
      [...(values || []), ...fallback]
        .map((value) => normalizeCode(value))
        .filter((value) => value.length > 0)
    )
  );

const normalizeProfile = (profile: ProfileState): ProfileState => {
  const baseAirport = normalizeCode(profile.baseAirport || DEFAULT_AIRPORT_CODE) || DEFAULT_AIRPORT_CODE;
  const opsContextMode = profile.preferences.opsContextMode || 'BASE';
  const activeOpsAirport = isAirportCode(profile.preferences.activeOpsAirport || '')
    ? normalizeCode(profile.preferences.activeOpsAirport || baseAirport)
    : baseAirport;
  const layoverAirport = isAirportCode(profile.preferences.layoverAirport || '')
    ? normalizeCode(profile.preferences.layoverAirport || '')
    : '';
  const tripAirport = isAirportCode(profile.preferences.tripAirport || '')
    ? normalizeCode(profile.preferences.tripAirport || '')
    : '';
  const emergencyContacts = normalizeEmergencyContacts(profile.emergencyContacts, profile.emergencyPhone);
  const emergencyPhone = getPrimaryEmergencyPhone(emergencyContacts, profile.emergencyPhone);

  return {
    ...profile,
    baseAirport,
    emergencyPhone,
    emergencyContacts,
    preferences: {
      ...profile.preferences,
      opsContextMode,
      activeOpsAirport: opsContextMode === 'BASE' ? baseAirport : activeOpsAirport,
      layoverAirport,
      tripAirport,
      favoriteAirports: normalizeList(profile.preferences.favoriteAirports, [baseAirport]).filter((code) =>
        isAirportCode(code)
      ),
      preferredAirlines: normalizeList(profile.preferences.preferredAirlines),
    },
  };
};

const defaultProfile: ProfileState = {
  fullName: '',
  baseAirport: DEFAULT_AIRPORT_CODE,
  aircraft: 'B737',
  roleLabel: 'Pilot',
  airline: 'YoFly Crew',
  workEmail: '',
  verificationAirline: 'YoFly Crew',
  verificationStatus: CrewVerificationStatus.UNVERIFIED,
  verificationMethod: undefined,
  verifiedCrew: false,
  verifiedMarketplace: false,
  emergencyPhone: '',
  emergencyContacts: [],
  sosEnabled: false,
  preferences: {
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
    favoriteAirports: [DEFAULT_AIRPORT_CODE, 'MIA', 'LAX'],
    preferredAirlines: ['B6'],
  },
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const getStorageOptions = (activeUserId: string | null) => ({
  userId: activeUserId ?? undefined,
});

const omitUndefinedValues = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const LOCAL_WRITE_GUARD_MS = 5000;

export const ProfileProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileState>(defaultProfile);
  const [isReady, setIsReady] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [lastLocalWriteAt, setLastLocalWriteAt] = useState(0);
  const lastLocalWriteAtRef = useRef(0);

  useEffect(() => {
    let active = true;

    const loadForUser = async (userId?: string | null) => {
      const nextUserId = userId || null;
      const localWriteIsSettling = () => Date.now() - lastLocalWriteAtRef.current < LOCAL_WRITE_GUARD_MS;

      setActiveUserId(nextUserId);

      try {
        const storedProfile = await UserScopedStorage.getItem(STORAGE_KEY, { userId });
        const importedSchedule = await ScheduleImportService.getImportedSchedule(userId);

        if (storedProfile) {
          const parsed = JSON.parse(storedProfile) as Partial<ProfileState>;
          if (!active) {
            return;
          }

          if (localWriteIsSettling()) {
            return;
          }

          const nextProfile = normalizeProfile({
            ...defaultProfile,
            ...parsed,
            preferences: {
              ...defaultProfile.preferences,
              ...parsed.preferences,
            },
          });

          if (localWriteIsSettling()) {
            return;
          }

          setProfile(importedSchedule?.active ? normalizeProfile(ScheduleImportService.applyImportedSchedule(nextProfile, importedSchedule)) : nextProfile);
        } else if (active && !localWriteIsSettling()) {
          setProfile(
            importedSchedule?.active
              ? normalizeProfile(ScheduleImportService.applyImportedSchedule(defaultProfile, importedSchedule))
              : defaultProfile
          );
        }

        if (userId && active) {
          void ProfileRemoteService.fetchProfile(userId)
            .then((remoteProfile) => {
              if (remoteProfile && active) {
                setProfile((current) => {
                  if (localWriteIsSettling()) {
                    return current;
                  }
                  const merged = normalizeProfile({
                    ...current,
                    ...remoteProfile,
                    preferences: {
                      ...current.preferences,
                      ...remoteProfile.preferences,
                    },
                  });
                  UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(merged), { userId }).catch((err) => {
                    console.warn('Failed to save background-fetched profile:', err);
                  });
                  return merged;
                });
              }
            })
            .catch((err) => {
              console.warn('Failed to background-fetch remote profile:', err);
            });
        }
      } catch (error) {
        console.warn('Profile storage unavailable, using session defaults:', error);
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    };

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await loadForUser(session?.user?.id || null);
    };

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadForUser(session?.user?.id || null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const updateProfile = (next: ProfileState) => {
    const normalized = normalizeProfile(next);
    lastLocalWriteAtRef.current = Date.now();
    setLastLocalWriteAt(lastLocalWriteAtRef.current);
    setProfile(normalized);
    UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(normalized), getStorageOptions(activeUserId)).catch((error) => {
      console.warn('Failed to persist profile state:', error);
    });
  };

  const mergeProfile = (next: ProfileMergeInput, options: { source?: 'local' | 'remote' } = {}) => {
    const isRemoteMerge = options.source === 'remote';

    if (!isRemoteMerge) {
      lastLocalWriteAtRef.current = Date.now();
      setLastLocalWriteAt(lastLocalWriteAtRef.current);
    }

    setProfile((current) => {
      const { preferences, ...profileFields } = next;
      const merged = normalizeProfile({
        ...current,
        ...omitUndefinedValues(profileFields),
        preferences: {
          ...current.preferences,
          ...omitUndefinedValues((preferences || {}) as Record<string, unknown>),
        },
      });

      UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(merged), getStorageOptions(activeUserId)).catch((error) => {
        console.warn('Failed to persist profile state:', error);
      });

      return merged;
    });
  };

  const resetProfile = () => {
    lastLocalWriteAtRef.current = Date.now();
    setLastLocalWriteAt(lastLocalWriteAtRef.current);
    setProfile(defaultProfile);
    UserScopedStorage.removeItem(STORAGE_KEY, getStorageOptions(activeUserId)).catch((error) => {
      console.warn('Failed to reset profile state:', error);
    });
  };

  const value = useMemo(
    () => ({
      profile,
      isReady,
      lastLocalWriteAt,
      updateProfile,
      mergeProfile,
      resetProfile,
    }),
    [isReady, lastLocalWriteAt, profile]
  );

  return (
    <ProfileContext.Provider
      value={value}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }

  return context;
};
