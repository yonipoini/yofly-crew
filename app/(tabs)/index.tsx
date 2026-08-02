import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AlertCard } from '../../src/components/AlertCard';
import { TSAReportModal } from '../../src/components/TSAReportModal';
import { TSAStatusCard } from '../../src/components/TSAStatusCard';
import { WeatherWidget } from '../../src/components/WeatherWidget';
import { useProfile } from '../../src/context/ProfileContext';
import { useAuth } from '../../src/context/AuthContext';
import { OpsIntelService } from '../../src/services/OpsIntelService';
import { TSAService } from '../../src/services/TSAService';
import { AppSyncService } from '../../src/services/AppSyncService';
import { useUnreadNotificationCount } from '../../src/hooks/useUnreadNotificationCount';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { FlightBoardEntry, OpsSignal, CrewOpsSnapshot } from '../../src/types/ops';
import { TSAStatus } from '../../src/types/tsa';
import { WeatherAlert } from '../../src/types/weather';
import {
  getProfileDisplayAirline,
  getProfileDisplayName,
} from '../../src/utils/profilePresentation';

const getUrgencyColor = (theme: AppTheme, urgency: OpsSignal['urgency']) => {
  switch (urgency) {
    case 'critical':
      return theme.colors.error;
    case 'watch':
      return '#F59E0B';
    default:
      return theme.colors.success;
  }
};

function FlightRow({ entry, theme }: { entry: FlightBoardEntry; theme: AppTheme }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const accentColor = getUrgencyColor(theme, entry.urgency);

  return (
    <View style={styles.flightCard}>
      <View style={styles.flightTimeColumn}>
        <Text style={styles.flightTime}>{entry.scheduledTime}</Text>
        <Text style={styles.flightSource}>{entry.source === 'live' ? 'Live' : 'Plan'}</Text>
        <Text style={styles.flightMovement}>
          {entry.movementType === 'arrival' ? 'Arrival' : 'Departure'}
        </Text>
      </View>
      <View style={styles.flightMainColumn}>
        <View style={styles.flightTopRow}>
          <Text style={styles.flightNumber}>{entry.flightNumber}</Text>
          <View style={[styles.flightStatusPill, { backgroundColor: `${accentColor}20` }]}>
            <Text style={[styles.flightStatusText, { color: accentColor }]}>{entry.statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.flightRoute}>{entry.route}</Text>
        <Text style={styles.flightDetail}>
          {[entry.terminal && `Terminal ${entry.terminal}`, entry.gate && `Gate ${entry.gate}`, entry.detail]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile, mergeProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [snapshot, setSnapshot] = useState<CrewOpsSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTSAModalVisible, setIsTSAModalVisible] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<OpsSignal | null>(null);
  const [showAllDepartures, setShowAllDepartures] = useState(false);
  const [showAllArrivals, setShowAllArrivals] = useState(false);
  const { unreadCount } = useUnreadNotificationCount(user?.id);
  const unreadPulse = React.useRef(new Animated.Value(0)).current;
  const hasUnreadNotifications = unreadCount > 0;

  const selectedOpsAirport =
    profile.preferences.opsContextMode === 'LAYOVER' && profile.preferences.layoverAirport
      ? profile.preferences.layoverAirport
      : profile.preferences.opsContextMode === 'TRIP' && profile.preferences.tripAirport
      ? profile.preferences.tripAirport
      : profile.preferences.opsContextMode === 'MANUAL'
      ? profile.preferences.activeOpsAirport || profile.baseAirport || 'JFK'
      : profile.baseAirport || 'JFK';
  const airportSelectorCodes = Array.from(
    new Set([selectedOpsAirport, profile.baseAirport, ...profile.preferences.favoriteAirports].filter(Boolean))
  );
  const contextOptions: Array<{
    key: 'BASE' | 'LAYOVER' | 'TRIP' | 'MANUAL';
    label: string;
  }> = [
    { key: 'BASE', label: `Home base ${profile.baseAirport}` },
    ...(profile.preferences.layoverAirport
      ? [{ key: 'LAYOVER' as const, label: `Layover ${profile.preferences.layoverAirport}` }]
      : []),
    ...(profile.preferences.tripAirport
      ? [{ key: 'TRIP' as const, label: `Trip stop ${profile.preferences.tripAirport}` }]
      : []),
    { key: 'MANUAL' as const, label: 'Choose manually' },
  ];
  const currentFocusLabel =
    profile.preferences.opsContextMode === 'LAYOVER'
      ? 'Showing updates for your current layover airport.'
      : profile.preferences.opsContextMode === 'TRIP'
      ? 'Showing updates for the airport tied to your trip.'
      : profile.preferences.opsContextMode === 'MANUAL'
      ? 'Pick one saved airport below when you want to look somewhere else.'
      : 'Showing updates for your home base.';

  const loadSnapshot = useCallback(async () => {
    const nextSnapshot = await OpsIntelService.getSnapshot(selectedOpsAirport);
    setSnapshot(nextSnapshot);
  }, [selectedOpsAirport]);

  useFocusEffect(
    useCallback(() => {
      void loadSnapshot();
    }, [loadSnapshot])
  );

  useEffect(() => {
    void loadSnapshot();
    setShowAllDepartures(false);
    setShowAllArrivals(false);

    const subscription = TSAService.subscribeToUpdates(() => {
      void loadSnapshot();
    });
    const unsubscribe = AppSyncService.subscribe((event) => {
      if (event === 'profile' || event === 'community') {
        void loadSnapshot();
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribe();
    };
  }, [loadSnapshot]);

  useEffect(() => {
    if (!hasUnreadNotifications) {
      unreadPulse.stopAnimation();
      unreadPulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(unreadPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(unreadPulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [hasUnreadNotifications, unreadPulse]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSnapshot();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReportTSA = async (status: TSAStatus, waitTime: number) => {
    try {
      const userAirport = activeAirportCode || profile.baseAirport || 'JFK';
      await TSAService.reportWaitTime(userAirport, 'T4', waitTime, status);
      setIsTSAModalVisible(false);
      await loadSnapshot();
    } catch (error) {
      console.error('Failed to report TSA:', error);
    }
  };

  const opsSignals = snapshot?.operationalSignals || [];
  const flightBoard = snapshot?.flightBoard || [];
  const weatherAlerts = snapshot?.weatherAlerts || [];
  const headlineAlerts = snapshot?.headlineAlerts || [];
  const tsaUpdates = snapshot?.tsaUpdates || [];
  const activeAirportCode = snapshot?.airportCode || selectedOpsAirport;
  const activeAirportName = snapshot?.airportName || 'Crew base';
  const displayName = getProfileDisplayName(profile);
  const displayAirline = getProfileDisplayAirline(profile);
  const preferredAirlines = profile.preferences.preferredAirlines;
  const prioritizedFlightBoard = [...flightBoard].sort((left, right) => {
    const leftCode = left.flightNumber.replace(/[0-9].*$/, '');
    const rightCode = right.flightNumber.replace(/[0-9].*$/, '');
    const leftPreferred = preferredAirlines.includes(leftCode);
    const rightPreferred = preferredAirlines.includes(rightCode);

    if (leftPreferred !== rightPreferred) {
      return leftPreferred ? -1 : 1;
    }

    return left.scheduledTime.localeCompare(right.scheduledTime);
  });
  const departures = prioritizedFlightBoard.filter((entry) => entry.movementType === 'departure');
  const arrivals = prioritizedFlightBoard.filter((entry) => entry.movementType === 'arrival');
  const prioritySignal =
    opsSignals.find((signal) => signal.urgency === 'critical') ||
    opsSignals.find((signal) => signal.urgency === 'watch') ||
    opsSignals[0];
  const nextDeparture = departures[0];
  const nextArrival = arrivals[0];
  const statsCards = [
    { label: 'Flights', value: String(prioritizedFlightBoard.length || 0) },
    { label: 'TSA Posts', value: String(tsaUpdates.length || 0) },
    { label: 'Alerts', value: String(headlineAlerts.length || 0) },
  ];
  const updatedLabel = snapshot
    ? new Date(snapshot.collectedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Loading';
  const topTsaUpdate = tsaUpdates[0];
  const airportBriefCards = [
    {
      label: 'TSA focus',
      value:
        topTsaUpdate?.terminal
          ? `${topTsaUpdate.terminal} ${topTsaUpdate.waitTimeMins}m`
          : snapshot?.airportStatus.tsaWaitTimeMins != null
            ? `${snapshot.airportStatus.tsaWaitTimeMins}m avg`
            : 'Live pending',
      detail:
        topTsaUpdate?.sourceLabel
          ? `${topTsaUpdate.sourceLabel} • ${topTsaUpdate.confidenceScore}% confidence`
          : `Waiting on stronger ${activeAirportCode} checkpoint coverage`,
      tone:
        snapshot?.airportStatus.tsaWaitTimeMins != null && snapshot.airportStatus.tsaWaitTimeMins > 20
          ? theme.colors.error
          : theme.colors.accent,
    },
    {
      label: 'Weather window',
      value: snapshot?.weather?.flightCategory || 'WX pending',
      detail: snapshot?.weather
        ? `${snapshot.weather.conditionLabel} • ${snapshot.weather.wind}`
        : `Weather feed is still syncing for ${activeAirportCode}`,
      tone:
        snapshot?.weather?.flightCategory && snapshot.weather.flightCategory !== 'VFR'
          ? '#F59E0B'
          : theme.colors.success,
    },
    {
      label: 'Crew pulse',
      value: headlineAlerts.length > 0 ? `${headlineAlerts.length} active` : 'Quiet flow',
      detail:
        headlineAlerts[0]?.title ||
        `${departures.length} departures and ${arrivals.length} arrivals are on the board`,
      tone: headlineAlerts.length > 0 ? theme.colors.primary : theme.colors.text,
    },
  ];
  const briefingCards = [
    {
      key: 'priority',
      icon: prioritySignal?.urgency === 'critical' ? 'warning' : 'pulse-outline',
      label: prioritySignal?.urgency === 'critical' ? 'Priority watch' : 'Ops pulse',
      title: prioritySignal?.value || 'Steady flow',
      detail: prioritySignal?.detail || `${activeAirportCode} is quiet across the current crew feeds.`,
      tone: prioritySignal ? getUrgencyColor(theme, prioritySignal.urgency) : theme.colors.success,
      action: 'Review',
      onPress: () => router.push('/alerts'),
    },
    {
      key: 'departure',
      icon: 'airplane-outline',
      label: 'Next departure',
      title: nextDeparture ? `${nextDeparture.flightNumber} ${nextDeparture.scheduledTime}` : 'No departure rows',
      detail: nextDeparture
        ? `${nextDeparture.route}${nextDeparture.gate ? ` • Gate ${nextDeparture.gate}` : ''}`
        : 'Live departure rows will appear here when available.',
      tone: nextDeparture ? getUrgencyColor(theme, nextDeparture.urgency) : theme.colors.textMuted,
      action: 'Board',
      onPress: () => router.push('/dashboard'),
    },
    {
      key: 'arrival',
      icon: 'swap-vertical-outline',
      label: 'Inbound cue',
      title: nextArrival ? `${nextArrival.flightNumber} ${nextArrival.scheduledTime}` : 'No arrival rows',
      detail: nextArrival
        ? `${nextArrival.route}${nextArrival.terminal ? ` • Terminal ${nextArrival.terminal}` : ''}`
        : 'Inbound flow is quiet for this airport right now.',
      tone: nextArrival ? getUrgencyColor(theme, nextArrival.urgency) : theme.colors.textMuted,
      action: 'Map',
      onPress: () => router.push('/map'),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.navHeader}>
            <View style={styles.heroBrandRow}>
              <View style={styles.logoFrame}>
                <Image source={require('../../assets/logo-transparent.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.heroTextColumn}>
                <Text style={styles.heroEyebrow}>Welcome back</Text>
                <Text style={styles.heroTitle}>{displayName}</Text>
                <Text style={styles.heroSubtitle}>{displayAirline}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.notificationBtn,
                hasUnreadNotifications && styles.notificationBtnUnread,
              ]}
              onPress={() => router.push('/notifications')}
            >
              {hasUnreadNotifications ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.notificationPulse,
                    {
                      opacity: unreadPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35, 0],
                      }),
                      transform: [
                        {
                          scale: unreadPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.75],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              <Ionicons
                name={hasUnreadNotifications ? 'notifications' : 'notifications-outline'}
                size={20}
                color={hasUnreadNotifications ? theme.colors.primary : theme.colors.text}
              />
              {hasUnreadNotifications ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.locationPill}>
            <Ionicons name="location-sharp" size={14} color={theme.colors.accent} />
            <Text style={styles.locationPillText}>
              {activeAirportCode} - {activeAirportName}
            </Text>
          </View>

          <View style={styles.briefingPanel}>
            <View style={styles.briefingHeader}>
              <View>
                <Text style={styles.briefingEyebrow}>Crew briefing</Text>
                <Text style={styles.briefingTitle}>{activeAirportCode} right now</Text>
              </View>
              <TouchableOpacity style={styles.briefingRefreshButton} onPress={() => void handleRefresh()}>
                <Ionicons name="refresh" size={15} color={theme.colors.background} />
                <Text style={styles.briefingRefreshText}>Sync</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.briefingGrid}>
              {briefingCards.map((card) => (
                <TouchableOpacity
                  key={card.key}
                  style={[styles.briefingCard, { borderColor: `${card.tone}35` }]}
                  onPress={card.onPress}
                >
                  <View style={styles.briefingCardTopRow}>
                    <View style={[styles.briefingIconWrap, { backgroundColor: card.tone }]}>
                      <Ionicons
                        name={card.icon as keyof typeof Ionicons.glyphMap}
                        size={15}
                        color={theme.colors.background}
                      />
                    </View>
                    <Text style={[styles.briefingActionText, { color: card.tone }]}>{card.action}</Text>
                  </View>
                  <Text style={styles.briefingCardLabel}>{card.label}</Text>
                  <Text style={styles.briefingCardTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <Text style={styles.briefingCardDetail} numberOfLines={2}>
                    {card.detail}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Ops Snapshot</Text>
              <Text style={styles.statsMeta}>{updatedLabel}</Text>
            </View>
            <View style={styles.statsRow}>
              {statsCards.map((item, index) => (
                <View key={item.label} style={styles.statsItem}>
                  <Text style={styles.statsValue}>{item.value}</Text>
                  <Text style={styles.statsLabel}>{item.label}</Text>
                  {index < statsCards.length - 1 ? <View style={styles.statsDivider} /> : null}
                </View>
              ))}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.briefRail}
          >
            {airportBriefCards.map((item) => (
              <View key={item.label} style={[styles.briefCard, { borderColor: `${item.tone}30` }]}>
                <Text style={styles.briefLabel}>{item.label}</Text>
                <Text style={[styles.briefValue, { color: item.tone }]}>{item.value}</Text>
                <Text style={styles.briefDetail} numberOfLines={2}>
                  {item.detail}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Priority crew intel</Text>
            <TouchableOpacity onPress={() => router.push('/alerts')}>
              <Text style={styles.reportActionText}>Open feed</Text>
            </TouchableOpacity>
          </View>
          {headlineAlerts.length > 0 ? (
            headlineAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No urgent crew intel right now</Text>
              <Text style={styles.emptyBody}>
                Keep the broader feed active for shuttle issues, hotel problems, safety warnings, and airport surprises.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/alerts')}>
              <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <Ionicons name="radio-outline" size={22} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Crew Intel</Text>
              <Text style={styles.actionHint}>Report or review urgent crew updates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/map')}>
              <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.accent + '18' }]}>
                <Ionicons name="navigate-outline" size={22} color={theme.colors.accent} />
              </View>
              <Text style={styles.actionLabel}>Layover Map</Text>
              <Text style={styles.actionHint}>Find airport-area crew spots</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/community')}>
              <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Community</Text>
              <Text style={styles.actionHint}>Search rooms, tips, and crew posts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/vent')}>
              <View style={styles.actionVentIconWrap}>
                <Ionicons name="flame-outline" size={22} color="#ff2f3a" />
              </View>
              <Text style={styles.actionLabel}>Vent Room</Text>
              <Text style={styles.actionHint}>Anonymous crew pressure valve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/slam-clicker')}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#72DDE118' }]}>
                <Ionicons name="moon-outline" size={22} color="#72DDE1" />
              </View>
              <Text style={styles.actionLabel}>Slam Clicker</Text>
              <Text style={styles.actionHint}>Rest calculations, hotel wifi & stretches</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/discounts')}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#FFD16618' }]}>
                <Ionicons name="pricetag-outline" size={22} color="#FFD166" />
              </View>
              <Text style={styles.actionLabel}>Discounts</Text>
              <Text style={styles.actionHint}>Hotel rates & local crew deals</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/translator')}>
              <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.accent + '18' }]}>
                <Ionicons name="language-outline" size={22} color={theme.colors.accent} />
              </View>
              <Text style={styles.actionLabel}>Translator</Text>
              <Text style={styles.actionHint}>Real-time voice & text layover translate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/schedule-import')}>
              <View style={[styles.actionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Import Schedule</Text>
              <Text style={styles.actionHint}>Import calendar pairings & flights</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Airport Focus</Text>
            <TouchableOpacity onPress={() => router.push('/favorite-hubs')}>
              <Text style={styles.sectionMeta}>Manage Hubs</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>{currentFocusLabel}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hubSelectorRow}
          >
            {contextOptions.map((option) => {
              const active = profile.preferences.opsContextMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.hubChip, active && styles.hubChipActive]}
                  onPress={() =>
                    mergeProfile({
                      preferences: {
                        opsContextMode: option.key,
                      },
                    })
                  }
                >
                  <Text style={[styles.hubChipText, active && styles.hubChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {profile.preferences.opsContextMode === 'MANUAL' ? (
            <>
              <Text style={styles.selectorLabel}>Saved airports</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hubSelectorRow}
              >
                {airportSelectorCodes.map((airportCode) => {
                  const active = airportCode === activeAirportCode;
                  return (
                    <TouchableOpacity
                      key={airportCode}
                      style={[styles.hubChip, active && styles.hubChipActive]}
                      onPress={() =>
                        mergeProfile({
                          preferences: {
                            opsContextMode: 'MANUAL',
                            activeOpsAirport: airportCode,
                          },
                        })
                      }
                    >
                      <Text style={[styles.hubChipText, active && styles.hubChipTextActive]}>
                        {airportCode}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operational pulse</Text>
          <View style={styles.signalGrid}>
            {opsSignals.map((signal) => {
              const accentColor = getUrgencyColor(theme, signal.urgency);
              const hasDetail = !!signal.detail;
              const isLongDetail = signal.detail && signal.detail.length > 50;
              return (
                <TouchableOpacity
                  key={signal.id}
                  style={styles.signalCard}
                  disabled={!hasDetail}
                  onPress={() => setSelectedSignal(signal)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View>
                      <View style={styles.signalHeader}>
                        <Text style={styles.signalLabel}>{signal.label}</Text>
                        <View style={[styles.signalDot, { backgroundColor: accentColor }]} />
                      </View>
                      <Text style={[styles.signalValue, { color: accentColor }]} numberOfLines={1}>
                        {signal.value}
                      </Text>
                      <Text style={styles.signalDetail} numberOfLines={2}>
                        {signal.detail}
                      </Text>
                    </View>
                    {isLongDetail && (
                      <Text style={styles.moreInfoText}>More info</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <WeatherWidget
          icao={snapshot?.icao}
          airportCode={activeAirportCode}
          airportName={activeAirportName}
        />

        {weatherAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weather alerts</Text>
              <Text style={styles.sectionMeta}>NWS severe weather</Text>
            </View>
            {weatherAlerts.map((alert) => (
              <WeatherAlertRow key={alert.id} alert={alert} theme={theme} />
            ))}
          </View>
        )}

        {snapshot && (
          <View style={styles.section}>
            <View style={styles.statusStrip}>
              <View style={styles.statusItem}>
                <Ionicons
                  name="airplane"
                  size={18}
                  color={snapshot.airportStatus.faaDelay ? theme.colors.error : theme.colors.success}
                />
                <View>
                  <Text style={styles.statusLabel}>FAA status</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      {
                        color: snapshot.airportStatus.faaDelay
                          ? theme.colors.error
                          : theme.colors.success,
                      },
                    ]}
                  >
                    {snapshot.airportStatus.faaDelay ? 'Delay program' : 'Normal flow'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color={headlineAlerts.length > 0 ? theme.colors.error : theme.colors.success}
                />
                <View>
                  <Text style={styles.statusLabel}>Crew reports</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      { color: headlineAlerts.length > 0 ? theme.colors.error : theme.colors.success },
                    ]}
                  >
                    {headlineAlerts.length > 0 ? `${headlineAlerts.length} active` : 'Quiet'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Checkpoint watch</Text>
            <TouchableOpacity onPress={() => setIsTSAModalVisible(true)}>
              <Text style={styles.reportActionText}>Report Wait</Text>
            </TouchableOpacity>
          </View>
          {tsaUpdates.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tsaScrollContent}
            >
              {tsaUpdates.map((update) => (
                <TSAStatusCard key={`${update.airportCode}-${update.terminal}`} update={update} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No live checkpoint reports yet</Text>
              <Text style={styles.emptyBody}>
                Connect a TSA wait-time provider or add crew reports to populate this airport's checkpoint feed.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Departures</Text>
            <Text style={styles.sectionMeta}>
              {departures.some((entry) => entry.source === 'live') ? 'Live feed' : 'Fallback feed'}
            </Text>
          </View>
          {(showAllDepartures ? departures : departures.slice(0, 5)).map((entry) => (
            <FlightRow key={entry.id} entry={entry} theme={theme} />
          ))}
          {departures.length > 5 && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => setShowAllDepartures(!showAllDepartures)}
            >
              <Text style={styles.viewMoreText}>
                {showAllDepartures ? 'Show Less' : `View More (${departures.length - 5} more)`}
              </Text>
              <Ionicons
                name={showAllDepartures ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.accent}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Arrivals</Text>
            <Text style={styles.sectionMeta}>
              {preferredAirlines.length > 0 ? `Prioritized for ${preferredAirlines.join(', ')}` : 'Inbound flow'}
            </Text>
          </View>
          {arrivals.length > 0 ? (
            <>
              {(showAllArrivals ? arrivals : arrivals.slice(0, 5)).map((entry) => (
                <FlightRow key={entry.id} entry={entry} theme={theme} />
              ))}
              {arrivals.length > 5 && (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => setShowAllArrivals(!showAllArrivals)}
                >
                  <Text style={styles.viewMoreText}>
                    {showAllArrivals ? 'Show Less' : `View More (${arrivals.length - 5} more)`}
                  </Text>
                  <Ionicons
                    name={showAllArrivals ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.accent}
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No arrival rows available</Text>
              <Text style={styles.emptyBody}>
                The inbound board will populate as live flight data is available for this airport.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <TSAReportModal
        visible={isTSAModalVisible}
        onClose={() => setIsTSAModalVisible(false)}
        onReport={handleReportTSA}
        airport={activeAirportCode}
      />

      <Modal
        visible={!!selectedSignal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSignal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.modalLabel}>
                  {selectedSignal?.label}
                </Text>
                <Text
                  style={[
                    styles.modalValue,
                    { color: selectedSignal ? getUrgencyColor(theme, selectedSignal.urgency) : theme.colors.text }
                  ]}
                >
                  {selectedSignal?.value}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSignal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDetailText}>
                {selectedSignal?.detail}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function WeatherAlertRow({ alert, theme }: { alert: WeatherAlert; theme: AppTheme }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const accentColor = getUrgencyColor(theme, alert.urgency);

  return (
    <View style={[styles.weatherAlertCard, { borderColor: `${accentColor}55` }]}>
      <View style={styles.weatherAlertHeader}>
        <Text style={[styles.weatherAlertEvent, { color: accentColor }]}>{alert.event}</Text>
        <Text style={styles.weatherAlertSeverity}>{alert.severity}</Text>
      </View>
      <Text style={styles.weatherAlertHeadline}>{alert.headline}</Text>
      <Text style={styles.weatherAlertArea}>{alert.area}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    heroCard: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: 10,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 2,
    },
    navHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    heroBrandRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    logoFrame: {
      width: 118,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: {
      width: 118,
      height: 76,
      transform: [{ scale: 1.85 }],
    },
    heroTextColumn: {
      flex: 1,
    },
    heroEyebrow: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    heroSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    notificationBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.cardSoft,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      position: 'relative',
    },
    notificationBtnUnread: {
      backgroundColor: theme.colors.primary + '18',
      borderColor: theme.colors.primary + '99',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
      elevation: 4,
    },
    notificationPulse: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.background,
    },
    notificationBadgeText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    locationPillText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    briefingPanel: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent + '22',
      padding: 12,
      gap: 12,
    },
    briefingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    briefingEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    briefingTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    briefingRefreshButton: {
      minWidth: 72,
      height: 34,
      paddingHorizontal: 11,
      borderRadius: 17,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    briefingRefreshText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    briefingGrid: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    briefingCard: {
      flex: 1,
      minHeight: 118,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      padding: 11,
    },
    briefingCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 9,
      gap: 6,
    },
    briefingIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    briefingActionText: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    briefingCardLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 5,
    },
    briefingCardTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 5,
    },
    briefingCardDetail: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '600',
    },
    statsCard: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.primary + '33',
      padding: theme.spacing.md,
    },
    briefRail: {
      gap: theme.spacing.sm,
      paddingBottom: 2,
    },
    briefCard: {
      width: 176,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      padding: theme.spacing.md,
    },
    briefLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    briefValue: {
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 6,
    },
    briefDetail: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    statsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    statsTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    statsMeta: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    statsItem: {
      flex: 1,
      alignItems: 'center',
      position: 'relative',
    },
    statsValue: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    statsLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    statsDivider: {
      position: 'absolute',
      right: 0,
      top: 6,
      bottom: 6,
      width: 1,
      backgroundColor: theme.colors.border,
    },
    section: {
      marginTop: theme.spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    sectionHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    reportActionText: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    selectorLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    hubSelectorRow: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    hubChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    hubChipActive: {
      backgroundColor: theme.colors.primary + '18',
      borderColor: theme.colors.primary,
    },
    hubChipText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    hubChipTextActive: {
      color: theme.colors.text,
    },
    signalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    signalCard: {
      width: '47%',
      height: 142,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      padding: theme.spacing.lg,
      width: '90%',
      maxWidth: 400,
      maxHeight: '60%',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: 12,
      marginBottom: 12,
    },
    modalLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    modalValue: {
      fontSize: 22,
      fontWeight: '900',
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalBodyScroll: {
      maxHeight: 250,
    },
    modalDetailText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '600',
    },
    moreInfoText: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
    },
    signalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    signalLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: '700',
    },
    signalDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    signalValue: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    signalDetail: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    statusStrip: {
      marginHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    statusValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    statusDivider: {
      width: 1,
      height: 36,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    tsaScrollContent: {
      paddingHorizontal: theme.spacing.md,
    },
    emptyCard: {
      marginHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptyBody: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    weatherAlertCard: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
    },
    weatherAlertHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    weatherAlertEvent: {
      fontSize: 14,
      fontWeight: '800',
    },
    weatherAlertSeverity: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    weatherAlertHeadline: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    weatherAlertArea: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    flightCard: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    flightTimeColumn: {
      width: 58,
    },
    flightTime: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    flightSource: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    flightMovement: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    flightMainColumn: {
      flex: 1,
    },
    flightTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    flightNumber: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    flightStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.roundness.full,
    },
    flightStatusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    flightRoute: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    flightDetail: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
      marginTop: 0,
    },
    actionCard: {
      width: '47%',
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      alignItems: 'flex-start',
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 132,
      justifyContent: 'space-between',
    },
    actionIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    actionVentIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
      backgroundColor: '#ff2f3a18',
    },
    actionLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 4,
    },
    actionHint: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    viewMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginHorizontal: theme.spacing.sm,
      marginTop: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      gap: 6,
    },
    viewMoreText: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    bottomSpacer: {
      height: 100,
    },
  });
