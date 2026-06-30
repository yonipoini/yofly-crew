import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { AppSyncService } from '../src/services/AppSyncService';
import {
  ScheduleImportService,
  type ImportableCrewCalendar,
} from '../src/services/ScheduleImportService';
import type { ImportedSchedule } from '../src/types/schedule';

export default function ScheduleImportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, saveProfileToRemote } = useAuth();
  const { profile, mergeProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [importedSchedule, setImportedSchedule] = useState<ImportedSchedule | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<ImportableCrewCalendar[]>([]);
  const [calendarAccessGranted, setCalendarAccessGranted] = useState(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(true);
  const [isRequestingCalendarAccess, setIsRequestingCalendarAccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [storedSchedule, access] = await Promise.all([
          ScheduleImportService.getImportedSchedule(user?.id),
          ScheduleImportService.getCalendarAccessStatus(),
        ]);

        if (!active) {
          return;
        }

        setImportedSchedule(storedSchedule);
        setCalendarAccessGranted(access.granted);

        if (access.granted) {
          const calendars = await ScheduleImportService.getImportableCalendars();
          if (active) {
            setAvailableCalendars(calendars);
          }
        }
      } catch (error) {
        console.warn('Failed to load schedule import state:', error);
      } finally {
        if (active) {
          setIsLoadingCalendars(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const derivedContext = useMemo(
    () => (importedSchedule ? ScheduleImportService.getDerivedContext(importedSchedule) : null),
    [importedSchedule]
  );

  const connectedCalendarId =
    importedSchedule?.source === 'calendar' ? importedSchedule.sourceDetails?.calendarId : undefined;

  const recommendedCalendars = useMemo(
    () => availableCalendars.filter((calendar) => calendar.isRecommended),
    [availableCalendars]
  );

  const otherCalendars = useMemo(
    () => availableCalendars.filter((calendar) => !calendar.isRecommended),
    [availableCalendars]
  );

  const refreshCalendars = async () => {
    setIsLoadingCalendars(true);

    try {
      const access = await ScheduleImportService.getCalendarAccessStatus();
      setCalendarAccessGranted(access.granted);

      if (!access.granted) {
        setAvailableCalendars([]);
        return;
      }

      const calendars = await ScheduleImportService.getImportableCalendars();
      setAvailableCalendars(calendars);
    } catch (error) {
      console.warn('Failed to refresh calendars:', error);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleEnableCalendarAccess = async () => {
    setIsRequestingCalendarAccess(true);

    try {
      const access = await ScheduleImportService.requestCalendarAccess();
      setCalendarAccessGranted(access.granted);

      if (!access.granted) {
        Alert.alert(
          'Calendar Permission',
          'Allow calendar access so YoFly can read your synced crew trips from Apple Calendar or your Android calendar.'
        );
        return;
      }

      await refreshCalendars();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to request calendar permission.';
      Alert.alert('Permission Failed', message);
    } finally {
      setIsRequestingCalendarAccess(false);
    }
  };

  const handleImportCalendar = async (calendar: ImportableCrewCalendar) => {
    setActiveCalendarId(calendar.id);

    try {
      const nextSchedule = await ScheduleImportService.importFromCalendar({ calendar });
      setImportedSchedule(nextSchedule);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to import that calendar. Make sure CrewHub is syncing detailed trip notes first.';
      Alert.alert('Calendar Import Failed', message);
    } finally {
      setActiveCalendarId(null);
    }
  };

  const handlePickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos Permission', 'Allow photo access to import a trip detail screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) {
      return;
    }

    setIsImporting(true);

    try {
      const asset = result.assets[0];
      const nextSchedule = await ScheduleImportService.importFromImage({
        imageBase64: asset.base64 || '',
        mimeType: asset.mimeType,
        imageUri: asset.uri,
      });
      setImportedSchedule(nextSchedule);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse that trip screenshot yet.';
      Alert.alert('Import Failed', message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUseTrip = async () => {
    if (!importedSchedule) {
      return;
    }

    setIsApplying(true);

    try {
      const persistedSchedule = await ScheduleImportService.saveImportedSchedule(
        {
          ...importedSchedule,
          active: true,
        },
        user?.id
      );
      const nextProfile = ScheduleImportService.applyImportedSchedule(profile, persistedSchedule);
      await saveProfileToRemote(nextProfile);
      mergeProfile({
        preferences: nextProfile.preferences,
      });
      AppSyncService.emit('profile');
      Alert.alert(
        'Trip Synced',
        derivedContext
          ? `YoFly will now follow ${derivedContext.activeAirport} and keep your crew context aligned with your imported schedule.`
          : 'YoFly will now follow your imported trip.'
      );
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to use that imported trip.';
      Alert.alert('Use Trip Failed', message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearImportedTrip = async () => {
    try {
      await ScheduleImportService.clearImportedSchedule(user?.id);
      setImportedSchedule(null);
      const nextPreferences = {
        ...profile.preferences,
        opsContextMode: 'BASE' as const,
        tripAirport: '',
        layoverAirport: '',
        activeOpsAirport: profile.baseAirport,
      };
      await saveProfileToRemote({
        ...profile,
        preferences: nextPreferences,
      });
      mergeProfile({
        preferences: nextPreferences,
      });
      AppSyncService.emit('profile');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to clear the imported trip.';
      Alert.alert('Clear Failed', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Import</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => void refreshCalendars()}>
          <Ionicons name="refresh-outline" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Crew Calendar Sync</Text>
          <Text style={styles.heroTitle}>Import trips from Apple or Google calendars</Text>
          <Text style={styles.heroText}>
            Turn on CrewHub calendar sync, connect your device calendar once, and YoFly can pull the
            detailed trip notes it needs for smarter alerts, airport focus, and layover context.
          </Text>
          {calendarAccessGranted ? (
            <View style={styles.heroPill}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.heroPillText}>
                Calendar access is on{Platform.OS === 'ios' ? ' for Apple Calendar' : ' for Android calendars'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, isRequestingCalendarAccess && styles.disabledButton]}
              onPress={() => void handleEnableCalendarAccess()}
              disabled={isRequestingCalendarAccess}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.background} />
              <Text style={styles.primaryButtonText}>
                {isRequestingCalendarAccess ? 'Requesting Access...' : 'Allow Calendar Access'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choose your synced crew calendar</Text>
            <Text style={styles.sectionMeta}>
              {isLoadingCalendars ? 'Loading...' : `${availableCalendars.length} found`}
            </Text>
          </View>
          <Text style={styles.supportText}>
            We recommend the calendar that looks like CrewHub, Southwest, or your trip roster. YoFly
            reads the events and parses the trip notes inside each synced entry.
          </Text>

          {!calendarAccessGranted ? (
            <View style={styles.emptyCard}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.emptyText}>
                Allow calendar access first so we can find the CrewHub-synced calendar on this device.
              </Text>
            </View>
          ) : null}

          {calendarAccessGranted && !isLoadingCalendars && !availableCalendars.length ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.emptyText}>
                No event calendars were found yet. First enable CrewHub calendar sync, then come back and refresh.
              </Text>
            </View>
          ) : null}

          {recommendedCalendars.map((calendar) => (
            <TouchableOpacity
              key={calendar.id}
              style={[styles.calendarCard, connectedCalendarId === calendar.id && styles.calendarCardConnected]}
              onPress={() => void handleImportCalendar(calendar)}
              disabled={activeCalendarId === calendar.id}
            >
              <View style={styles.calendarTopRow}>
                <View style={styles.calendarTextWrap}>
                  <Text style={styles.calendarTitle}>{calendar.title}</Text>
                  <Text style={styles.calendarMeta}>
                    {[calendar.platformLabel, calendar.sourceName || calendar.ownerName, calendar.matchReason]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
                <View style={styles.calendarBadge}>
                  <Text style={styles.calendarBadgeText}>
                    {connectedCalendarId === calendar.id ? 'Connected' : 'Recommended'}
                  </Text>
                </View>
              </View>
              <Text style={styles.calendarHint}>
                {activeCalendarId === calendar.id
                  ? 'Importing upcoming trips...'
                  : 'Import next 6 months of trips and parse detailed notes from each event.'}
              </Text>
            </TouchableOpacity>
          ))}

          {otherCalendars.length ? (
            <View style={styles.otherCalendarsWrap}>
              <Text style={styles.subsectionTitle}>Other calendars on this device</Text>
              {otherCalendars.map((calendar) => (
                <TouchableOpacity
                  key={calendar.id}
                  style={[styles.calendarCard, connectedCalendarId === calendar.id && styles.calendarCardConnected]}
                  onPress={() => void handleImportCalendar(calendar)}
                  disabled={activeCalendarId === calendar.id}
                >
                  <Text style={styles.calendarTitle}>{calendar.title}</Text>
                  <Text style={styles.calendarMeta}>
                    {[calendar.platformLabel, calendar.sourceName || calendar.ownerName].filter(Boolean).join(' • ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fallback import</Text>
            <Text style={styles.sectionMeta}>Optional</Text>
          </View>
          <Text style={styles.supportText}>
            If a specific CrewHub trip is missing notes in your calendar, you can still upload a detailed trip
            screenshot as a backup.
          </Text>
          <TouchableOpacity
            style={[styles.secondaryActionButton, isImporting && styles.disabledButton]}
            onPress={() => void handlePickScreenshot()}
            disabled={isImporting}
          >
            <Ionicons name="image-outline" size={18} color={theme.colors.text} />
            <Text style={styles.secondaryActionText}>
              {isImporting ? 'Reading Screenshot...' : 'Upload Detail Screenshot'}
            </Text>
          </TouchableOpacity>
        </View>

        {importedSchedule ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Imported trip preview</Text>
              <Text style={styles.sectionMeta}>{importedSchedule.legs.length} legs</Text>
            </View>

            {importedSchedule.sourceDetails?.label ? (
              <View style={styles.previewMetaPill}>
                <Ionicons
                  name={importedSchedule.source === 'calendar' ? 'calendar-clear-outline' : 'image-outline'}
                  size={14}
                  color={theme.colors.accent}
                />
                <Text style={styles.previewMetaText}>{importedSchedule.sourceDetails.label}</Text>
              </View>
            ) : null}

            {importedSchedule.imageUri ? (
              <Image source={{ uri: importedSchedule.imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : null}

            {importedSchedule.rawSummary ? <Text style={styles.summaryText}>{importedSchedule.rawSummary}</Text> : null}

            {derivedContext ? (
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>Recommended airport focus</Text>
                <Text style={styles.contextValue}>{derivedContext.activeAirport}</Text>
                <Text style={styles.contextText}>
                  {derivedContext.mode === 'TRIP'
                    ? `Trip mode will follow ${derivedContext.tripAirport} before departure and sign-in.`
                    : `Layover mode will follow ${derivedContext.layoverAirport} after arrival.`}
                </Text>
              </View>
            ) : null}

            <View style={styles.legsWrap}>
              {importedSchedule.legs.map((leg) => (
                <View key={leg.id} style={styles.legCard}>
                  <View style={styles.legTopRow}>
                    <Text style={styles.legRoute}>
                      {leg.departureAirport} to {leg.arrivalAirport}
                    </Text>
                    <Text style={styles.legFlight}>
                      {[leg.isDeadhead ? 'DH' : null, leg.flightNumber || 'Crew leg'].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <Text style={styles.legMeta}>
                    {[
                      leg.date,
                      leg.reportTime && `Report ${leg.reportTime}`,
                      leg.departureTime && `Out ${leg.departureTime}`,
                      leg.arrivalTime && `In ${leg.arrivalTime}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                  {leg.rawText ? <Text style={styles.legRaw}>{leg.rawText}</Text> : null}
                </View>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleClearImportedTrip()}>
                <Text style={styles.secondaryButtonText}>Clear Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButtonInline, isApplying && styles.disabledButton]}
                onPress={() => void handleUseTrip()}
                disabled={isApplying}
              >
                <Text style={styles.primaryButtonText}>{isApplying ? 'Applying...' : 'Use This Schedule'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={styles.stepRow}>
              <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.stepText}>Turn on CrewHub calendar sync to Apple Calendar or your Android calendar.</Text>
            </View>
            <View style={styles.stepRow}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.stepText}>YoFly reads the calendar event notes to pull legs, report times, and airports.</Text>
            </View>
            <View style={styles.stepRow}>
              <Ionicons name="sparkles-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.stepText}>After you confirm, trip-aware alerts and airport context can stay aligned automatically.</Text>
            </View>
          </View>
        )}
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
    headerTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 40,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    heroEyebrow: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    heroText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    heroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    heroPillText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    subsectionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    supportText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.cardSoft,
    },
    emptyText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    calendarCard: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.input,
    },
    calendarCardConnected: {
      borderColor: theme.colors.accent,
    },
    calendarTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    calendarTextWrap: {
      flex: 1,
      gap: 2,
    },
    calendarTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    calendarMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    calendarHint: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    calendarBadge: {
      borderRadius: theme.roundness.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      backgroundColor: theme.colors.cardSoft,
    },
    calendarBadgeText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    otherCalendarsWrap: {
      gap: theme.spacing.sm,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.full,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      alignSelf: 'flex-start',
    },
    primaryButtonInline: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.full,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    primaryButtonText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.input,
    },
    secondaryActionText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    previewMetaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      backgroundColor: theme.colors.cardSoft,
    },
    previewMetaText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    previewImage: {
      width: '100%',
      height: 180,
      borderRadius: theme.roundness.md,
    },
    summaryText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    contextCard: {
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.cardSoft,
      gap: theme.spacing.xs,
    },
    contextLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    contextValue: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    contextText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    legsWrap: {
      gap: theme.spacing.sm,
    },
    legCard: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: theme.spacing.md,
      gap: 6,
    },
    legTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    legRoute: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    legFlight: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    legMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    legRaw: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.input,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    disabledButton: {
      opacity: 0.6,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    stepText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
  });
