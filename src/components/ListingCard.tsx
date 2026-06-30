import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import {
  getListingCategoryLabel,
  getMarketplaceVertical,
  Listing,
  ListingCategory,
  MarketplaceVertical,
} from '../types/marketplace';
import { MarketplaceService } from '../services/MarketplaceService';

const getCategoryIcon = (category: ListingCategory) => {
  switch (category) {
    case ListingCategory.CRASH_PAD:
    case ListingCategory.PRIVATE_ROOM:
      return 'home-outline';
    case ListingCategory.ITEM:
      return 'pricetag-outline';
    case ListingCategory.SERVICE:
      return 'briefcase-outline';
    default:
      return 'home-outline';
  }
};

const getCategoryAccent = (category: ListingCategory, theme: AppTheme) => {
  switch (getMarketplaceVertical(category)) {
    case MarketplaceVertical.REAL_ESTATE:
      return theme.colors.accent;
    case MarketplaceVertical.PRODUCTS:
      return '#FFB800';
    case MarketplaceVertical.SERVICES:
      return '#7CFF7A';
    default:
      return theme.colors.accent;
  }
};

const getDaysUntil = (isoDate?: string) => {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
};

const formatShortDate = (isoDate?: string) => {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  onRenew?: () => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onPress,
  canManage = false,
  onEdit,
  onDelete,
  onToggleStatus,
  onRenew,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isHousing = getMarketplaceVertical(listing.category) === MarketplaceVertical.REAL_ESTATE;
  const accentColor = getCategoryAccent(listing.category, theme);
  const isPaused = MarketplaceService.isListingPaused(listing);
  const canRenew = MarketplaceService.isListingRenewEligible(listing);
  const renewEligibleAt = MarketplaceService.getListingRenewEligibleAt(listing);
  const renewDays = getDaysUntil(renewEligibleAt);
  const expiresAt = formatShortDate(listing.details?.marketplace?.expiresAt);
  const localLabel = listing.details?.local?.mapAreaLabel || 'Approximate pickup area';
  const renewalText = isPaused
    ? 'Resume before renewing'
    : canRenew
      ? 'Renew now'
      : renewDays === null
        ? 'Renew timing unavailable'
        : renewDays === 0
          ? 'Renew later today'
          : `Renew in ${renewDays} day${renewDays === 1 ? '' : 's'}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.imageWrap}>
        {listing.imageUrl ? (
          <Image source={{ uri: listing.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name={getCategoryIcon(listing.category)} size={40} color={theme.colors.border} />
        )}

        {listing.isCrewVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={12} color={theme.colors.background} />
            <Text style={styles.verifiedText}>CREW VERIFIED</Text>
          </View>
        ) : null}

        {isPaused ? (
          <View style={styles.pausedBadge}>
            <Ionicons name="pause-circle-outline" size={12} color={theme.colors.background} />
            <Text style={styles.pausedText}>PAUSED</Text>
          </View>
        ) : null}

        <View style={styles.priceTag}>
          <Text style={styles.priceText}>${listing.priceMonthly}</Text>
          {isHousing ? <Text style={styles.priceSub}>/mo</Text> : null}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {listing.title}
          </Text>
          <Text style={[styles.categoryLabel, { color: accentColor }]}>
            {getListingCategoryLabel(listing.category).toUpperCase()}
          </Text>
        </View>

        {!!listing.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {listing.description}
          </Text>
        ) : null}

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="airplane-outline" size={14} color={theme.colors.accent} />
            <Text style={styles.infoText}>
              {listing.airportCode} • {listing.distanceToAirport}
            </Text>
          </View>
          {listing.details?.local?.isLocalPickup !== false ? (
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.infoText}>{localLabel || 'Local pickup'}</Text>
            </View>
          ) : null}
          {isHousing ? (
            <View style={styles.infoItem}>
              <Ionicons name="bed-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.infoText}>{listing.bedsAvailable} Beds</Text>
            </View>
          ) : null}
        </View>

        {listing.amenities.length ? (
          <View style={styles.amenitiesRow}>
            {listing.amenities.slice(0, 3).map((amenity) => (
              <View key={amenity} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          {isHousing ? (
            <View style={styles.genderBadge}>
              <Text style={styles.genderText}>{listing.genderPreference}</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.hostText}>Host: {listing.hostName}</Text>
        </View>

        {canManage ? (
          <View style={styles.healthPanel}>
            <View style={styles.healthItem}>
              <Ionicons
                name={isPaused ? 'pause-circle-outline' : 'checkmark-circle-outline'}
                size={15}
                color={isPaused ? '#FF9500' : theme.colors.success}
              />
              <Text style={styles.healthText}>{isPaused ? 'Paused' : 'Active'}</Text>
            </View>
            <View style={styles.healthItem}>
              <Ionicons
                name="refresh-circle-outline"
                size={15}
                color={canRenew ? theme.colors.success : theme.colors.textMuted}
              />
              <Text style={[styles.healthText, canRenew && styles.healthTextReady]}>{renewalText}</Text>
            </View>
            {expiresAt ? (
              <View style={styles.healthItem}>
                <Ionicons name="calendar-outline" size={15} color={theme.colors.textMuted} />
                <Text style={styles.healthText}>Expires {expiresAt}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {canManage ? (
          <View style={styles.manageRow}>
            <TouchableOpacity style={styles.manageButton} onPress={onEdit}>
              <Ionicons name="create-outline" size={15} color={theme.colors.text} />
              <Text style={styles.manageButtonText}>Edit</Text>
            </TouchableOpacity>
            {onToggleStatus ? (
              <TouchableOpacity style={styles.manageButton} onPress={onToggleStatus}>
                <Ionicons
                  name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                  size={15}
                  color={isPaused ? theme.colors.success : theme.colors.text}
                />
                <Text style={styles.manageButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
            ) : null}
            {onRenew && canRenew ? (
              <TouchableOpacity style={styles.manageButton} onPress={onRenew}>
                <Ionicons name="refresh-circle-outline" size={15} color={theme.colors.success} />
                <Text style={styles.manageButtonText}>Renew</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.manageButton, styles.manageDeleteButton]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
              <Text style={[styles.manageButtonText, styles.manageDeleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    imageWrap: {
      height: 138,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    verifiedBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
    },
    verifiedText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    pausedBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: theme.colors.background + 'D9',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
      borderWidth: 1,
      borderColor: '#FF950044',
    },
    pausedText: {
      color: '#FF9500',
      fontSize: 10,
      fontWeight: '900',
    },
    priceTag: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      backgroundColor: theme.colors.background + 'D9',
      borderWidth: 1,
      borderColor: theme.colors.primary + '55',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    priceText: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    priceSub: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginLeft: 2,
    },
    content: {
      padding: 18,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    title: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    categoryLabel: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    description: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 10,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    infoText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    amenitiesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    amenityChip: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    amenityText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    genderBadge: {
      backgroundColor: theme.colors.primary + '14',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    genderText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    hostText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
    },
    healthPanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    healthItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    healthText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    healthTextReady: {
      color: theme.colors.success,
    },
    manageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      minHeight: 38,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    manageDeleteButton: {
      borderColor: theme.colors.error + '44',
      backgroundColor: theme.colors.error + '10',
    },
    manageButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    manageDeleteText: {
      color: theme.colors.error,
    },
  });
