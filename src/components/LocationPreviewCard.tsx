import React from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Share, ScrollView, Dimensions, Platform } from 'react-native';
import { AppTheme, useTheme } from '../theme/theme';
import { CrewLocation } from '../types/locations';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getLocationContextHint,
  getLocationMarkerColors,
  getLocationSourceBadge,
  getLocationTypeLabel,
} from '../utils/mapLocationPresentation';

interface LocationPreviewCardProps {
  location: CrewLocation;
  onClose: () => void;
  onToggleSave?: (location: CrewLocation) => void;
  onToggleRoute?: (location: CrewLocation) => void;
  onAddCrewInfo?: (location: CrewLocation) => void;
}

export const LocationPreviewCard: React.FC<LocationPreviewCardProps> = ({
  location,
  onClose,
  onToggleSave,
  onToggleRoute,
  onAddCrewInfo,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const markerColors = getLocationMarkerColors(theme, location);
  const maxCardHeight = Dimensions.get('window').height - tabBarHeight - insets.top - 112;
  const isGooglePlace = location.source === 'places' && !location.airportCore;
  const categoryLabel = isGooglePlace
    ? getLocationTypeLabel(location.type)
    : location.airportCode
    ? `${getLocationTypeLabel(location.type)} around ${location.airportCode}`
    : getLocationTypeLabel(location.type);
  const sourceBadge = getLocationSourceBadge(location);
  const contextHint = getLocationContextHint(location);
  const categoryHeadline = location.categoryHeadline || categoryLabel;
  const categorySummary = location.categorySummary || contextHint;
  const routeContext = location.routeContext || location.routeHint;
  const crewTags = location.crewTags || [];
  const googleMetadata = isGooglePlace
    ? [
        location.primaryTypeDisplayName,
        location.businessStatus?.replace(/_/g, ' ').toLowerCase(),
        location.priceLevel?.replace(/_/g, ' ').toLowerCase(),
        location.phoneNumber,
      ].filter((value): value is string => Boolean(value))
    : [];
  const todayHours = location.currentOpeningHoursText?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const roleTips = [location.pilotTip, location.flightAttendantTip].filter(
    (tip): tip is string => Boolean(tip)
  );
  const quickFacts = [
    {
      key: 'rating',
      label: 'Rating',
      value: `${location.rating.toFixed(1)}`,
      icon: 'star' as const,
      tone: '#FF9500',
    },
    location.distanceFromHotel
      ? {
          key: 'distance',
          label: 'Distance',
          value: location.distanceFromHotel,
          icon: 'walk-outline' as const,
          tone: theme.colors.accent,
        }
      : null,
    location.crewIntelCount
      ? {
          key: 'intel',
          label: 'Crew Intel',
          value: `${location.crewIntelCount}`,
          icon: 'sparkles-outline' as const,
          tone: theme.colors.primary,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: string;
  }>;
  const statusPills = [
    sourceBadge,
    location.isSaved ? 'Saved' : null,
    location.isRouteSaved ? 'Route ready' : null,
  ].filter(Boolean) as string[];
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
  const cardTranslateY = React.useRef(new Animated.Value(28)).current;
  const cardScale = React.useRef(new Animated.Value(0.98)).current;

  React.useEffect(() => {
    cardOpacity.setValue(0);
    cardTranslateY.setValue(28);
    cardScale.setValue(0.98);

    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardScale, cardTranslateY, location.id]);

  const openMapsUrl = async (routeUrl: string, failureTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(routeUrl);

      if (!supported) {
        Alert.alert('Maps Unavailable', 'No map app is available to open directions right now.');
        return;
      }

      await Linking.openURL(routeUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open directions right now.';
      Alert.alert(failureTitle, message);
    }
  };

  const handleOpenAppleMaps = async () => {
    const { latitude, longitude } = location.coordinate;
    const label = encodeURIComponent(location.name);
    const routeUrl =
      Platform.OS === 'ios'
        ? `maps://?daddr=${latitude},${longitude}&q=${label}`
        : `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${label}`;

    await openMapsUrl(routeUrl, 'Apple Maps Failed');
  };

  const handleOpenGoogleMaps = async () => {
    const { latitude, longitude } = location.coordinate;
    const routeUrl = location.googleMapsUri || `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    await openMapsUrl(routeUrl, 'Google Maps Failed');
  };

  const handleShare = async () => {
    const { latitude, longitude } = location.coordinate;
    const shareMessage = [
      location.name,
      location.address,
      location.distanceFromHotel ? `Distance: ${location.distanceFromHotel}` : null,
      location.phoneNumber ? `Phone: ${location.phoneNumber}` : null,
      location.websiteUri ? `Website: ${location.websiteUri}` : null,
      `Map: https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        message: shareMessage,
        title: location.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the share sheet right now.';
      Alert.alert('Share Failed', message);
    }
  };

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 14 }]}>
      <Animated.View
        style={[
          styles.card,
          {
            maxHeight: Math.max(maxCardHeight, 320),
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.iconPanel}>
          <View style={[styles.iconCircle, { backgroundColor: markerColors.fill, borderColor: markerColors.border }]}>
            <Ionicons name="location" size={24} color={theme.colors.background} />
          </View>
          <View style={[styles.badge, { backgroundColor: markerColors.fill }]}>
            <Ionicons name={location.isCrewFavorite ? 'sparkles' : 'location'} size={12} color={theme.colors.background} />
            <Text style={styles.badgeText}>{sourceBadge}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.name} numberOfLines={1}>{location.name}</Text>
              <Text style={styles.address} numberOfLines={2}>{location.address}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.statusPillRow}>
            {statusPills.map((pill) => (
              <View key={pill} style={styles.statusPill}>
                <Text style={styles.statusPillText}>{pill}</Text>
              </View>
            ))}
          </View>
          {quickFacts.length ? (
            <View style={styles.quickFactRow}>
              {quickFacts.map((fact) => (
                <View key={fact.key} style={styles.quickFactCard}>
                  <View style={styles.quickFactTopRow}>
                    <Ionicons name={fact.icon} size={13} color={fact.tone} />
                    <Text style={styles.quickFactLabel}>{fact.label}</Text>
                  </View>
                  <Text style={[styles.quickFactValue, { color: fact.tone }]}>{fact.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.detailsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.infoRow}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#FF9500" />
                <Text style={styles.ratingText}>{location.rating}</Text>
                <Text style={styles.reviewCount}>({location.reviewCount} reviews)</Text>
              </View>
              <Text style={styles.distanceText}>
                {location.distanceFromHotel
                  ? isGooglePlace
                    ? location.distanceFromHotel
                    : `${location.distanceFromHotel} from hub`
                  : sourceBadge}
              </Text>
            </View>
            <Text style={styles.headlineText}>{categoryHeadline}</Text>
            <View style={styles.categoryRow}>
              <View style={styles.utilityChip}>
                <Ionicons name="sparkles-outline" size={13} color={theme.colors.accent} />
                <Text style={styles.utilityChipText}>{categoryLabel}</Text>
              </View>
              {location.recommendedFor ? (
                <Text style={styles.categoryDetail}>Best for {location.recommendedFor}</Text>
              ) : null}
            </View>
            <Text style={styles.helperText}>{categorySummary}</Text>
            {googleMetadata.length > 0 || todayHours ? (
              <View style={styles.googleMetaCard}>
                <View style={styles.googleMetaHeader}>
                  <Ionicons name="business-outline" size={13} color={theme.colors.accent} />
                  <Text style={styles.googleMetaTitle}>Google Business Details</Text>
                </View>
                {googleMetadata.map((item) => (
                  <Text key={item} style={styles.googleMetaText}>{item}</Text>
                ))}
                {todayHours ? <Text style={styles.googleMetaText}>{todayHours}</Text> : null}
              </View>
            ) : null}
            {crewTags.length > 0 ? (
              <View style={styles.tagRow}>
                {crewTags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {location.bestWindow ? (
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.metaChipText}>{location.bestWindow}</Text>
                </View>
              ) : null}
              {routeContext ? (
                <View style={styles.metaChip}>
                  <Ionicons name="trail-sign-outline" size={12} color={theme.colors.textMuted} />
                  <Text style={styles.metaChipText}>{routeContext}</Text>
                </View>
              ) : null}
            </View>
            {location.routeHint ? <Text style={styles.helperTextMuted}>{location.routeHint}</Text> : null}
            {roleTips.length > 0 ? (
              <View style={styles.roleTipStack}>
                {roleTips.map((tip) => (
                  <View key={tip} style={styles.roleTipCard}>
                    <Ionicons name="sparkles-outline" size={13} color={theme.colors.primary} />
                    <Text style={styles.roleTipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {location.crewIntelCount ? (
              <View style={styles.communityNoteCard}>
                <View style={styles.communityNoteHeader}>
                  <Ionicons name="sparkles-outline" size={13} color={theme.colors.accent} />
                  <Text style={styles.communityNoteTitle}>
                    {location.crewIntelCount} crew {location.crewIntelCount === 1 ? 'note' : 'notes'}
                  </Text>
                </View>
                {location.crewDealLabel ? (
                  <View style={styles.dealChip}>
                    <Text style={styles.dealChipText}>{location.crewDealLabel}</Text>
                  </View>
                ) : null}
                {location.crewIntelSummary ? (
                  <Text style={styles.communityNoteText}>{location.crewIntelSummary}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <View style={styles.mapActionRow}>
              <TouchableOpacity style={styles.primaryAction} onPress={() => void handleOpenAppleMaps()}>
                <Ionicons name="navigate-outline" size={17} color={theme.colors.background} />
                <Text style={styles.primaryActionText}>Apple Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.googleAction} onPress={() => void handleOpenGoogleMaps()}>
                <Ionicons name="map-outline" size={17} color={theme.colors.accent} />
                <Text style={styles.googleActionText}>Google</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.secondaryActionRow}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => onToggleSave?.(location)}
              >
                <Ionicons
                  name={location.isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={location.isSaved ? theme.colors.primary : theme.colors.accent}
                />
                <Text style={styles.secondaryActionText}>{location.isSaved ? 'Saved' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => onToggleRoute?.(location)}>
                <Ionicons
                  name={location.isRouteSaved ? 'trail-sign' : 'trail-sign-outline'}
                  size={16}
                  color={location.isRouteSaved ? theme.colors.success : theme.colors.accent}
                />
                <Text style={styles.secondaryActionText}>{location.isRouteSaved ? 'Route On' : 'Route'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryAction} onPress={() => void handleShare()}>
                <Ionicons name="share-outline" size={16} color={theme.colors.accent} />
                <Text style={styles.secondaryActionText}>Share</Text>
              </TouchableOpacity>
            </View>
            {onAddCrewInfo ? (
              <TouchableOpacity style={styles.addInfoAction} onPress={() => onAddCrewInfo(location)}>
                <Ionicons name="create-outline" size={15} color={theme.colors.accent} />
                <Text style={styles.addInfoActionText}>
                  {location.crewIntelCount ? 'Add More Crew Info' : 'Add Crew Info'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.colors.surface + 'C0',
    borderRadius: theme.roundness.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  handleWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.textMuted + '77',
  },
  iconPanel: {
    width: 72,
    backgroundColor: theme.colors.background + 'A0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingTop: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: theme.colors.background,
    fontSize: 8,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  headerCopy: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statusPill: {
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  quickFactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickFactCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 5,
  },
  quickFactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quickFactLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickFactValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  detailsScroll: {
    flexGrow: 0,
  },
  detailsScrollContent: {
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  reviewCount: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  distanceText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  address: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  headlineText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  utilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.accent + '14',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.accent + '30',
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 6,
  },
  utilityChipText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryDetail: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  helperText: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  googleMetaCard: {
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '24',
    backgroundColor: theme.colors.accent + '0F',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    marginBottom: 8,
  },
  googleMetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  googleMetaTitle: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  googleMetaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textTransform: 'capitalize',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    backgroundColor: theme.colors.primary + '12',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.primary + '24',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metaChipText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  helperTextMuted: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  roleTipStack: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  roleTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.surface + 'B6',
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleTipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  communityNoteCard: {
    backgroundColor: theme.colors.surface + 'BB',
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '24',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  communityNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  communityNoteTitle: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  communityNoteText: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  dealChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '18',
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.primary + '28',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dealChipText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  actions: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '88',
  },
  mapActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryAction: {
    flex: 1.35,
    height: 42,
    backgroundColor: theme.colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.roundness.md,
    gap: 6,
  },
  primaryActionText: {
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: 'bold',
  },
  googleAction: {
    flex: 1,
    height: 42,
    backgroundColor: theme.colors.cardSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
    gap: 6,
  },
  googleActionText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryAction: {
    flex: 1,
    minWidth: 0,
    height: 38,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.accent + '14',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '33',
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  addInfoAction: {
    height: 36,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '28',
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addInfoActionText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
});
