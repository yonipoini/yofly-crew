import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { AppSyncService } from '../src/services/AppSyncService';
import { CrewVerificationService } from '../src/services/CrewVerificationService';
import { DashboardService, DashboardSnapshot } from '../src/services/DashboardService';
import { getListingCategoryLabel } from '../src/types/marketplace';
import {
  getFullAirportLabel,
  getProfileAvatarSource,
  getProfileDisplayAirline,
  getProfileDisplayEmail,
  getProfileDisplayName,
} from '../src/utils/profilePresentation';

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const getInitials = (value: string) => {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return 'YC';
  }

  return words.map((word) => word.charAt(0).toUpperCase()).join('');
};

const buildPreferenceChips = (profile: ReturnType<typeof useProfile>['profile']) => [
  {
    label: profile.preferences.intelPush ? 'Intel Push On' : 'Intel Push Off',
    icon: 'radio-outline' as const,
  },
  {
    label: profile.preferences.opsPush ? 'Ops Push On' : 'Ops Push Off',
    icon: 'notifications-outline' as const,
  },
  {
    label: profile.preferences.visibleOnCrewMap ? 'Visible On Crew Map' : 'Hidden On Crew Map',
    icon: 'location-outline' as const,
  },
  {
    label: `${profile.preferences.opsContextMode} Ops Context`,
    icon: 'navigate-outline' as const,
  },
];

const buildSetupChecklist = (
  profile: ReturnType<typeof useProfile>['profile'],
  userEmail?: string | null
) => [
  {
    label: 'Crew identity',
    detail:
      profile.fullName && profile.airline && profile.airline !== 'YoFly Crew'
        ? `${profile.fullName} • ${profile.airline}`
        : 'Add your name and airline details',
    complete: Boolean(profile.fullName && profile.airline && profile.airline !== 'YoFly Crew'),
  },
  {
    label: 'Work email',
    detail: profile.workEmail || userEmail || 'Add your airline work email',
    complete: Boolean(profile.workEmail || userEmail),
  },
  {
    label: 'Base airport',
    detail: profile.baseAirport ? `${profile.baseAirport} home hub` : 'Add your home base airport',
    complete: Boolean(profile.baseAirport),
  },
  {
    label: 'Safety fallback',
    detail: profile.emergencyPhone || 'Add an emergency contact for SOS mode',
    complete: Boolean(profile.emergencyPhone),
  },
  {
    label: 'Crew trust',
    detail: profile.verifiedCrew ? 'Verified crew access active' : 'Verification still needs attention',
    complete: profile.verifiedCrew,
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, signOut, isSubmitting } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const avatarSource = getProfileAvatarSource(profile);
  const displayName = getProfileDisplayName(profile);
  const displayAirline = getProfileDisplayAirline(profile);
  const displayEmail = getProfileDisplayEmail(profile, user?.email);
  const fullBaseLabel = getFullAirportLabel(profile.baseAirport);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!user?.id) {
      setSnapshot(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await DashboardService.getSnapshot(user.id);
      setSnapshot(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load your dashboard right now.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
      setErrorMessage(message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadSnapshot();
    }, [loadSnapshot])
  );

  useEffect(() => {
    return AppSyncService.subscribe((event) => {
      if (event === 'community' || event === 'marketplace' || event === 'profile') {
        void loadSnapshot();
      }
    });
  }, [loadSnapshot]);

  const verificationColor = profile.verifiedCrew ? theme.colors.success : theme.colors.accent;
  const preferenceChips = buildPreferenceChips(profile);
  const setupChecklist = buildSetupChecklist(profile, user?.email);
  const completedSetupCount = setupChecklist.filter((item) => item.complete).length;
  const completionPct = Math.round((completedSetupCount / setupChecklist.length) * 100);
  const nextFocus = setupChecklist.find((item) => !item.complete);
  const stats = snapshot?.stats || {
    totalPosts: 0,
    ventPosts: 0,
    savedPosts: 0,
    totalListings: 0,
  };

  const completionCopy = nextFocus
    ? `Next best step: ${nextFocus.label.toLowerCase()}.`
    : 'Your account is fully ready for crew intel, marketplace, and community access.';

  const quickLaunchCards = [
    {
      title: 'Profile',
      hint: 'Photo, airline, base airport, and SOS contact',
      icon: 'person-circle-outline' as const,
      color: theme.colors.primary,
      onPress: () => router.push('/settings'),
    },
    {
      title: 'Community',
      hint: 'Posts, vents, and layover intel',
      icon: 'people-outline' as const,
      color: theme.colors.accent,
      onPress: () => router.push('/community'),
    },
    {
      title: 'Marketplace',
      hint: 'Crash pads, rooms, and gear',
      icon: 'storefront-outline' as const,
      color: theme.colors.success,
      onPress: () => router.push('/marketplace'),
    },
    {
      title: profile.verifiedCrew ? 'Create listing' : 'Verification path',
      hint: profile.verifiedCrew ? 'Post inventory fast' : 'Unlock the trusted layer',
      icon: profile.verifiedCrew ? ('add-outline' as const) : ('shield-half-outline' as const),
      color: theme.colors.text,
      onPress: () => (profile.verifiedCrew ? router.push('/create-listing') : router.push('/manual-review')),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Crew Dashboard</Text>
            <Text style={styles.heroTitle}>Run your account from one ops-ready view</Text>
            <Text style={styles.heroSubtitle}>
              Verification, profile health, marketplace activity, and community presence all stay synced between app and web.
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={18} color={theme.colors.background} />
                <Text style={styles.primaryActionText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() =>
                  profile.verifiedCrew ? router.push('/create-listing') : router.push('/manual-review')
                }
              >
                <Ionicons
                  name={profile.verifiedCrew ? 'add-circle-outline' : 'shield-checkmark-outline'}
                  size={18}
                  color={theme.colors.text}
                />
                <Text style={styles.secondaryActionText}>
                  {profile.verifiedCrew ? 'New Listing' : 'Finish Verification'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostAction} onPress={() => void handleSignOut()} disabled={isSubmitting}>
                <Ionicons name="log-out-outline" size={18} color={theme.colors.textMuted} />
                <Text style={styles.ghostActionText}>{isSubmitting ? 'Signing Out...' : 'Sign Out'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.accountCard}>
            <View style={styles.accountTopRow}>
              <View style={styles.accountIdentity}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.accountAvatar} />
                ) : (
                  <View style={styles.accountAvatarFallback}>
                    <Text style={styles.accountAvatarFallbackText}>{getInitials(displayName)}</Text>
                  </View>
                )}
                <View style={styles.accountIdentityCopy}>
                  <Text style={styles.accountName}>{displayName}</Text>
                  <Text style={styles.accountMeta}>
                    {[displayAirline, profile.roleLabel].filter(Boolean).join(' • ')}
                  </Text>
                  <Text style={styles.accountMetaSecondary}>{fullBaseLabel}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { borderColor: verificationColor + '40', backgroundColor: verificationColor + '18' },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={14} color={verificationColor} />
                <Text style={[styles.statusBadgeText, { color: verificationColor }]}>
                  {CrewVerificationService.getStatusLabel(profile.verificationStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Account readiness</Text>
                <Text style={styles.progressValue}>{completionPct}%</Text>
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
              <Text style={styles.progressHint}>{completionCopy}</Text>
            </View>

            <View style={styles.accountInfoGrid}>
              <View style={styles.accountInfoBlock}>
                <Text style={styles.accountInfoLabel}>Work Email</Text>
                <Text style={styles.accountInfoValue}>{displayEmail}</Text>
              </View>
              <View style={styles.accountInfoBlock}>
                <Text style={styles.accountInfoLabel}>Favorite Hubs</Text>
                <Text style={styles.accountInfoValue}>
                  {profile.preferences.favoriteAirports.join(', ') || profile.baseAirport}
                </Text>
                <TouchableOpacity onPress={() => router.push('/favorite-hubs')}>
                  <Text style={styles.accountInfoLink}>Edit hubs</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.accountInfoBlock}>
                <Text style={styles.accountInfoLabel}>SOS Contact</Text>
                <Text style={styles.accountInfoValue}>{profile.emergencyPhone || 'Add one in settings'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Posts', value: stats.totalPosts, icon: 'chatbubble-ellipses-outline' as const },
            { label: 'Vents', value: stats.ventPosts, icon: 'flame-outline' as const },
            { label: 'Saved', value: stats.savedPosts, icon: 'bookmark-outline' as const },
            { label: 'Listings', value: stats.totalListings, icon: 'home-outline' as const },
          ].map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Ionicons name={item.icon} size={18} color={theme.colors.accent} />
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.mainGrid}>
          <View style={styles.leftColumn}>
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>What Needs Attention</Text>
                <Text style={styles.panelMeta}>{completedSetupCount}/{setupChecklist.length} complete</Text>
              </View>
              <View style={styles.checklistWrap}>
                {setupChecklist.map((item) => (
                  <View key={item.label} style={styles.checklistRow}>
                    <View
                      style={[
                        styles.checkIconWrap,
                        {
                          backgroundColor: item.complete ? theme.colors.success + '18' : theme.colors.accent + '18',
                          borderColor: item.complete ? theme.colors.success + '40' : theme.colors.accent + '40',
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.complete ? 'checkmark' : 'ellipse-outline'}
                        size={14}
                        color={item.complete ? theme.colors.success : theme.colors.accent}
                      />
                    </View>
                    <View style={styles.checklistCopy}>
                      <Text style={styles.checklistTitle}>{item.label}</Text>
                      <Text style={styles.checklistDetail}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Member Preferences</Text>
                <Text style={styles.panelMeta}>Live from your shared profile</Text>
              </View>
              <View style={styles.chipWrap}>
                {preferenceChips.map((chip) => (
                  <View key={chip.label} style={styles.preferenceChip}>
                    <Ionicons name={chip.icon} size={14} color={theme.colors.accent} />
                    <Text style={styles.preferenceChipText}>{chip.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Recent Community Activity</Text>
                <TouchableOpacity onPress={() => router.push('/community')}>
                  <Text style={styles.linkText}>Open community</Text>
                </TouchableOpacity>
              </View>
              {isLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator color={theme.colors.accent} />
                </View>
              ) : errorMessage ? (
                <Text style={styles.emptyText}>{errorMessage}</Text>
              ) : snapshot?.recentPosts.length ? (
                snapshot.recentPosts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.activityRow}
                    onPress={() => router.push(`/post/${post.id}`)}
                  >
                    <View style={styles.activityIconWrap}>
                      <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.colors.primary} />
                    </View>
                    <View style={styles.activityBody}>
                      <Text style={styles.activityTitle}>{post.title}</Text>
                      <Text style={styles.activityMeta}>
                        {post.category} • {formatTimestamp(post.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No posts yet. Your next app or web post will show up here.</Text>
              )}
            </View>
          </View>

          <View style={styles.rightColumn}>
            <View style={[styles.panel, styles.highlightPanel]}>
              <Text style={styles.panelTitle}>Account Snapshot</Text>
              <Text style={styles.snapshotLead}>
                {profile.verifiedCrew
                  ? 'Crew verification is active and your shared account is live across app and web.'
                  : 'Your account is active, but crew verification still needs to be completed to unlock the trusted layer.'}
              </Text>
              <View style={styles.snapshotList}>
                <Text style={styles.snapshotItem}>Base airport: {profile.baseAirport}</Text>
                <Text style={styles.snapshotItem}>Active ops airport: {profile.preferences.activeOpsAirport}</Text>
                <Text style={styles.snapshotItem}>
                  Favorite hubs: {profile.preferences.favoriteAirports.join(', ') || profile.baseAirport}
                </Text>
                <Text style={styles.snapshotItem}>
                  Marketplace access: {profile.verifiedCrew ? 'Unlocked' : 'Pending crew verification'}
                </Text>
                <Text style={styles.snapshotItem}>
                  Manual review fallback: {profile.verificationMethod === 'MANUAL_REVIEW' ? 'Enabled' : 'Available'}
                </Text>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Quick Launch</Text>
                <Text style={styles.panelMeta}>High-traffic profile actions</Text>
              </View>
              <View style={styles.quickActionGrid}>
                {quickLaunchCards.map((card) => (
                  <TouchableOpacity key={card.title} style={styles.quickActionCard} onPress={card.onPress}>
                    <Ionicons name={card.icon} size={18} color={card.color} />
                    <Text style={styles.quickActionTitle}>{card.title}</Text>
                    <Text style={styles.quickActionHint}>{card.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Recent Marketplace Activity</Text>
                <TouchableOpacity onPress={() => router.push('/marketplace')}>
                  <Text style={styles.linkText}>Open marketplace</Text>
                </TouchableOpacity>
              </View>
              {isLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator color={theme.colors.accent} />
                </View>
              ) : errorMessage ? (
                <Text style={styles.emptyText}>{errorMessage}</Text>
              ) : snapshot?.recentListings.length ? (
                snapshot.recentListings.map((listing) => (
                  <TouchableOpacity
                    key={listing.id}
                    style={styles.activityRow}
                    onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
                  >
                    <View style={styles.activityIconWrap}>
                      <Ionicons name="home-outline" size={16} color={theme.colors.accent} />
                    </View>
                    <View style={styles.activityBody}>
                      <Text style={styles.activityTitle}>{listing.title}</Text>
                      <Text style={styles.activityMeta}>
                        {getListingCategoryLabel(listing.category)} • {listing.airportCode} • ${listing.priceMonthly}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No listings yet. Listings you create on web or app will appear here.</Text>
              )}
            </View>
          </View>
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
      paddingBottom: 48,
    },
    hero: {
      gap: theme.spacing.md,
    },
    heroCopy: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    eyebrow: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 34,
      fontWeight: '900',
    },
    heroSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 16,
      lineHeight: 24,
      maxWidth: 760,
    },
    heroActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: theme.roundness.full,
    },
    primaryActionText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: theme.roundness.full,
    },
    secondaryActionText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    ghostAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    ghostActionText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    accountCard: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    accountTopRow: {
      gap: theme.spacing.sm,
    },
    accountIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    accountIdentityCopy: {
      flex: 1,
    },
    accountAvatar: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    accountAvatarFallback: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 0, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 0, 255, 0.28)',
    },
    accountAvatarFallbackText: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    accountName: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    accountMeta: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 4,
    },
    accountMetaSecondary: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    progressCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 10,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    progressValue: {
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
    progressHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    accountInfoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    accountInfoBlock: {
      minWidth: 220,
      flexGrow: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    accountInfoLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    accountInfoValue: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
      lineHeight: 22,
    },
    accountInfoLink: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 10,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    statCard: {
      minWidth: 150,
      flexGrow: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: 10,
    },
    statValue: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
    },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    mainGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
      alignItems: 'flex-start',
    },
    leftColumn: {
      flex: 1,
      minWidth: 340,
      gap: theme.spacing.md,
    },
    rightColumn: {
      flex: 1,
      minWidth: 320,
      gap: theme.spacing.md,
    },
    panel: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    highlightPanel: {
      backgroundColor: theme.colors.cardSoft,
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    panelTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      flex: 1,
    },
    panelMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    checklistWrap: {
      gap: theme.spacing.md,
    },
    checklistRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'flex-start',
    },
    checkIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checklistCopy: {
      flex: 1,
      gap: 3,
    },
    checklistTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    checklistDetail: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    preferenceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
    },
    preferenceChipText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    linkText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '800',
    },
    loadingState: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    activityRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    activityIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityBody: {
      flex: 1,
      gap: 4,
    },
    activityTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    activityMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    snapshotLead: {
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '700',
    },
    snapshotList: {
      gap: 8,
    },
    snapshotItem: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    quickActionGrid: {
      gap: theme.spacing.sm,
    },
    quickActionCard: {
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      gap: 8,
    },
    quickActionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    quickActionHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
  });
