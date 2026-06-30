import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { BeaconSOSModal } from '../../src/components/BeaconSOSModal';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { CrewVerificationService } from '../../src/services/CrewVerificationService';
import { SOSManager } from '../../src/services/SOSManager';
import { EmergencyContact } from '../../src/types/safety';
import { CrewVerificationStatus } from '../../src/types/verification';
import { getEmergencyContactCountLabel, getPrimaryEmergencyPhone, normalizeEmergencyContacts } from '../../src/utils/beaconSOS';
import {
  getProfileAvatarSource,
  getProfileDisplayAirline,
  getProfileDisplayEmail,
  getProfileDisplayName,
} from '../../src/utils/profilePresentation';

const buildSubtitle = (baseAirport: string, roleLabel: string) =>
  [`${baseAirport || 'JFK'} Base`, roleLabel || 'Member'].filter(Boolean).join(' • ');

const getInitials = (value: string) => {
  const words = (value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return 'YC';
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
};

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, signOut, isSubmitting, saveProfileToRemote } = useAuth();
  const { profile, updateProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const avatarSource = getProfileAvatarSource(profile);
  const displayName = getProfileDisplayName(profile);
  const displayAirline = getProfileDisplayAirline(profile);
  const displayEmail = getProfileDisplayEmail(profile, user?.email);
  const [isBeaconModalVisible, setIsBeaconModalVisible] = useState(false);
  const beaconContacts = useMemo(
    () => normalizeEmergencyContacts(profile.emergencyContacts, profile.emergencyPhone),
    [profile.emergencyContacts, profile.emergencyPhone]
  );
  const beaconPrimaryPhone = useMemo(
    () => getPrimaryEmergencyPhone(beaconContacts, profile.emergencyPhone),
    [beaconContacts, profile.emergencyPhone]
  );
  const verificationColor =
    profile.verificationStatus === CrewVerificationStatus.VERIFIED_CREW
      ? theme.colors.success
      : profile.verificationStatus === CrewVerificationStatus.PENDING_EMAIL
        ? theme.colors.accent
        : profile.verificationStatus === CrewVerificationStatus.PENDING_MANUAL
          ? '#FF9500'
          : profile.verificationStatus === CrewVerificationStatus.REJECTED
            ? theme.colors.error
            : theme.colors.textMuted;

  const completionItems = [
    { label: 'Avatar', done: Boolean(avatarSource) },
    { label: 'Name', done: Boolean((profile.fullName || '').trim()) },
    { label: 'Airline', done: Boolean((profile.airline || '').trim()) },
    { label: 'Work email', done: Boolean(profile.workEmail || user?.email) },
    { label: 'Base', done: Boolean((profile.baseAirport || '').trim()) },
    { label: 'Emergency', done: beaconContacts.length > 0 || Boolean((profile.emergencyPhone || '').trim()) },
    { label: 'Verified', done: profile.verifiedCrew },
  ];
  const completedItems = completionItems.filter((item) => item.done).length;
  const completionPct = Math.round((completedItems / completionItems.length) * 100);
  const nextIncomplete = completionItems.find((item) => !item.done)?.label;
  const nextStep = !nextIncomplete
    ? 'Your profile is in a strong state across app and web.'
    : nextIncomplete === 'Avatar'
      ? 'Add a crew avatar so your profile reads more personally.'
      : nextIncomplete === 'Name'
        ? 'Add your full name to keep the crew identity visible.'
        : nextIncomplete === 'Airline'
          ? 'Add your airline so the app can show your crew brand.'
          : nextIncomplete === 'Work email'
            ? 'Add your airline work email in Settings.'
            : nextIncomplete === 'Base'
                ? 'Set your base airport so Home, Map, and Marketplace stay synced.'
                : nextIncomplete === 'Emergency'
                  ? 'Add Beacon Emergency SOS contacts so emergency tools are ready.'
                  : 'Finish crew verification to unlock trusted access.';

  const handleSignOut = async () => {
    if (!user) {
      router.replace('/auth?mode=signin&page=form');
      return;
    }

    try {
      await signOut();
      router.replace('/auth?mode=signin&page=form');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed.';
      Alert.alert('Sign Out Failed', message);
    }
  };

  const handleSaveBeacon = async (payload: { enabled: boolean; contacts: EmergencyContact[] }) => {
    const normalizedContacts = normalizeEmergencyContacts(payload.contacts, profile.emergencyPhone);
    const primaryPhone = getPrimaryEmergencyPhone(normalizedContacts, profile.emergencyPhone);
    const nextProfile = {
      ...profile,
      sosEnabled: payload.enabled,
      emergencyContacts: normalizedContacts,
      emergencyPhone: primaryPhone,
    };

    try {
      await saveProfileToRemote(nextProfile);
      updateProfile(nextProfile);
      SOSManager.setContacts(normalizedContacts);

      if (payload.enabled) {
        SOSManager.startSOS();
      } else {
        SOSManager.stopSOS();
      }

      AppSyncService.emit('profile');
      setIsBeaconModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update Beacon Emergency SOS right now.';
      Alert.alert('Beacon Save Failed', message);
    }
  };

  const infoCards = [
    ...(profile.verifiedCrew
      ? []
      : [
          {
            key: 'verification',
            title: 'Verification',
            value: 'Needs attention',
            hint: CrewVerificationService.getStatusLabel(profile.verificationStatus),
            icon: 'shield-checkmark-outline' as const,
            color: verificationColor,
          },
        ]),
    {
      key: 'beacon',
      title: 'Beacon Emergency SOS',
      value: profile.sosEnabled ? 'Beacon SOS armed' : 'Beacon SOS off',
      hint: beaconPrimaryPhone
        ? `${getEmergencyContactCountLabel(beaconContacts, beaconPrimaryPhone)} • Primary ${beaconPrimaryPhone}`
        : 'Tap to add up to 5 emergency contacts',
      icon: 'medkit-outline' as const,
      color: theme.colors.error,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.pageLabel}>Crew Profile</Text>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIdentity}>
            <View style={styles.avatarContainer}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{getInitials(displayName)}</Text>
                </View>
              )}
              {profile.verifiedCrew && (
                <View style={styles.avatarBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={theme.colors.background} />
                </View>
              )}
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
                {profile.verifiedCrew && (
                  <Ionicons name="shield-checkmark" size={18} color={theme.colors.success} style={styles.verifiedIcon} />
                )}
              </View>
              <Text style={styles.subtitle}>
                {buildSubtitle(profile.baseAirport, profile.roleLabel)}
              </Text>
              <View style={styles.airlineBadge}>
                <Ionicons name="airplane-outline" size={13} color={theme.colors.accent} />
                <Text style={styles.airlineBadgeText}>{displayAirline}</Text>
              </View>
              <Text style={styles.email}>{displayEmail}</Text>
              {profile.preferences.favoriteAirports && profile.preferences.favoriteAirports.length > 0 ? (
                <View style={styles.hubsRow}>
                  <Ionicons name="star" size={13} color={theme.colors.accent} />
                  <Text style={styles.hubsText} numberOfLines={1}>
                    Hubs: {profile.preferences.favoriteAirports.join(', ')}
                  </Text>
                </View>
              ) : null}
              {profile.verificationStatus !== CrewVerificationStatus.VERIFIED_CREW && (
                <View
                  style={[
                    styles.miniStatusBadge,
                    { backgroundColor: verificationColor + '18', borderColor: verificationColor + '44' },
                  ]}
                >
                  <Ionicons name="shield-outline" size={12} color={verificationColor} />
                  <Text style={[styles.miniStatusText, { color: verificationColor }]}>
                    {CrewVerificationService.getStatusLabel(profile.verificationStatus)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {completionPct < 100 && (
            <View style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <Text style={styles.readinessTitle}>Profile readiness</Text>
                <Text style={styles.readinessValue}>{completionPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${completionPct}%`,
                      backgroundColor: profile.verifiedCrew ? theme.colors.success : theme.colors.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.readinessHint}>{nextStep}</Text>
              <View style={styles.readinessChips}>
                {completionItems.map((item) => (
                  <View
                    key={item.label}
                    style={[styles.readinessChip, item.done ? styles.readinessChipDone : styles.readinessChipPending]}
                  >
                    <Text
                      style={[
                        styles.readinessChipText,
                        item.done ? styles.readinessChipTextDone : styles.readinessChipTextPending,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.heroActions}>
            <View style={styles.heroPrimaryActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/settings')}>
                <Ionicons name="create-outline" size={18} color={theme.colors.background} />
                <Text style={styles.primaryButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(profile.verifiedCrew ? '/dashboard' : '/manual-review')}
              >
                <Ionicons
                  name={profile.verifiedCrew ? 'grid-outline' : 'shield-half-outline'}
                  size={18}
                  color={theme.colors.text}
                />
                <Text style={styles.secondaryButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {profile.verifiedCrew ? 'Open Dashboard' : 'Finish Verification'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.cardGrid}>
          {infoCards.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={[styles.infoCard, card.key === 'beacon' && styles.infoCardInteractive]}
              activeOpacity={card.key === 'beacon' ? 0.9 : 1}
              onPress={card.key === 'beacon' ? () => setIsBeaconModalVisible(true) : undefined}
            >
              <View style={styles.infoCardHeader}>
                <View style={[styles.infoIconWrap, { backgroundColor: card.color + '18', borderColor: card.color + '40' }]}>
                  <Ionicons name={card.icon} size={15} color={card.color} />
                </View>
                {card.key === 'beacon' && (
                  <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                )}
              </View>
              <View style={styles.infoCardBody}>
                <Text style={styles.infoTitle} numberOfLines={1}>{card.title}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{card.value}</Text>
                <Text style={styles.infoHint} numberOfLines={2}>{card.hint}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>



        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Account Controls</Text>
          <View style={styles.quickList}>
            <TouchableOpacity style={styles.quickRow} onPress={() => router.push('/settings')}>
              <View style={styles.quickRowIcon}>
                <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.quickRowCopy}>
                <Text style={styles.quickRowTitle}>Profile and base settings</Text>
                <Text style={styles.quickRowText}>Edit airline, base hub, avatar, and map visibility in one place</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickRow}
              onPress={() => router.push(profile.verifiedCrew ? '/create-listing' : '/manual-review')}
            >
              <View style={styles.quickRowIcon}>
                <Ionicons
                  name={profile.verifiedCrew ? 'storefront-outline' : 'shield-checkmark-outline'}
                  size={18}
                  color={theme.colors.accent}
                />
              </View>
              <View style={styles.quickRowCopy}>
                <Text style={styles.quickRowTitle}>
                  {profile.verifiedCrew ? 'Marketplace tools' : 'Verification path'}
                </Text>
                <Text style={styles.quickRowText}>
                  {profile.verifiedCrew
                    ? 'Create listings and manage crew-only inventory'
                    : 'Submit your backup documents and unlock the trusted layer'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickRow, styles.signOutQuickRow]}
              onPress={() => void handleSignOut()}
              disabled={isSubmitting}
            >
              <View style={[styles.quickRowIcon, styles.signOutQuickIcon]}>
                <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
              </View>
              <View style={styles.quickRowCopy}>
                <Text style={[styles.quickRowTitle, styles.signOutQuickTitle]}>
                  {isSubmitting ? 'Signing out...' : 'Sign out'}
                </Text>
                <Text style={styles.quickRowText}>Return to the sign-in screen on this device</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BeaconSOSModal
        visible={isBeaconModalVisible}
        enabled={profile.sosEnabled}
        contacts={beaconContacts}
        onClose={() => setIsBeaconModalVisible(false)}
        onSave={handleSaveBeacon}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    pageLabel: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
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
    topSignOutButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.error + '55',
      backgroundColor: theme.colors.error + '10',
      paddingHorizontal: 13,
    },
    topSignOutButtonDisabled: {
      opacity: 0.6,
    },
    topSignOutText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '900',
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    heroIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    heroCopy: {
      flex: 1,
      gap: 4,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 0, 255, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 0, 255, 0.24)',
    },
    avatarFallbackText: {
      color: theme.colors.primary,
      fontSize: 24,
      fontWeight: '900',
    },
    avatarBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.success,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    verifiedIcon: {
      marginTop: 2,
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: '700',
    },
    airlineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '33',
      backgroundColor: theme.colors.accent + '08',
      paddingHorizontal: 9,
      paddingVertical: 4,
      marginTop: 2,
    },
    airlineBadgeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    baseInfo: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    email: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    hubsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    hubsText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    miniStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginTop: 6,
    },
    miniStatusText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.3,
    },
    verificationBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    verificationBadgeText: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    readinessCard: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 10,
    },
    readinessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    readinessTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    readinessValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    readinessHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    readinessChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    readinessChip: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    readinessChipDone: {
      borderColor: theme.colors.success + '44',
      backgroundColor: theme.colors.success + '12',
    },
    readinessChipPending: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    readinessChipText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    readinessChipTextDone: {
      color: theme.colors.success,
    },
    readinessChipTextPending: {
      color: theme.colors.textMuted,
    },
    heroActions: {
      marginTop: 8,
      width: '100%',
    },
    heroPrimaryActions: {
      flexDirection: 'row',
      width: '100%',
      gap: 12,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.accent,
      height: 46,
      borderRadius: theme.roundness.full,
    },
    primaryButtonText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.cardSoft,
      height: 46,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    ghostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 6,
      paddingVertical: 12,
    },
    ghostButtonText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    utilityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
    },
    signOutPill: {
      borderColor: theme.colors.error + '55',
      backgroundColor: theme.colors.error + '10',
    },
    utilityPillText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    signOutPillText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '900',
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      width: '100%',
    },
    infoCard: {
      flex: 1,
      flexGrow: 1,
      minWidth: 150,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 12,
    },
    infoCardInteractive: {
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 2,
    },
    infoCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoCardBody: {
      gap: 4,
    },
    infoIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoTitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    infoHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    infoCardLinkRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    infoCardLinkText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    fieldLabel: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    input: {
      height: 50,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      color: theme.colors.text,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    suggestionsWrap: {
      borderRadius: theme.roundness.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '66',
    },
    suggestionRowSelected: {
      backgroundColor: theme.colors.primary + '12',
    },
    suggestionCodeWrap: {
      minWidth: 44,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      fontWeight: '700',
    },
    panel: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    panelTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      flex: 1,
    },
    panelLink: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
    },
    detailGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    detailCard: {
      flexGrow: 1,
      minWidth: 160,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      gap: 8,
    },
    detailLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    detailValue: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    quickList: {
      gap: theme.spacing.sm,
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
    },
    quickRowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    signOutQuickRow: {
      borderColor: theme.colors.error + '55',
      backgroundColor: theme.colors.error + '08',
    },
    signOutQuickIcon: {
      backgroundColor: theme.colors.error + '14',
    },
    quickRowCopy: {
      flex: 1,
      gap: 4,
    },
    quickRowTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    signOutQuickTitle: {
      color: theme.colors.error,
    },
    quickRowText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
  });
