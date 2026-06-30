import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import {
  getMarketplaceVertical,
  Listing,
  ListingCategory,
  MarketplaceVertical,
} from '../types/marketplace';

const getCategoryIcon = (category: ListingCategory) => {
  switch (category) {
    case ListingCategory.ITEM:
      return 'pricetag-outline';
    case ListingCategory.SERVICE:
      return 'briefcase-outline';
    case ListingCategory.CRASH_PAD:
    case ListingCategory.PRIVATE_ROOM:
    default:
      return 'home-outline';
  }
};

const getBadgeLabel = (listing: Listing) => {
  if (listing.details?.local?.pickupMode === 'AIRPORT_HANDOFF') {
    return 'Airport handoff';
  }

  if (listing.details?.local?.isLocalPickup !== false) {
    return 'Nearby';
  }

  return listing.airportCode;
};

type ListingGridCardProps = {
  listing: Listing;
  onPress?: () => void;
};

export const ListingGridCard: React.FC<ListingGridCardProps> = ({ listing, onPress }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isHousing = getMarketplaceVertical(listing.category) === MarketplaceVertical.REAL_ESTATE;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        {listing.imageUrl ? (
          <Image source={{ uri: listing.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name={getCategoryIcon(listing.category)} size={30} color={theme.colors.border} />
          </View>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>{getBadgeLabel(listing)}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.price} numberOfLines={1}>
          ${listing.priceMonthly.toLocaleString()}
          {isHousing ? '/mo' : ''}
        </Text>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {listing.airportCode} · {listing.details?.local?.mapAreaLabel || listing.distanceToAirport}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      marginHorizontal: 4,
      marginBottom: 14,
      overflow: 'hidden',
    },
    imageWrap: {
      aspectRatio: 0.92,
      borderRadius: 4,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imageFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.input,
    },
    badge: {
      position: 'absolute',
      top: 10,
      left: 10,
      maxWidth: '82%',
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      color: '#111111',
      fontSize: 12,
      fontWeight: '900',
    },
    copy: {
      paddingTop: 7,
      gap: 2,
    },
    price: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    title: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
  });
