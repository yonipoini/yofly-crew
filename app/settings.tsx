import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { ProfileState, useProfile } from '../src/context/ProfileContext';
import { SOSManager } from '../src/services/SOSManager';
import { CrewVerificationService } from '../src/services/CrewVerificationService';
import { CrewVerificationStatus } from '../src/types/verification';
import { AirportSearchService } from '../src/services/AirportSearchService';
import { AppSyncService } from '../src/services/AppSyncService';
import { ProfileMediaService } from '../src/services/ProfileMediaService';
import { NotificationService } from '../src/services/NotificationService';
import { getEmergencyContactCountLabel, getPrimaryEmergencyPhone, normalizeEmergencyContacts } from '../src/utils/beaconSOS';
import { syncProfileAirportSelection } from '../src/utils/profileAirportSync';
import {
  getFullAirportLabel,
  getProfileAvatarSource,
  getProfileDisplayName,
} from '../src/utils/profilePresentation';

const FLIGHT_CREW_ROLE_OPTIONS = ['Pilot', 'Flight Attendant'] as const;
const AIRLINE_PRESETS = [
  'JetBlue Airways',
  'Delta Air Lines',
  'American Airlines',
  'United Airlines',
  'Southwest Airlines',
  'Alaska Airlines',
] as const;
const BASE_AIRPORT_PRESETS = ['JFK', 'MIA', 'LAX', 'ATL', 'DFW', 'ORD'] as const;
const OPS_CONTEXT_OPTIONS: Array<{
  value: ProfileState['preferences']['opsContextMode'];
  label: string;
}> = [
  { value: 'BASE', label: 'Base' },
  { value: 'LAYOVER', label: 'Layover' },
  { value: 'TRIP', label: 'Trip' },
  { value: 'MANUAL', label: 'Manual' },
] as const;
const formatPreferenceCodes = (values: string[]) => values.join(', ');
const parsePreferenceCodes = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );

const buildSubtitle = (profile: ProfileState) =>
  [profile.baseAirport ? `${profile.baseAirport} Base` : 'Base pending', profile.roleLabel]
    .filter(Boolean)
    .join(' • ');

const waitForUiCommit = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const normalizeAirportSearchInput = (value: string) => {
  const trimmed = value.trim();

  if (/^[a-z]{1,4}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return value;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { signOut, deleteAccount, saveProfileToRemote, isAdmin, isSubmitting, user } = useAuth();
  const { profile, updateProfile, mergeProfile } = useProfile();
  const [draft, setDraft] = useState<ProfileState>(profile);
  const [baseAirportQuery, setBaseAirportQuery] = useState(profile.baseAirport);
  const [selectedBaseAirport, setSelectedBaseAirport] = useState(() =>
    AirportSearchService.resolveUsAirport(profile.baseAirport)
  );
  const [layoverAirportQuery, setLayoverAirportQuery] = useState(profile.preferences.layoverAirport);
  const [tripAirportQuery, setTripAirportQuery] = useState(profile.preferences.tripAirport);
  const [manualAirportQuery, setManualAirportQuery] = useState(profile.preferences.activeOpsAirport);
  const [favoriteHubQuery, setFavoriteHubQuery] = useState('');
  const [isApplyingBaseAirport, setIsApplyingBaseAirport] = useState(false);
  const isApplyingBaseAirportRef = useRef(false);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [baseAirportDebug, setBaseAirportDebug] = useState('');
  const [confirmedBaseAirportCode, setConfirmedBaseAirportCode] = useState('');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const webButtonStyle = useMemo(
    () => ({
      border: `1px solid ${theme.colors.border}`,
      borderRadius: 999,
      background: theme.colors.background,
      color: theme.colors.text,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 800,
      minWidth: 68,
      padding: '10px 14px',
    }),
    [theme]
  );
  const webButtonActiveStyle = useMemo(
    () => ({
      ...webButtonStyle,
      background: theme.colors.primary,
      borderColor: theme.colors.primary,
      color: theme.colors.background,
    }),
    [theme, webButtonStyle]
  );
  const webApplyButtonStyle = useMemo(
    () => ({
      ...webButtonActiveStyle,
      width: '100%',
      padding: '13px 16px',
    }),
    [webButtonActiveStyle]
  );
  const avatarSource = getProfileAvatarSource(draft);
  const displayName = getProfileDisplayName(draft);
  const selectedBaseAirportCode =
    AirportSearchService.resolveUsAirportInput(baseAirportQuery)?.code || selectedBaseAirport?.code || draft.baseAirport;
  const fullBaseLabel = getFullAirportLabel(selectedBaseAirportCode);
  const baseAirportResults = useMemo(
    () => AirportSearchService.searchUsAirports(baseAirportQuery, 5),
    [baseAirportQuery]
  );
  const layoverAirportResults = useMemo(
    () => AirportSearchService.searchUsAirports(layoverAirportQuery, 5),
    [layoverAirportQuery]
  );
  const tripAirportResults = useMemo(
    () => AirportSearchService.searchUsAirports(tripAirportQuery, 5),
    [tripAirportQuery]
  );
  const manualAirportResults = useMemo(
    () => AirportSearchService.searchUsAirports(manualAirportQuery, 5),
    [manualAirportQuery]
  );
  const favoriteHubResults = useMemo(
    () =>
      AirportSearchService.searchUsAirports(favoriteHubQuery, 5).filter(
        (airport) => !draft.preferences.favoriteAirports.includes(airport.code)
      ),
    [draft.preferences.favoriteAirports, favoriteHubQuery]
  );

  const verificationColor =
    draft.verificationStatus === CrewVerificationStatus.VERIFIED_CREW
      ? theme.colors.success
      : draft.verificationStatus === CrewVerificationStatus.PENDING_EMAIL
        ? theme.colors.accent
        : draft.verificationStatus === CrewVerificationStatus.PENDING_MANUAL
          ? '#FF9500'
          : draft.verificationStatus === CrewVerificationStatus.REJECTED
            ? theme.colors.error
            : theme.colors.textMuted;

  const updateField = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
    setHasLocalEdits(true);
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const commitBaseAirportSelection = async (
    airportCode: string,
    options: { showConfirmation?: boolean } = {}
  ) => {
    const airport = AirportSearchService.resolveUsAirport(airportCode);

    if (!airport) {
      Alert.alert('Choose A Real Base', 'Pick a real airport from the search suggestions first.');
      return;
    }

    const nextProfile = syncProfileAirportSelection(profile, airport.code, profile.baseAirport);

    setIsApplyingBaseAirport(true);
    isApplyingBaseAirportRef.current = true;

    setDraft((current) => syncProfileAirportSelection(current, airport.code, current.baseAirport));
    setBaseAirportQuery(airport.code);
    setSelectedBaseAirport(airport);
    setConfirmedBaseAirportCode(airport.code);
    setBaseAirportDebug(`saved local ${airport.code}`);
    mergeProfile({
      baseAirport: nextProfile.baseAirport,
      preferences: nextProfile.preferences,
    });
    if (typeof globalThis.localStorage !== 'undefined') {
      const serializedProfile = JSON.stringify(nextProfile);
      globalThis.localStorage.setItem('yofly.profile', serializedProfile);
      if (user?.id) {
        globalThis.localStorage.setItem(`yofly.profile:${user.id}`, serializedProfile);
      }
    }
    AppSyncService.emit('profile');

    try {
      await saveProfileToRemote(nextProfile);
      setBaseAirportDebug(`saved ${airport.code}`);
      if (options.showConfirmation) {
        Alert.alert('Base Airport Updated', `${airport.code} is now your active home base in the app.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync the base airport to Supabase.';
      setBaseAirportDebug(`saved local ${airport.code}; remote sync failed`);
      console.warn('Base airport remote sync failed:', message);
    } finally {
      isApplyingBaseAirportRef.current = false;
      setIsApplyingBaseAirport(false);
    }
  };

  const commitResolvedBaseAirport = (options: { showConfirmation?: boolean } = {}) => {
    const resolvedBaseAirport =
      AirportSearchService.resolveUsAirportInput(baseAirportQuery) ||
      selectedBaseAirport ||
      AirportSearchService.resolveUsAirportInput(draft.baseAirport);

    if (!resolvedBaseAirport) {
      Alert.alert('Choose A Real Base', 'Pick a real airport from the search suggestions first.');
      return;
    }

    void commitBaseAirportSelection(resolvedBaseAirport.code, options);
  };

  useEffect(() => {
    if (hasLocalEdits || isApplyingBaseAirport) {
      return;
    }

    if (confirmedBaseAirportCode) {
      if (profile.baseAirport !== confirmedBaseAirportCode) {
        const confirmedAirport = AirportSearchService.resolveUsAirport(confirmedBaseAirportCode);

        setDraft((current) =>
          current.baseAirport === confirmedBaseAirportCode
            ? current
            : syncProfileAirportSelection(current, confirmedBaseAirportCode, current.baseAirport)
        );
        setBaseAirportQuery(confirmedBaseAirportCode);
        setSelectedBaseAirport(confirmedAirport);
        setBaseAirportDebug(
          `confirmed ${confirmedBaseAirportCode}; waiting for profile ${profile.baseAirport || 'blank'}`
        );
        return;
      }

      setConfirmedBaseAirportCode('');
    }

    setDraft(profile);
    setBaseAirportQuery(profile.baseAirport);
    setSelectedBaseAirport(AirportSearchService.resolveUsAirport(profile.baseAirport));
    setBaseAirportDebug('');
    setLayoverAirportQuery(profile.preferences.layoverAirport);
    setTripAirportQuery(profile.preferences.tripAirport);
    setManualAirportQuery(profile.preferences.activeOpsAirport);
  }, [confirmedBaseAirportCode, hasLocalEdits, isApplyingBaseAirport, profile]);

  const handleBaseAirportChange = (value: string) => {
    const nextQuery = normalizeAirportSearchInput(value);

    setHasLocalEdits(true);
    setConfirmedBaseAirportCode('');
    setBaseAirportQuery(nextQuery);

    const resolvedAirport = AirportSearchService.resolveUsAirport(nextQuery);
    setSelectedBaseAirport(resolvedAirport);

    if (resolvedAirport) {
      setDraft((current) => syncProfileAirportSelection(current, resolvedAirport.code, current.baseAirport));
    }
  };

  const applyConfirmedProfileState = (
    localProfile: ProfileState,
    savedProfile: Partial<ProfileState> | null | undefined,
    baseAirportCode: string
  ) => {
    const confirmedProfile = syncProfileAirportSelection(
      {
        ...localProfile,
        ...savedProfile,
        preferences: {
          ...localProfile.preferences,
          ...savedProfile?.preferences,
        },
      },
      baseAirportCode,
      localProfile.baseAirport
    );

    updateProfile(confirmedProfile);
    setConfirmedBaseAirportCode(baseAirportCode);
    setDraft(confirmedProfile);
    setBaseAirportQuery(baseAirportCode);
    setSelectedBaseAirport(AirportSearchService.resolveUsAirport(baseAirportCode));
    setLayoverAirportQuery(confirmedProfile.preferences.layoverAirport);
    setTripAirportQuery(confirmedProfile.preferences.tripAirport);
    setManualAirportQuery(confirmedProfile.preferences.activeOpsAirport);
    setHasLocalEdits(false);
    return confirmedProfile;
  };

  const updatePreference = (key: keyof ProfileState['preferences'], value: boolean) => {
    setHasLocalEdits(true);
    setDraft((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  };

  const updatePreferenceValue = <K extends keyof ProfileState['preferences']>(
    key: K,
    value: ProfileState['preferences'][K]
  ) => {
    setHasLocalEdits(true);
    setDraft((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  };

  const handleSelectBaseAirport = (airportCode: string) => {
    const airport = AirportSearchService.resolveUsAirport(airportCode);

    if (!airport) {
      return;
    }

    setHasLocalEdits(true);
    setConfirmedBaseAirportCode('');
    setSelectedBaseAirport(airport);
    setBaseAirportQuery(airport.code);
    setBaseAirportDebug(`selected ${airport.code} from picker`);
    setDraft((current) => syncProfileAirportSelection(current, airport.code, current.baseAirport));
    void commitBaseAirportSelection(airport.code);
  };

  const handleApplyBaseAirport = async () => {
    const resolvedBaseAirport =
      AirportSearchService.resolveUsAirportInput(baseAirportQuery) ||
      selectedBaseAirport ||
      AirportSearchService.resolveUsAirportInput(draft.baseAirport);

    if (!resolvedBaseAirport) {
      Alert.alert('Choose A Real Base', 'Pick a real airport from the search suggestions first.');
      return;
    }

    await commitBaseAirportSelection(resolvedBaseAirport.code, { showConfirmation: true });
  };

  const handleSelectOpsContextMode = (mode: ProfileState['preferences']['opsContextMode']) => {
    setHasLocalEdits(true);
    setDraft((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        opsContextMode: mode,
        activeOpsAirport:
          mode === 'BASE'
            ? current.baseAirport
            : mode === 'MANUAL'
              ? (current.preferences.activeOpsAirport || current.baseAirport).toUpperCase()
              : current.preferences.activeOpsAirport,
      },
    }));
  };

  const handleSelectContextAirport = (
    key: 'layoverAirport' | 'tripAirport' | 'activeOpsAirport',
    airportCode: string
  ) => {
    if (key === 'layoverAirport') {
      setLayoverAirportQuery(airportCode);
    }
    if (key === 'tripAirport') {
      setTripAirportQuery(airportCode);
    }
    if (key === 'activeOpsAirport') {
      setManualAirportQuery(airportCode);
    }

    updatePreferenceValue(key, airportCode);
  };

  const handleAddFavoriteHub = (airportCode: string) => {
    updatePreferenceValue(
      'favoriteAirports',
      Array.from(new Set([draft.baseAirport, ...draft.preferences.favoriteAirports, airportCode]))
    );
    setFavoriteHubQuery('');
  };

  const handleRemoveFavoriteHub = (airportCode: string) => {
    const nextFavoriteAirports = draft.preferences.favoriteAirports.filter((code) => code !== airportCode);
    updatePreferenceValue(
      'favoriteAirports',
      nextFavoriteAirports.length > 0 ? nextFavoriteAirports : [draft.baseAirport]
    );
  };

  const renderAirportSuggestions = (
    results: ReturnType<typeof AirportSearchService.searchUsAirports>,
    selectedAirportCode: string,
    onSelect: (airportCode: string) => void
  ) => {
    if (!results.length) {
      return null;
    }

    return (
      <View style={styles.suggestionsWrap}>
        {results.map((airport) => {
          const selected = airport.code === selectedAirportCode;
          return (
            <TouchableOpacity
              key={airport.code}
              style={[styles.suggestionRow, selected && styles.suggestionRowSelected]}
              onPress={() => onSelect(airport.code)}
            >
              <View style={styles.suggestionCodeWrap}>
                <Text style={styles.suggestionCode}>{airport.code}</Text>
              </View>
              <Text style={styles.suggestionName} numberOfLines={1}>
                {airport.name}
              </Text>
              {selected ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo Permission', 'Allow photo access to update your crew profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateField('avatarUri', result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (isApplyingBaseAirportRef.current) {
      return;
    }

    const resolvedBaseAirport =
      AirportSearchService.resolveUsAirportInput(baseAirportQuery) ||
      selectedBaseAirport ||
      AirportSearchService.resolveUsAirportInput(draft.baseAirport);
    const resolvedLayoverAirport =
      draft.preferences.layoverAirport
        ? AirportSearchService.resolveUsAirport(draft.preferences.layoverAirport)
        : null;
    const resolvedTripAirport =
      draft.preferences.tripAirport ? AirportSearchService.resolveUsAirport(draft.preferences.tripAirport) : null;
    const resolvedManualAirport =
      draft.preferences.activeOpsAirport
        ? AirportSearchService.resolveUsAirport(draft.preferences.activeOpsAirport)
        : null;

    if (!resolvedBaseAirport) {
      Alert.alert('Choose A Real Base', 'Select a valid base airport from the airport search suggestions.');
      return;
    }

    if (draft.preferences.opsContextMode === 'LAYOVER' && !resolvedLayoverAirport) {
      Alert.alert('Choose A Layover Airport', 'Pick a real layover airport before saving that ops context.');
      return;
    }

    if (draft.preferences.opsContextMode === 'TRIP' && !resolvedTripAirport) {
      Alert.alert('Choose A Trip Airport', 'Pick a real trip airport before saving that ops context.');
      return;
    }

    if (draft.preferences.opsContextMode === 'MANUAL' && !resolvedManualAirport) {
      Alert.alert('Choose An Active Hub', 'Pick a real manual ops airport before saving that context.');
      return;
    }

    const emergencyContacts = normalizeEmergencyContacts(draft.emergencyContacts, draft.emergencyPhone);
    const primaryEmergencyPhone = getPrimaryEmergencyPhone(emergencyContacts, draft.emergencyPhone);

    if (draft.sosEnabled && !primaryEmergencyPhone) {
      Alert.alert('Missing Contact', 'Add at least one Beacon emergency contact before enabling SOS mode.');
      return;
    }

    try {
      let remoteAvatarUri = draft.avatarUri;
      let localAvatarUri = draft.avatarUri;

      if (user?.id && remoteAvatarUri && !remoteAvatarUri.startsWith('http') && !remoteAvatarUri.startsWith('avatars/')) {
        remoteAvatarUri = await ProfileMediaService.uploadAvatar(user.id, remoteAvatarUri);
        localAvatarUri = (await ProfileMediaService.resolveAvatarUrl(remoteAvatarUri)) || remoteAvatarUri;
      }

      const remoteDraft = syncProfileAirportSelection(
        {
          ...draft,
          avatarUri: remoteAvatarUri,
          emergencyPhone: primaryEmergencyPhone,
          emergencyContacts,
          baseAirport: resolvedBaseAirport.code,
          preferences: {
            ...draft.preferences,
            layoverAirport: resolvedLayoverAirport?.code || '',
            tripAirport: resolvedTripAirport?.code || '',
            activeOpsAirport:
              draft.preferences.opsContextMode === 'BASE'
                ? resolvedBaseAirport.code
                : resolvedManualAirport?.code || draft.preferences.activeOpsAirport,
          },
        },
        resolvedBaseAirport.code,
        profile.baseAirport
      );
      const localDraft = {
        ...remoteDraft,
        avatarUri: localAvatarUri,
      };
      updateProfile(localDraft);
      setBaseAirportQuery(resolvedBaseAirport.code);
      setLayoverAirportQuery(localDraft.preferences.layoverAirport);
      setTripAirportQuery(localDraft.preferences.tripAirport);
      setManualAirportQuery(localDraft.preferences.activeOpsAirport);
      setDraft(localDraft);
      await waitForUiCommit();
      await saveProfileToRemote(remoteDraft);
      applyConfirmedProfileState(localDraft, null, resolvedBaseAirport.code);
      if (user?.id) {
        await NotificationService.syncExistingSubscription(user.id, localDraft);
      }
      AppSyncService.emit('profile');
      SOSManager.setContacts(localDraft.emergencyContacts);

      if (localDraft.sosEnabled) {
        SOSManager.startSOS();
      } else {
        SOSManager.stopSOS();
      }

      Alert.alert('Settings Updated', 'Your profile and crew preferences were updated.');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync settings to Supabase.';
      Alert.alert('Save Failed', message);
    }
  };

  const handleCheckWorkEmail = async () => {
    const result = await CrewVerificationService.checkAirlineEmail(draft.workEmail, draft.roleLabel);

    setDraft((current) => ({
      ...current,
      workEmail: result.normalizedEmail,
      verificationAirline: result.airlineName ?? current.verificationAirline,
      verificationMethod: result.suggestedMethod,
      verificationStatus: result.suggestedStatus,
      verifiedCrew: false,
      verifiedMarketplace: false,
      airline:
        result.airlineName && (!current.airline || current.airline === 'YoFly Crew')
          ? result.airlineName
          : current.airline,
    }));

    if (result.matched) {
      Alert.alert(
        'Domain Matched',
        `${result.airlineName} is on the approved domain list. Use this work email for crew account signup or sign-in.`
      );
      return;
    }

    Alert.alert('Manual Review Backup', result.reason || 'This airline domain is not on the approved list yet.');
  };

  const handleManualReviewBackup = () => {
    router.push('/manual-review');
  };

  const handleSignOut = async () => {
    if (!user) {
                  router.replace('/onboarding?step=features');
      return;
    }

    try {
      await signOut();
      router.replace('/onboarding?step=features');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed.';
      Alert.alert('Sign Out Failed', message);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your YoFly Crew account? All your profile data, saved layover locations, flight routes, and chat history will be deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert('Account Deleted', 'Your account has been deleted.');
              router.replace('/onboarding?step=features');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete account.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={[styles.saveButton, isApplyingBaseAirport && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isApplyingBaseAirport}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickPhoto}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-circle" size={112} color={theme.colors.primary} />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color={theme.colors.background} />
            </View>
          </TouchableOpacity>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSubtitle}>{buildSubtitle(draft)}</Text>
          <View style={styles.airlineBadge}>
            <Ionicons name="airplane-outline" size={13} color={theme.colors.accent} />
            <Text style={styles.airlineBadgeText}>{draft.airline || 'YoFly Crew'}</Text>
          </View>
          <Text style={styles.heroBaseLabel}>{fullBaseLabel}</Text>
          <TouchableOpacity style={styles.changePhotoButton} onPress={handlePickPhoto}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>YoFly Pro Membership</Text>
            <View style={{ backgroundColor: theme.colors.primary + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary }}>
              <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>14-DAY FREE TRIAL</Text>
            </View>
          </View>
          <Text style={styles.fieldHint}>
            Unlock Live Flight Alerts, Emergency Beacon SOS, Unlimited Voice Translator & Dictation, and Unlimited Marketplace Listings.
          </Text>
          <TouchableOpacity
            style={[styles.secondaryActionButton, { marginTop: 12, backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/subscription')}
          >
            <Text style={[styles.secondaryActionText, { color: '#000', fontWeight: '800' }]}>Manage YoFly Pro Plan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Dark mode</Text>
              <Text style={styles.settingHint}>Defaulted on during onboarding. Switch any time here.</Text>
            </View>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Crew Verification</Text>
          <Text style={styles.fieldHint}>
            Work email is the primary crew-only gate. Badge or employee ID review is the backup path.
          </Text>

          <View style={styles.verificationStatusRow}>
            <View style={[styles.verificationStatusBadge, { backgroundColor: verificationColor + '18', borderColor: verificationColor + '44' }]}>
              <Text style={[styles.verificationStatusText, { color: verificationColor }]}>
                {CrewVerificationService.getStatusLabel(draft.verificationStatus)}
              </Text>
            </View>
            <Text style={styles.verificationHintText}>
              {draft.verifiedCrew
                ? 'Verified crew access enabled.'
                : draft.verificationStatus === CrewVerificationStatus.PENDING_EMAIL
                  ? 'Approved domain matched. Awaiting airline-email verification flow.'
                  : draft.verificationStatus === CrewVerificationStatus.PENDING_MANUAL
                    ? 'Use badge or employee ID review as backup.'
                    : 'Marketplace and crash pads should remain crew-only.'}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            value={draft.workEmail}
            onChangeText={(value) => updateField('workEmail', value)}
            placeholder="Airline work email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          {!!draft.verificationAirline && (
            <View style={styles.airlineMatchCard}>
              <Ionicons name="business" size={16} color={theme.colors.accent} />
              <Text style={styles.airlineMatchText}>{draft.verificationAirline}</Text>
            </View>
          )}

          <View style={styles.verificationActionsRow}>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={handleCheckWorkEmail}>
              <Text style={styles.secondaryActionText}>Check Work Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tertiaryActionButton} onPress={handleManualReviewBackup}>
              <Text style={styles.tertiaryActionText}>Manual Review</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            style={styles.input}
            value={draft.fullName}
            onChangeText={(value) => updateField('fullName', value)}
            placeholder="Full name"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Text style={styles.fieldLabel}>Flight crew role</Text>
          <Text style={styles.fieldHint}>YoFly Crew is currently focused on pilots and flight attendants.</Text>
          <View style={styles.roleRow}>
            {FLIGHT_CREW_ROLE_OPTIONS.map((role) => {
              const active = draft.roleLabel === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => updateField('roleLabel', role)}
                >
                  <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{role}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Base airport</Text>
          <Text style={styles.fieldHint}>Search by airport code or full name, then save your home hub.</Text>
          <TextInput
            style={styles.input}
            value={baseAirportQuery}
            onChangeText={handleBaseAirportChange}
            onSubmitEditing={() => commitResolvedBaseAirport({ showConfirmation: true })}
            placeholder="JFK or John F Kennedy"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <View style={styles.optionChipRow}>
            {BASE_AIRPORT_PRESETS.map((airportCode) => (
              <View key={airportCode} style={styles.nativeBaseButton}>
                {Platform.OS === 'web' ? (
                  React.createElement(
                    'button' as any,
                    {
                      type: 'button',
                      onClick: () => void commitBaseAirportSelection(airportCode, { showConfirmation: true }),
                      onMouseDown: () => void commitBaseAirportSelection(airportCode, { showConfirmation: true }),
                      onPointerDown: () => void commitBaseAirportSelection(airportCode, { showConfirmation: true }),
                      style: selectedBaseAirportCode === airportCode ? webButtonActiveStyle : webButtonStyle,
                    },
                    airportCode
                  )
                ) : (
                  <Button
                    title={airportCode}
                    color={selectedBaseAirportCode === airportCode ? theme.colors.primary : theme.colors.accent}
                    onPress={() => void commitBaseAirportSelection(airportCode, { showConfirmation: true })}
                  />
                )}
              </View>
            ))}
          </View>
          {renderAirportSuggestions(baseAirportResults, selectedBaseAirportCode, handleSelectBaseAirport)}
          <Text style={styles.baseAirportHint}>{fullBaseLabel}</Text>
          {baseAirportDebug ? <Text style={styles.baseAirportDebug}>{baseAirportDebug}</Text> : null}
          <View style={styles.nativeApplyButton}>
            {Platform.OS === 'web' ? (
              React.createElement(
                'button' as any,
                {
                  type: 'button',
                  disabled: isApplyingBaseAirport,
                  onClick: () => void handleApplyBaseAirport(),
                  onMouseDown: () => void handleApplyBaseAirport(),
                  onPointerDown: () => void handleApplyBaseAirport(),
                  style: {
                    ...webApplyButtonStyle,
                    opacity: isApplyingBaseAirport ? 0.7 : 1,
                    cursor: isApplyingBaseAirport ? 'default' : 'pointer',
                  },
                },
                isApplyingBaseAirport ? 'Applying...' : 'Apply Base Airport'
              )
            ) : (
              <Button
                title={isApplyingBaseAirport ? 'Applying...' : 'Apply Base Airport'}
                color={theme.colors.primary}
                onPress={() => void handleApplyBaseAirport()}
                disabled={isApplyingBaseAirport}
              />
            )}
          </View>
          <Text style={styles.fieldLabel}>Airline</Text>
          <TextInput
            style={styles.input}
            value={draft.airline}
            onChangeText={(value) => updateField('airline', value)}
            placeholder="Airline or crew group"
            placeholderTextColor={theme.colors.textMuted}
          />
          <View style={styles.optionChipRow}>
            {AIRLINE_PRESETS.map((airline) => {
              const active = draft.airline === airline;
              return (
                <TouchableOpacity
                  key={airline}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() => updateField('airline', airline)}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{airline}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Schedule Import</Text>
          <Text style={styles.fieldHint}>
            Upload a crew roster screenshot and let YoFly pull trip airports automatically.
          </Text>
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => router.push('/schedule-import')}>
            <Text style={styles.secondaryActionText}>Open Schedule Import</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Beacon Emergency SOS</Text>
          <Text style={styles.fieldHint}>
            The full Beacon contact list is managed from the Profile safety card. Settings keeps your emergency contacts and SOS state in sync.
          </Text>
          <TextInput
            style={styles.input}
            value={getPrimaryEmergencyPhone(draft.emergencyContacts, draft.emergencyPhone)}
            onChangeText={(value) =>
              updateField('emergencyContacts', normalizeEmergencyContacts(draft.emergencyContacts, value))
            }
            placeholder="Primary emergency contact phone"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="phone-pad"
          />
          <Text style={styles.baseAirportHint}>
            {getEmergencyContactCountLabel(draft.emergencyContacts, draft.emergencyPhone)}
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Beacon safety check-ins</Text>
              <Text style={styles.settingHint}>
                Arm Beacon for emergencies. Safety checks only start after an emergency or SOS trigger.
              </Text>
            </View>
            <Switch
              value={draft.sosEnabled}
              onValueChange={(value) => updateField('sosEnabled', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.error }}
              thumbColor={theme.colors.text}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Text style={styles.fieldLabel}>Ops context</Text>
          <Text style={styles.fieldHint}>Match the airport context used by Home, Profile, Dashboard, and the Map tab.</Text>
          <View style={styles.optionChipRow}>
            {OPS_CONTEXT_OPTIONS.map((option) => {
              const active = draft.preferences.opsContextMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() => handleSelectOpsContextMode(option.value)}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.contextSummaryCard}>
            <Text style={styles.contextSummaryEyebrow}>Current live hub</Text>
            <Text style={styles.contextSummaryValue}>
              {getFullAirportLabel(
                draft.preferences.opsContextMode === 'BASE'
                  ? draft.baseAirport
                  : draft.preferences.opsContextMode === 'LAYOVER'
                    ? draft.preferences.layoverAirport || draft.baseAirport
                    : draft.preferences.opsContextMode === 'TRIP'
                      ? draft.preferences.tripAirport || draft.baseAirport
                      : draft.preferences.activeOpsAirport || draft.baseAirport
              )}
            </Text>
          </View>

          {draft.preferences.opsContextMode === 'LAYOVER' ? (
            <>
              <Text style={styles.fieldLabel}>Current layover airport</Text>
              <TextInput
                style={styles.input}
                value={layoverAirportQuery}
                onChangeText={(value) => {
                  setLayoverAirportQuery(value.toUpperCase());
                  handleSelectContextAirport('layoverAirport', value.toUpperCase());
                }}
                placeholder="MIA"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {renderAirportSuggestions(
                layoverAirportResults,
                draft.preferences.layoverAirport,
                (airportCode) => handleSelectContextAirport('layoverAirport', airportCode)
              )}
            </>
          ) : null}

          {draft.preferences.opsContextMode === 'TRIP' ? (
            <>
              <Text style={styles.fieldLabel}>Today's trip airport</Text>
              <TextInput
                style={styles.input}
                value={tripAirportQuery}
                onChangeText={(value) => {
                  setTripAirportQuery(value.toUpperCase());
                  handleSelectContextAirport('tripAirport', value.toUpperCase());
                }}
                placeholder="LAX"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {renderAirportSuggestions(
                tripAirportResults,
                draft.preferences.tripAirport,
                (airportCode) => handleSelectContextAirport('tripAirport', airportCode)
              )}
            </>
          ) : null}

          {draft.preferences.opsContextMode === 'MANUAL' ? (
            <>
              <Text style={styles.fieldLabel}>Manual active hub</Text>
              <TextInput
                style={styles.input}
                value={manualAirportQuery}
                onChangeText={(value) => {
                  setManualAirportQuery(value.toUpperCase());
                  handleSelectContextAirport('activeOpsAirport', value.toUpperCase());
                }}
                placeholder="LAX"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {renderAirportSuggestions(
                manualAirportResults,
                draft.preferences.activeOpsAirport,
                (airportCode) => handleSelectContextAirport('activeOpsAirport', airportCode)
              )}
            </>
          ) : null}

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Crew intel notifications</Text>
              <Text style={styles.settingHint}>Shuttle issues, hotel problems, and airport friction.</Text>
            </View>
            <Switch
              value={draft.preferences.intelPush}
              onValueChange={(value) => updatePreference('intelPush', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Ops push alerts</Text>
              <Text style={styles.settingHint}>TSA spikes, FAA delay changes, weather alerts, and critical ops shifts.</Text>
            </View>
            <Switch
              value={draft.preferences.opsPush}
              onValueChange={(value) => updatePreference('opsPush', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Daily digest briefings</Text>
              <Text style={styles.settingHint}>Morning base brief, layover brief, and disruption digest.</Text>
            </View>
            <Switch
              value={draft.preferences.dailyDigest}
              onValueChange={(value) => updatePreference('dailyDigest', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Layover chat pings</Text>
              <Text style={styles.settingHint}>New crew chat activity in your current city.</Text>
            </View>
            <Switch
              value={draft.preferences.layoverChat}
              onValueChange={(value) => updatePreference('layoverChat', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Crew perks and deals</Text>
              <Text style={styles.settingHint}>Discount drops, hotel deals, and crew-only offers.</Text>
            </View>
            <Switch
              value={draft.preferences.dealsAndPerks}
              onValueChange={(value) => updatePreference('dealsAndPerks', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Visible on crew map</Text>
              <Text style={styles.settingHint}>Let nearby crew see that you are in the area.</Text>
            </View>
            <Switch
              value={draft.preferences.visibleOnCrewMap}
              onValueChange={(value) => updatePreference('visibleOnCrewMap', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          <Text style={styles.fieldLabel}>Favorite hubs</Text>
          <Text style={styles.fieldHint}>Choose the airports that should stay quick to reach across the app.</Text>
          <View style={styles.selectionChipRow}>
            {draft.preferences.favoriteAirports.map((airportCode) => (
              <TouchableOpacity
                key={airportCode}
                style={styles.selectionChip}
                onPress={() => handleRemoveFavoriteHub(airportCode)}
              >
                <Text style={styles.selectionChipText}>{airportCode}</Text>
                <Ionicons name="close" size={14} color={theme.colors.background} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={favoriteHubQuery}
            onChangeText={(value) => setFavoriteHubQuery(value.toUpperCase())}
            placeholder="Add another hub"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {favoriteHubQuery.length > 0
            ? renderAirportSuggestions(favoriteHubResults, '', handleAddFavoriteHub)
            : null}

          <Text style={styles.fieldLabel}>Preferred airlines</Text>
          <Text style={styles.fieldHint}>Optional IATA airline codes to prioritize in the flight board.</Text>
          <TextInput
            style={styles.input}
            value={formatPreferenceCodes(draft.preferences.preferredAirlines)}
            onChangeText={(value) =>
              {
                setHasLocalEdits(true);
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    preferredAirlines: parsePreferenceCodes(value),
                  },
                }));
              }
            }
            placeholder="DL, AA, B6"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.fieldHint}>Your airline work email is the crew-only trust gate for YoFly Crew.</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/admin-review')}>
              <Text style={styles.adminButtonText}>Open Manual Review Queue</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.signOutButton, isSubmitting && styles.signOutButtonDisabled]}
            onPress={() => void handleSignOut()}
            disabled={isSubmitting}
          >
            <Text style={styles.signOutText}>{isSubmitting ? 'Signing Out...' : 'Sign Out'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteAccountButton, isSubmitting && styles.signOutButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={isSubmitting}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.roundness.full,
  },
  saveButtonText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 40,
    gap: theme.spacing.md,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  heroName: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  airlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
    backgroundColor: theme.colors.accent + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  airlineBadgeText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  heroBaseLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  changePhotoButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
  },
  changePhotoText: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  fieldHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 4,
  },
  baseAirportHint: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  baseAirportDebug: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  verificationStatusRow: {
    gap: 8,
    marginBottom: 4,
  },
  verificationStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  verificationStatusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  verificationHintText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  airlineMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '33',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  airlineMatchText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  verificationActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  secondaryActionButton: {
    flex: 1,
    borderRadius: theme.roundness.full,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  nativeApplyButton: {
    borderRadius: theme.roundness.full,
    overflow: 'hidden',
  },
  tertiaryActionButton: {
    flex: 1,
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tertiaryActionText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  signOutButton: {
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: '#FF3B3044',
    backgroundColor: '#FF3B3012',
    paddingVertical: 14,
    marginTop: 10,
  },
  deleteAccountText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '800',
  },
  adminButton: {
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '18',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  adminButtonText: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '900',
  },
  signOutText: {
    color: theme.colors.error,
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    height: 52,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    color: theme.colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 2,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  roleChipTextActive: {
    color: theme.colors.background,
  },
  optionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
    marginBottom: 2,
  },
  nativeBaseButton: {
    minWidth: 68,
    borderRadius: theme.roundness.full,
    overflow: 'hidden',
  },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
  },
  optionChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: theme.colors.background,
  },
  contextSummaryCard: {
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '33',
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextSummaryEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  contextSummaryValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  suggestionsWrap: {
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '66',
  },
  suggestionRowSelected: {
    backgroundColor: theme.colors.primary + '12',
  },
  suggestionCodeWrap: {
    minWidth: 44,
    borderRadius: theme.roundness.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  suggestionCode: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  suggestionName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  selectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 2,
  },
  selectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.roundness.full,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionChipText: {
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: 10,
  },
  settingTextWrap: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  settingHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
