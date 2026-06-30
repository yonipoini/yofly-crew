import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import {
  getListingCategoryLabel,
  getMarketplaceVertical,
  Listing,
  ListingCategory,
  MarketplaceVertical,
} from '../types/marketplace';
import { AirportSearchService } from '../services/AirportSearchService';

type MarketplaceMapPreviewProps = {
  airportCode: string;
  listings: Listing[];
  mapHeight?: number;
  selectedListingId?: string | null;
  onSelectListing: (listing: Listing) => void;
};

type MarkerPoint = {
  listing: Listing;
  left: number;
  top: number;
};

const getCategoryIcon = (category: ListingCategory) => {
  switch (category) {
    case ListingCategory.CRASH_PAD:
    case ListingCategory.PRIVATE_ROOM:
    case ListingCategory.LONG_TERM_STAY:
    case ListingCategory.SHORT_TERM_STAY:
      return 'home-outline';
    case ListingCategory.ITEM:
      return 'pricetag-outline';
    case ListingCategory.SERVICE:
    default:
      return 'briefcase-outline';
  }
};

const getCategoryColor = (category: ListingCategory, theme: AppTheme) => {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getFallbackMarkerPosition = (listing: Listing, index: number) => {
  const seed = listing.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0) + index * 31;
  const angle = (seed % 360) * (Math.PI / 180);
  const radius = 14 + (seed % 22);

  return {
    left: clamp(50 + Math.cos(angle) * radius, 12, 88),
    top: clamp(52 + Math.sin(angle) * radius * 0.72, 18, 84),
  };
};

export const MarketplaceMapPreview: React.FC<MarketplaceMapPreviewProps> = ({
  airportCode,
  listings,
  mapHeight = 190,
  selectedListingId,
  onSelectListing,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const airport = airportCode === 'ANY' ? null : AirportSearchService.getAirportByCode(airportCode);
  const localListings = listings.filter((listing) => listing.details?.local?.isLocalPickup !== false).slice(0, 18);
  const markerPoints = useMemo<MarkerPoint[]>(() => {
    const coordinateListings = localListings.filter(
      (listing) =>
        typeof listing.details?.local?.latitude === 'number' &&
        typeof listing.details?.local?.longitude === 'number' &&
        airport
    );

    const latitudes = coordinateListings.map((listing) => listing.details?.local?.latitude as number);
    const longitudes = coordinateListings.map((listing) => listing.details?.local?.longitude as number);
    const minLatitude = Math.min(airport?.latitude ?? 0, ...latitudes);
    const maxLatitude = Math.max(airport?.latitude ?? 0, ...latitudes);
    const minLongitude = Math.min(airport?.longitude ?? 0, ...longitudes);
    const maxLongitude = Math.max(airport?.longitude ?? 0, ...longitudes);
    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.08);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.08);

    return localListings.map((listing, index) => {
      const latitude = listing.details?.local?.latitude;
      const longitude = listing.details?.local?.longitude;

      if (typeof latitude === 'number' && typeof longitude === 'number' && airport) {
        return {
          listing,
          left: clamp(10 + ((longitude - minLongitude) / longitudeSpan) * 80, 10, 90),
          top: clamp(86 - ((latitude - minLatitude) / latitudeSpan) * 72, 16, 86),
        };
      }

      return {
        listing,
        ...getFallbackMarkerPosition(listing, index),
      };
    });
  }, [airport, localListings]);

  const selectedListing =
    listings.find((listing) => listing.id === selectedListingId) || localListings[0] || null;

  return (
    <View style={styles.container}>
      <View style={[styles.map, { height: mapHeight }]}>
        <View style={styles.grid} pointerEvents="none" />
        <View style={styles.airportBadge}>
          <Text style={styles.airportCode}>{airportCode === 'ANY' ? 'LOCAL' : airportCode}</Text>
          <Text style={styles.airportName} numberOfLines={1}>
            {airport?.name || 'Marketplace pickup map'}
          </Text>
        </View>

        {airport ? (
          <View style={styles.airportPin}>
            <Ionicons name="airplane" size={16} color={theme.colors.background} />
          </View>
        ) : null}

        {markerPoints.map(({ listing, left, top }) => {
          const active = listing.id === selectedListing?.id;
          const markerColor = getCategoryColor(listing.category, theme);

          return (
            <TouchableOpacity
              key={listing.id}
              style={[
                styles.marker,
                { left: `${left}%`, top: `${top}%`, backgroundColor: markerColor },
                active && styles.markerActive,
              ]}
              onPress={() => onSelectListing(listing)}
              activeOpacity={0.86}
            >
              <Ionicons name={getCategoryIcon(listing.category)} size={15} color={theme.colors.background} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.previewBar}>
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {selectedListing?.title || 'No local listings yet'}
          </Text>
          <Text style={styles.previewMeta} numberOfLines={1}>
            {selectedListing
              ? `${getListingCategoryLabel(selectedListing.category)} · ${
                  selectedListing.details?.local?.mapAreaLabel || selectedListing.distanceToAirport
                }`
              : 'Local pickup posts will appear here.'}
          </Text>
        </View>
        {selectedListing ? (
          <TouchableOpacity style={styles.previewAction} onPress={() => onSelectListing(selectedListing)}>
            <Text style={styles.previewActionText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.background} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    map: {
      backgroundColor: theme.colors.input,
      position: 'relative',
      overflow: 'hidden',
    },
    grid: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background === '#000000' ? 'rgba(7, 18, 23, 0.96)' : '#E8F2F6',
    },
    airportBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      maxWidth: 210,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    airportCode: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    airportName: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    airportPin: {
      position: 'absolute',
      left: '50%',
      top: '52%',
      width: 32,
      height: 32,
      marginLeft: -16,
      marginTop: -16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    marker: {
      position: 'absolute',
      width: 32,
      height: 32,
      marginLeft: -16,
      marginTop: -16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.surface,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    markerActive: {
      width: 42,
      height: 42,
      marginLeft: -21,
      marginTop: -21,
      borderRadius: 21,
      borderWidth: 3,
    },
    previewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    previewCopy: {
      flex: 1,
    },
    previewTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    previewMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    previewAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    previewActionText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
  });
