import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useProfile } from '../../src/context/ProfileContext';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { AlertCard } from '../../src/components/AlertCard';
import { PostAlertModal } from '../../src/components/PostAlertModal';
import { Alert, AlertType } from '../../src/types/alerts';
import { TSAUpdate } from '../../src/types/tsa';
import { AlertService } from '../../src/services/AlertService';
import { AirportStatus, FlightDataService } from '../../src/services/FlightDataService';
import { AppSyncService } from '../../src/services/AppSyncService';
import { TSAService } from '../../src/services/TSAService';
import { getActiveOpsAirportCode, getAirportDisplayName } from '../../src/utils/airportContext';
import { CREW_INTEL_FILTERS } from '../../src/constants/crewIntelCategories';

type IntelView = 'ops' | 'crew';

interface OpsFeedCard {
  id: string;
  label: string;
  title: string;
  detail: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}

function OpsFeedCardRow({ item, theme }: { item: OpsFeedCard; theme: AppTheme }) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.opsFeedCard, { borderColor: `${item.tone}44` }]}>
      <View style={styles.opsFeedHeader}>
        <View style={styles.opsFeedLabelRow}>
          <Ionicons name={item.icon as any} size={18} color={item.tone} />
          <Text style={[styles.opsFeedLabel, { color: item.tone }]}>{item.label}</Text>
        </View>
        <Text style={styles.opsFeedMeta}>{item.meta}</Text>
      </View>
      <Text style={styles.opsFeedTitle}>{item.title}</Text>
      <Text style={styles.opsFeedDetail}>{item.detail}</Text>
    </View>
  );
}

export default function IntelScreen() {
  const { theme } = useTheme();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const [intelFeed, setIntelFeed] = useState<Alert[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [activeView, setActiveView] = useState<IntelView>('ops');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [airportStatus, setAirportStatus] = useState<AirportStatus | null>(null);
  const [apiTsaUpdates, setApiTsaUpdates] = useState<TSAUpdate[]>([]);
  const activeAirportCode = getActiveOpsAirportCode(profile);
  const activeAirportName = getAirportDisplayName(activeAirportCode);

  const loadIntel = useCallback(async (airportCode: string) => {
    const data = await AlertService.getAlerts(airportCode);
    setIntelFeed(data);
  }, []);

  const loadOpsFeeds = useCallback(async (code: string) => {
    const [status, tsaUpdates] = await Promise.all([
      FlightDataService.getAirportStatus(code),
      TSAService.getLatestUpdates(code).catch((error) => {
        console.warn('TSA ops feed unavailable:', error);
        return [] as TSAUpdate[];
      }),
    ]);
    setAirportStatus(status);
    setApiTsaUpdates(tsaUpdates);
  }, []);

  const refreshIntel = useCallback(async () => {
    await Promise.all([loadIntel(activeAirportCode), loadOpsFeeds(activeAirportCode)]);
  }, [activeAirportCode, loadOpsFeeds, loadIntel]);

  useFocusEffect(
    useCallback(() => {
      void refreshIntel();
    }, [refreshIntel])
  );

  useEffect(() => {
    void refreshIntel();

    const subscription = AlertService.subscribeToAlerts(activeAirportCode, (newIntelItem) => {
      setIntelFeed((prev) => {
        if (prev.some((item) => item.id === newIntelItem.id)) {
          return prev;
        }

        return [newIntelItem, ...prev];
      });
      void loadOpsFeeds(activeAirportCode);
    });
    const tsaSubscription = TSAService.subscribeToUpdates(() => {
      void loadOpsFeeds(activeAirportCode);
    });
    const unsubscribe = AppSyncService.subscribe((event) => {
      if (event === 'profile' || event === 'community') {
        void refreshIntel();
      }
    });

    return () => {
      subscription.unsubscribe();
      tsaSubscription.unsubscribe();
      unsubscribe();
    };
  }, [activeAirportCode, loadOpsFeeds, refreshIntel]);

  const filteredIntel = filter === 'ALL' ? intelFeed : intelFeed.filter((item) => item.type === filter);
  const criticalCount = intelFeed.filter((item) => item.isCritical || item.type === AlertType.SAFETY).length;
  const opsFeedCards: OpsFeedCard[] = airportStatus
    ? [
        {
          id: 'faa',
          label: 'FAA status',
          title: airportStatus.faaDelay ? 'Flow delay active' : 'Normal flow',
          detail: airportStatus.faaDelayReason || 'No major ATC program reported for this airport.',
          meta: 'FAA feed',
          icon: 'airplane-outline',
          tone: airportStatus.faaDelay ? theme.colors.error : theme.colors.success,
        },
        {
          id: 'tsa-summary',
          label: 'TSA/KCM',
          title: airportStatus.tsaWaitTimeMins == null ? 'Wait unavailable' : `${airportStatus.tsaWaitTimeMins} min airport average`,
          detail:
            airportStatus.tsaWaitTimeMins == null
              ? 'No TSA wait-time provider has returned current data for this airport yet.'
              : `${airportStatus.tsaSourceLabel} • ${airportStatus.tsaConfidenceScore}% confidence`,
          meta: airportStatus.tsaSourceType === 'partner' ? 'API estimate' : airportStatus.tsaSourceLabel,
          icon: 'body-outline',
          tone:
            airportStatus.tsaWaitTimeMins == null
              ? theme.colors.textMuted
              : airportStatus.tsaWaitTimeMins > 20
                ? theme.colors.error
                : theme.colors.success,
        },
        ...apiTsaUpdates.slice(0, 6).map((update) => ({
          id: `tsa-${update.terminal}`,
          label: 'Checkpoint',
          title: `${update.terminal} • ${update.waitTimeMins} min`,
          detail: `${update.sourceLabel} • ${update.confidenceScore}% confidence`,
          meta: update.providerId.toUpperCase(),
          icon: 'walk-outline' as const,
          tone: update.waitTimeMins > 20 ? theme.colors.error : theme.colors.success,
        })),
      ]
    : [];
  const intelSummaryCards = [
    {
      label: 'Ops feeds',
      value: airportStatus ? String(Math.max(2, opsFeedCards.length)) : '...',
      detail: airportStatus ? 'FAA and TSA data connected' : 'Loading live airport feeds',
      tone: theme.colors.accent,
    },
    {
      label: 'Crew reports',
      value: String(intelFeed.length),
      detail: intelFeed.length > 0 ? `${criticalCount} need quick review` : 'No user reports yet',
      tone: criticalCount > 0 ? theme.colors.error : theme.colors.success,
    },
  ];

  const handleReportIntel = async (type: AlertType, title: string, message: string) => {
    try {
      const createdAlert = await AlertService.createAlert({
        type,
        message,
        location: activeAirportCode,
        title,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });

      setIntelFeed((prev) => {
        if (prev.some((item) => item.id === createdAlert.id)) {
          return prev;
        }

        return [createdAlert, ...prev];
      });
      setIsModalVisible(false);
    } catch (err: any) {
      console.warn('Failed to share intel:', err);
      RNAlert.alert(
        'Publishing Failed',
        err instanceof Error ? err.message : 'An unknown error occurred while posting the crew report.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroShell}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Crew Intel</Text>
          <Text style={styles.locationSub}>
            Live ops view • {activeAirportCode} • {activeAirportName}
          </Text>
        </View>

        {airportStatus && (
          <View style={styles.statusBanner}>
            <View style={styles.statusItem}>
              <Ionicons name="airplane" size={18} color={airportStatus.faaDelay ? theme.colors.error : theme.colors.success} />
              <View>
                <Text style={styles.statusLabel}>FAA Status</Text>
                <Text style={[styles.statusValue, { color: airportStatus.faaDelay ? theme.colors.error : theme.colors.success }]}>
                  {airportStatus.faaDelay ? 'Delayed' : 'Normal'}
                </Text>
              </View>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Ionicons
                name="body"
                size={18}
                color={
                  airportStatus.tsaWaitTimeMins == null
                    ? theme.colors.textMuted
                    : airportStatus.tsaWaitTimeMins > 20
                      ? theme.colors.error
                      : theme.colors.success
                }
              />
              <View>
                <Text style={styles.statusLabel}>TSA Wait</Text>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color:
                        airportStatus.tsaWaitTimeMins == null
                          ? theme.colors.textMuted
                          : airportStatus.tsaWaitTimeMins > 20
                            ? theme.colors.error
                            : theme.colors.success,
                    },
                  ]}
                >
                  {airportStatus.tsaWaitTimeMins == null ? 'Unavailable' : `${airportStatus.tsaWaitTimeMins} mins`}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.summaryRow}>
          {intelSummaryCards.map((item) => (
            <View key={item.label} style={[styles.summaryCard, { borderColor: `${item.tone}30` }]}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={[styles.summaryValue, { color: item.tone }]}>{item.value}</Text>
              <Text style={styles.summaryDetail} numberOfLines={2}>
                {item.detail}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {!profile.verifiedCrew && (
        <CrewLockBanner message="Sharing new crew intel is locked until your crew verification is complete." />
      )}

      <View style={styles.viewSwitchContainer}>
        {[
          { key: 'ops' as const, label: 'Ops feeds' },
          { key: 'crew' as const, label: 'Crew reports' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.viewSwitchButton, activeView === item.key && styles.viewSwitchButtonActive]}
            onPress={() => setActiveView(item.key)}
          >
            <Text style={[styles.viewSwitchText, activeView === item.key && styles.viewSwitchTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeView === 'crew' && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            {CREW_INTEL_FILTERS.map((cat) => (
              <TouchableOpacity
                key={cat.type}
                style={[styles.filterTab, filter === cat.type && styles.filterTabActive]}
                onPress={() => setFilter(cat.type)}
              >
                <Ionicons
                  name={cat.icon}
                  size={18}
                  color={filter === cat.type ? theme.colors.background : theme.colors.textMuted}
                />
                <Text style={[styles.filterText, filter === cat.type && styles.filterTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {activeView === 'ops' ? (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 88 }]}>
          {opsFeedCards.length > 0 ? (
            opsFeedCards.map((item) => <OpsFeedCardRow key={item.id} item={item} theme={theme} />)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyText}>Loading live ops feeds for {activeAirportCode}.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredIntel}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 88 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyText}>
                {filter === 'ALL' ? 'No crew reports yet for this airport.' : 'No crew reports in this category yet.'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: tabBarHeight + 16 }, !profile.verifiedCrew && styles.fabDisabled]}
        onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
        accessibilityLabel="Report crew intel"
        disabled={!profile.verifiedCrew}
      >
        <Ionicons name="add" size={32} color={theme.colors.background} />
      </TouchableOpacity>

      <PostAlertModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onReport={handleReportIntel}
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
    heroShell: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 12,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 2,
    },
    header: {
      paddingTop: 2,
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '900',
    },
    locationSub: {
      color: theme.colors.accent,
      fontSize: 14,
      opacity: 0.8,
    },
    statusBanner: {
      flexDirection: 'row',
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
    },
    summaryLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 6,
    },
    summaryDetail: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statusDivider: {
      width: 1,
      height: 30,
      backgroundColor: theme.colors.border,
    },
    statusLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: 'bold',
    },
    statusValue: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    filtersContainer: {
      marginBottom: 6,
    },
    viewSwitchContainer: {
      flexDirection: 'row',
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 4,
      gap: 4,
    },
    viewSwitchButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: theme.roundness.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
    },
    viewSwitchButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    viewSwitchText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '900',
    },
    viewSwitchTextActive: {
      color: theme.colors.background,
    },
    filtersScroll: {
      paddingHorizontal: theme.spacing.md,
      gap: 8,
    },
    filterTab: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: theme.roundness.full,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterTabActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    filterTextActive: {
      color: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    opsFeedCard: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.lg,
      padding: 18,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    opsFeedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    opsFeedLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    opsFeedLabel: {
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    opsFeedMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    opsFeedTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 6,
    },
    opsFeedDetail: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    fabDisabled: {
      opacity: 0.4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 100,
    },
    emptyText: {
      color: theme.colors.textMuted,
      marginTop: 16,
      fontSize: 16,
    },
  });
