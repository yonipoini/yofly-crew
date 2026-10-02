import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useProfile } from '../../src/context/ProfileContext';
import { useAuth } from '../../src/context/AuthContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { getListingCategoryLabel, getMarketplaceVertical, Listing, MarketplaceVertical } from '../../src/types/marketplace';
import { MarketplaceService } from '../../src/services/MarketplaceService';
import { MarketplaceModerationService, ListingReportReason, MARKETPLACE_REPORT_REASONS } from '../../src/services/MarketplaceModerationService';
import { ModerationService } from '../../src/services/ModerationService';
import { supabase } from '../../src/lib/supabase';
import { confirmAction } from '../../src/utils/confirmAction';

const PICKUP_MODE_LABELS = {
  EXACT_AFTER_CONTACT: 'Exact spot after contact',
  PUBLIC_MEETUP: 'Public meetup',
  AIRPORT_HANDOFF: 'Airport handoff',
  DELIVERY_LOCAL: 'Local delivery',
};

const formatJoinedDate = (joinedAt?: string) => {
  if (!joinedAt) {
    return 'Joined date unavailable';
  }

  const date = new Date(joinedAt);

  if (Number.isNaN(date.getTime())) {
    return 'Joined date unavailable';
  }

  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { profile } = useProfile();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoadingListing, setIsLoadingListing] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [remoteCrewAccess, setRemoteCrewAccess] = useState<boolean | null>(null);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(Boolean(user?.id));
  const [activeUserId, setActiveUserId] = useState<string | null>(user?.id || null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState<ListingReportReason>('INACCURATE');
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (!id) {
      setIsLoadingListing(false);
      return;
    }

    let active = true;

    const loadListing = async () => {
      setIsLoadingListing(true);
      const data = await MarketplaceService.getListingById(id);

      if (active) {
        setListing(data);
        setActiveImageIndex(0);
        setIsLoadingListing(false);
      }
    };

    void loadListing();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;

    const refreshCrewAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      const sessionUserId = session?.user?.id || user?.id || null;
      setHasSupabaseSession(Boolean(sessionUserId));
      setActiveUserId(sessionUserId);

      if (!sessionUserId) {
        setRemoteCrewAccess(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('verified_crew, verified_marketplace')
        .eq('id', sessionUserId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        console.warn('Failed to refresh listing detail crew access:', error);
        setRemoteCrewAccess(null);
        return;
      }

      setRemoteCrewAccess(Boolean(data?.verified_crew || data?.verified_marketplace));
    };

    void refreshCrewAccess();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const hasVerifiedCrewAccess = Boolean(
    (hasSupabaseSession || profile.verifiedCrew || profile.verifiedMarketplace) &&
    (profile.verifiedCrew || profile.verifiedMarketplace || remoteCrewAccess)
  );
  const isHousing = listing ? getMarketplaceVertical(listing.category) === MarketplaceVertical.REAL_ESTATE : false;
  const isProduct = listing ? getMarketplaceVertical(listing.category) === MarketplaceVertical.PRODUCTS : false;
  const isPaused = listing ? MarketplaceService.isListingPaused(listing) : false;
  const canRenewListing = listing ? MarketplaceService.isListingRenewEligible(listing) : false;
  const galleryImages = listing?.imageUrls ?? [];
  const activeImage = galleryImages[activeImageIndex] || listing?.imageUrl;
  const categoryLabel = listing?.category ? getListingCategoryLabel(listing.category) : 'Listing';
  const overviewTitle = isHousing ? 'Stay Overview' : isProduct ? 'Product Details' : 'Service Details';
  const logisticsLabel = isHousing ? 'Distance' : isProduct ? 'Meetup / handoff' : 'Service area';
  const hostLabel = isHousing ? 'Host' : isProduct ? 'Seller' : 'Provider';
  const contactLabel = isHousing ? 'Message Host' : isProduct ? 'Message Seller' : 'Message Provider';
  const pricingLabel = isHousing ? 'Monthly rate' : 'Listed price';
  const canEditListing = Boolean(activeUserId && listing?.hostId && activeUserId === listing.hostId);
  const canContactHost = Boolean(listing && hasVerifiedCrewAccess && !canEditListing);
  const localDetails = listing?.details?.local;
  const sellerBaseAirport = listing?.hostBaseAirport || listing?.airportCode || 'Crew base';
  const sellerListingCountLabel =
    typeof listing?.hostListingCount === 'number'
      ? `${listing.hostListingCount} ${listing.hostListingCount === 1 ? 'listing' : 'listings'}`
      : 'Listing count unavailable';

  const handleDeleteListing = () => {
    if (!listing) {
      return;
    }

    confirmAction({
      title: 'Delete Listing',
      message: `Remove "${listing.title}" from the crew marketplace?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.deleteListing(listing.id);
            AppSyncService.emit('marketplace');
            router.replace('/marketplace');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete this listing right now.';
            Alert.alert('Delete Failed', message);
          }
        })();
      },
    });
  };

  const handleToggleListingStatus = () => {
    if (!listing) {
      return;
    }

    const nextStatus = isPaused ? 'ACTIVE' : 'PAUSED';
    const actionText = isPaused ? 'Resume' : 'Pause';

    confirmAction({
      title: `${actionText} Listing`,
      message: `${isPaused ? 'Bring' : 'Temporarily remove'} "${listing.title}" ${isPaused ? 'back into' : 'from'} the crew marketplace?`,
      confirmText: actionText,
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.setListingLifecycleStatus(listing.id, nextStatus);
            setListing((current) =>
              current
                ? {
                    ...current,
                    details: ({
                      ...(current.details || {}),
                      marketplace: {
                        ...((current.details as { marketplace?: { status?: string } } | undefined)?.marketplace || {}),
                        status: nextStatus,
                        updatedAt: new Date().toISOString(),
                      },
                    } as Listing['details']),
                  }
                : current
            );
            AppSyncService.emit('marketplace');
          } catch (error) {
            const message =
              error instanceof Error ? error.message : `Unable to ${actionText.toLowerCase()} this listing right now.`;
            Alert.alert('Listing Update Failed', message);
          }
        })();
      },
    });
  };

  const handleRenewListing = () => {
    if (!listing) {
      return;
    }

    confirmAction({
      title: 'Renew Listing',
      message: `Move "${listing.title}" back up in Marketplace browse results? Renew will be available again in ${MarketplaceService.renewWaitDays} days.`,
      confirmText: 'Renew',
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.renewListing(listing.id);
            const now = new Date();
            setListing((current) =>
              current
                ? {
                    ...current,
                    details: ({
                      ...(current.details || {}),
                      marketplace: {
                        ...((current.details || {}).marketplace || {}),
                        lastRenewedAt: now.toISOString(),
                        renewEligibleAt: new Date(now.getTime() + MarketplaceService.renewWaitDays * 24 * 60 * 60 * 1000).toISOString(),
                        expiresAt: new Date(now.getTime() + MarketplaceService.listingExpiresAfterDays * 24 * 60 * 60 * 1000).toISOString(),
                        updatedAt: now.toISOString(),
                      },
                    } as Listing['details']),
                  }
                : current
            );
            AppSyncService.emit('marketplace');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to renew this listing right now.';
            Alert.alert('Renew Failed', message);
          }
        })();
      },
    });
  };

  const handleContactHost = () => {
    if (!listing) {
      return;
    }

    if (!hasSupabaseSession) {
      Alert.alert('Sign In Required', 'Sign in with your verified crew account before messaging a seller.');
      return;
    }

    if (!hasVerifiedCrewAccess) {
      Alert.alert('Crew Verification Required', 'Messaging is available after employee-email crew verification is approved.');
      return;
    }

    if (canEditListing) {
      Alert.alert('Your Listing', 'This listing is yours, so there is no seller chat to open.');
      return;
    }

    const buyerId = activeUserId || 'crew';
    const hostId = listing.hostId || 'host';

    router.push({
      pathname: '/chat/[roomId]',
      params: {
        roomId: `listing:${listing.id}:buyer:${buyerId}:host:${hostId}`,
        name: `${listing.title} · ${listing.hostName || hostLabel}`,
        city: listing.airportCode || '',
        memberCount: '2',
      },
    });
  };

  const handleHideListing = () => {
    if (!listing) {
      return;
    }

    confirmAction({
      title: 'Hide Listing',
      message: `Hide "${listing.title}" from your Marketplace browse view?`,
      confirmText: 'Hide',
      onConfirm: () => {
        void (async () => {
          await MarketplaceModerationService.hideListing(listing.id, activeUserId);
          AppSyncService.emit('marketplace');
          router.replace('/marketplace');
        })();
      },
    });
  };

  const handleOpenReport = () => {
    if (!hasSupabaseSession) {
      Alert.alert('Sign In Required', 'Sign in before reporting a listing.');
      return;
    }

    setIsReportModalVisible(true);
  };

  const handleBlockHost = () => {
    if (!listing) return;
    const hostDisplayName = listing.hostName || 'this host';
    Alert.alert(
      'Block Host',
      `Are you sure you want to block ${hostDisplayName}? All of their listings will be removed from your view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              if (listing.hostId) {
                await ModerationService.blockUser(listing.hostId);
              }
              await MarketplaceModerationService.hideListing(listing.id, activeUserId);
              AppSyncService.emit('marketplace');
              Alert.alert('Host Blocked', 'This host has been blocked and their listings removed.', [
                { text: 'OK', onPress: () => router.replace('/marketplace') },
              ]);
            } catch {
              Alert.alert('Error', 'Failed to block host.');
            }
          },
        },
      ]
    );
  };

  const handleSubmitReport = () => {
    if (!listing || isSubmittingReport) {
      return;
    }

    void (async () => {
      try {
        setIsSubmittingReport(true);
        await MarketplaceModerationService.reportListing(listing.id, reportReason, reportNotes);
        await MarketplaceModerationService.hideListing(listing.id, activeUserId);
        setIsReportModalVisible(false);
        setReportNotes('');
        AppSyncService.emit('marketplace');
        Alert.alert(
          'Report Submitted & Listing Removed',
          'Thank you. This listing has been removed from your feed.\n\nYoFly Crew moderation acts on all reports within 24 hours. Offending listings are removed and abusive hosts permanently ejected.\n\nDirect developer contact: admin@yoflycrew.com',
          [{ text: 'OK', onPress: () => router.replace('/marketplace') }]
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to report this listing right now.';
        Alert.alert('Report Failed', message);
      } finally {
        setIsSubmittingReport(false);
      }
    })();
  };

  const handleBackToMarketplace = () => {
    router.replace('/marketplace');
  };

  const highlights = listing
    ? isHousing
      ? [
          { icon: 'bed-outline' as const, label: 'Beds', value: `${listing.bedsAvailable}` },
          { icon: 'people-outline' as const, label: 'Setup', value: listing.genderPreference },
          { icon: 'airplane-outline' as const, label: 'Airport', value: listing.airportCode },
        ]
      : isProduct
        ? [
            { icon: 'pricetag-outline' as const, label: 'Type', value: categoryLabel },
            { icon: 'airplane-outline' as const, label: 'Meetup', value: listing.airportCode },
            { icon: 'cube-outline' as const, label: 'Condition', value: listing.amenities[0] || 'Crew owned' },
          ]
        : [
            { icon: 'briefcase-outline' as const, label: 'Service', value: categoryLabel },
            { icon: 'airplane-outline' as const, label: 'Area', value: listing.airportCode },
            { icon: 'time-outline' as const, label: 'Access', value: listing.amenities[0] || 'By request' },
          ]
    : [];
  const detailRows = listing
    ? isHousing
      ? [
          { label: 'Bathrooms', value: listing.details?.housing?.bathrooms },
          { label: 'Lease type', value: listing.details?.housing?.leaseType },
          { label: 'Parking', value: listing.details?.housing?.parking },
          { label: 'Pet policy', value: listing.details?.housing?.petPolicy },
        ]
      : isProduct
        ? [
            { label: 'Condition', value: listing.details?.product?.condition },
            { label: 'Brand', value: listing.details?.product?.brand },
            { label: 'Fulfillment', value: listing.details?.product?.fulfillment },
          ]
        : [
            { label: 'Availability', value: listing.details?.service?.availabilityWindows },
            { label: 'Delivery radius', value: listing.details?.service?.deliveryRadius },
            { label: 'Booking method', value: listing.details?.service?.bookingMethod },
          ]
    : [];

  if (!isLoadingListing && !listing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToMarketplace} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Listing Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="home-outline" size={56} color={theme.colors.border} />
          <Text style={styles.emptyTitle}>Listing not found</Text>
          <Text style={styles.emptyText}>
            This listing may have been removed or the link is no longer valid.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackToMarketplace} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoadingListing ? (
          <View style={styles.loadingCard}>
            <Ionicons name="hourglass-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.loadingText}>Loading crew listing...</Text>
          </View>
        ) : null}

        {activeImage ? (
          <Image source={{ uri: activeImage }} style={styles.imageHeader} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <View style={styles.imagePlaceholderIcon}>
              <Ionicons name="image-outline" size={34} color={theme.colors.accent} />
            </View>
            <Text style={styles.imagePlaceholderTitle}>Photos coming soon</Text>
            <Text style={styles.imageText}>
              Ask the {hostLabel.toLowerCase()} for current photos in private chat before arranging a handoff.
            </Text>
            <View style={styles.imagePlaceholderMeta}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.imagePlaceholderMetaText}>
                {listing?.airportCode ? `${listing.airportCode} crew-only listing` : 'Verified crew-only listing'}
              </Text>
            </View>
          </View>
        )}

        {galleryImages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryStrip}
          >
            {galleryImages.map((imageUrl, index) => {
              const isActive = index === activeImageIndex;
              return (
                <TouchableOpacity
                  key={`${imageUrl}-${index}`}
                  style={[styles.galleryThumbWrap, isActive && styles.galleryThumbWrapActive]}
                  onPress={() => setActiveImageIndex(index)}
                >
                  <Image source={{ uri: imageUrl }} style={styles.galleryThumb} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <Text style={styles.title}>{listing?.title || 'Marketplace Listing'}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.priceValue}>
            ${listing?.priceMonthly ?? '--'}
            {isHousing ? '/mo' : ''}
          </Text>
          {isPaused ? (
            <View style={styles.pausedPill}>
              <Ionicons name="pause-circle-outline" size={14} color="#FF9500" />
              <Text style={styles.pausedText}>Paused</Text>
            </View>
          ) : null}
          {listing?.isCrewVerified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="shield-checkmark" size={14} color={theme.colors.background} />
              <Text style={styles.verifiedText}>Verified Host</Text>
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusItem}>
            <Ionicons
              name={isPaused ? 'pause-circle-outline' : 'checkmark-circle-outline'}
              size={18}
              color={isPaused ? '#FF9500' : theme.colors.success}
            />
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>Listing status</Text>
              <Text style={styles.statusValue}>{isPaused ? 'Paused by seller' : 'Active in Marketplace'}</Text>
            </View>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.accent} />
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>Audience</Text>
              <Text style={styles.statusValue}>Verified crew only</Text>
            </View>
          </View>
        </View>

        {!canEditListing ? (
          <View style={styles.contactPanel}>
            <View style={styles.contactPanelAvatar}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.background} />
            </View>
            <View style={styles.contactPanelCopy}>
              <Text style={styles.contactPanelEyebrow}>Private crew contact</Text>
              <Text style={styles.contactPanelName}>{contactLabel}</Text>
              <Text style={styles.contactPanelHint}>
                Chat with {listing?.hostName || `the ${hostLabel.toLowerCase()}`} for timing, pickup details, photos, and questions.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.contactPanelButton, !canContactHost && styles.contactPanelButtonDisabled]}
              onPress={handleContactHost}
              disabled={!canContactHost}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.background} />
              <Text style={styles.contactPanelButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canEditListing ? (
          <View style={styles.manageListingRow}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push({ pathname: '/create-listing', params: { id } })}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.text} />
              <Text style={styles.editButtonText}>Edit Listing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteListing}>
              <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleButton} onPress={handleToggleListingStatus}>
              <Ionicons
                name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                size={16}
                color={isPaused ? theme.colors.success : theme.colors.text}
              />
              <Text style={styles.toggleButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            {canRenewListing ? (
              <TouchableOpacity style={styles.toggleButton} onPress={handleRenewListing}>
                <Ionicons name="refresh-circle-outline" size={16} color={theme.colors.success} />
                <Text style={styles.toggleButtonText}>Renew</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.quickFacts}>
          {listing?.category ? (
            <View style={styles.factChip}>
              <Ionicons name="layers-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.factChipText}>{categoryLabel}</Text>
            </View>
          ) : null}
          {isHousing ? (
            <View style={styles.factChip}>
              <Ionicons name="bed-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.factChipText}>{listing?.bedsAvailable ?? 0} beds</Text>
            </View>
          ) : null}
          {isHousing ? (
            <View style={styles.factChip}>
              <Ionicons name="people-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.factChipText}>{listing?.genderPreference || 'Mixed'}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.pricingEyebrow}>{pricingLabel}</Text>
          <Text style={styles.pricingValueLarge}>
            ${listing?.priceMonthly ?? '--'}
            {isHousing ? '/month' : ''}
          </Text>
          <Text style={styles.pricingHint}>
            {isHousing
              ? 'Built for crew commuting and layover housing decisions.'
              : isProduct
                ? 'Crew-to-crew resale price before meetup details.'
                : 'Crew service price before timing and schedule details.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{overviewTitle}</Text>
        <Text style={styles.bodyText}>
          {listing?.description || 'This crew listing does not have a full description yet.'}
        </Text>

        {highlights.length > 0 ? (
          <View style={styles.highlightsRow}>
            {highlights.map((highlight) => (
              <View key={highlight.label} style={styles.highlightCard}>
                <Ionicons name={highlight.icon} size={16} color={theme.colors.accent} />
                <Text style={styles.highlightLabel}>{highlight.label}</Text>
                <Text style={styles.highlightValue}>{highlight.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location-outline" size={20} color={theme.colors.accent} />
            <View style={styles.locationCopy}>
              <Text style={styles.sectionInlineTitle}>Pickup area</Text>
              <Text style={styles.locationHint}>Exact details stay private until contact.</Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoLabel}>Airport</Text>
              <Text style={styles.infoValue}>{listing?.airportCode || '--'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoLabel}>{logisticsLabel}</Text>
              <Text style={styles.infoValue}>{listing?.distanceToAirport || '--'}</Text>
            </View>
          </View>
          {localDetails?.isLocalPickup !== false ? (
            <>
              <Text style={styles.infoLabel}>Map area</Text>
              <Text style={styles.infoValue}>
                {localDetails?.mapAreaLabel || 'Approximate pickup area'}
              </Text>
              <Text style={styles.infoLabel}>Pickup style</Text>
              <Text style={styles.infoValue}>
                {localDetails?.pickupMode ? PICKUP_MODE_LABELS[localDetails.pickupMode] : 'Coordinate with host'}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.sellerCard}>
          <View style={styles.sellerHeaderRow}>
            <View style={styles.sellerAvatar}>
              <Ionicons name="person-outline" size={24} color={theme.colors.background} />
            </View>
            <View style={styles.sellerCopy}>
              <Text style={styles.infoLabel}>{hostLabel}</Text>
              <Text style={styles.sellerName}>{listing?.hostName || 'Verified Crew'}</Text>
              <Text style={styles.sellerHint}>
                Verified crew profile with private Marketplace contact.
              </Text>
            </View>
            {listing?.isCrewVerified ? (
              <View style={styles.sellerVerifiedPill}>
                <Ionicons name="shield-checkmark" size={13} color={theme.colors.background} />
                <Text style={styles.sellerVerifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.sellerTrustGrid}>
            <View style={styles.sellerTrustItem}>
              <Ionicons name="airplane-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.sellerTrustText}>{sellerBaseAirport} base</Text>
            </View>
            <View style={styles.sellerTrustItem}>
              <Ionicons name="calendar-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.sellerTrustText}>{formatJoinedDate(listing?.hostJoinedAt)}</Text>
            </View>
            <View style={styles.sellerTrustItem}>
              <Ionicons name="albums-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.sellerTrustText}>{sellerListingCountLabel}</Text>
            </View>
          </View>
        </View>

        {detailRows.some((row) => row.value) ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionInlineTitle}>
              {isHousing ? 'Housing Details' : isProduct ? 'Product Details' : 'Service Details'}
            </Text>
            {detailRows
              .filter((row) => row.value)
              .map((row) => (
                <React.Fragment key={row.label}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </React.Fragment>
              ))}
          </View>
        ) : null}

        {!!listing?.amenities.length && (
          <>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesWrap}>
              {listing.amenities.map((amenity) => (
                <View key={amenity} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {!canEditListing ? (
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <View style={styles.safetyIcon}>
                <Ionicons name="shield-outline" size={18} color={theme.colors.accent} />
              </View>
              <View style={styles.safetyCopy}>
                <Text style={styles.safetyTitle}>Listing & Host Safety</Text>
                <Text style={styles.safetyHint}>Zero tolerance for objectionable content. Reports investigated within 24 hours.</Text>
              </View>
            </View>
            <View style={styles.moderationRow}>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={handleHideListing}>
                <Ionicons name="eye-off-outline" size={16} color={theme.colors.text} />
                <Text style={styles.secondaryActionText}>Hide</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={handleOpenReport}
              >
                <Ionicons name="flag-outline" size={16} color={theme.colors.error} />
                <Text style={[styles.secondaryActionText, styles.reportActionText]}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={handleBlockHost}
              >
                <Ionicons name="ban-outline" size={16} color={theme.colors.error} />
                <Text style={[styles.secondaryActionText, styles.reportActionText]}>Block Host</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                marginTop: 6,
                borderRadius: theme.roundness.full,
                borderWidth: 1,
                borderColor: theme.colors.accent + '33',
                backgroundColor: theme.colors.accent + '0a',
              }}
              onPress={() => {
                Linking.openURL(
                  `mailto:admin@yoflycrew.com?subject=Report%20Listing&body=Listing%20ID:%20${listing?.id}%0AHost:%20${listing?.hostName}%0APlease%20describe%20the%20issue:`
                );
              }}
            >
              <Ionicons name="mail-outline" size={14} color={theme.colors.accent} />
              <Text style={{ fontSize: 12, color: theme.colors.accent, fontWeight: '700' }}>
                Contact Developer Safety Team (admin@yoflycrew.com)
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!canContactHost && !canEditListing && (
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.lockText}>
              Host contact is locked until your crew verification is approved.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={isReportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report listing</Text>
              <TouchableOpacity onPress={() => setIsReportModalVisible(false)} style={styles.reportCloseButton}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportHint}>Choose the closest reason so the listing can be reviewed.</Text>

            <View style={styles.reportReasonList}>
              {MARKETPLACE_REPORT_REASONS.map((reason) => {
                const selected = reportReason === reason.id;

                return (
                  <TouchableOpacity
                    key={reason.id}
                    style={[styles.reportReasonButton, selected && styles.reportReasonButtonActive]}
                    onPress={() => setReportReason(reason.id)}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? theme.colors.background : theme.colors.textMuted}
                    />
                    <Text style={[styles.reportReasonText, selected && styles.reportReasonTextActive]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={reportNotes}
              onChangeText={setReportNotes}
              placeholder="Optional note for moderation"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={styles.reportInput}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.reportSubmitButton, isSubmittingReport && styles.contactBtnDisabled]}
              disabled={isSubmittingReport}
              onPress={handleSubmitReport}
            >
              <Text style={styles.reportSubmitText}>{isSubmittingReport ? 'Sending...' : 'Send Report'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' },
    headerSpacer: { width: 24 },
    content: { padding: theme.spacing.md, paddingBottom: 40 },
    imageHeader: {
      height: 250,
      width: '100%',
      borderRadius: theme.roundness.md,
      marginBottom: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
    },
    galleryStrip: {
      gap: 10,
      paddingBottom: theme.spacing.md,
    },
    galleryThumbWrap: {
      borderRadius: theme.roundness.md,
      borderWidth: 2,
      borderColor: 'transparent',
      overflow: 'hidden',
      marginRight: 2,
    },
    galleryThumbWrapActive: {
      borderColor: theme.colors.primary,
    },
    galleryThumb: {
      width: 84,
      height: 84,
      backgroundColor: theme.colors.surface,
    },
    imagePlaceholder: {
      height: 250,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    imagePlaceholderIcon: {
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent + '16',
      borderWidth: 1,
      borderColor: theme.colors.accent + '40',
    },
    imageText: {
      color: theme.colors.textMuted,
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      maxWidth: 420,
    },
    imagePlaceholderTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 12,
    },
    imagePlaceholderMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    imagePlaceholderMetaText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      gap: 10,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    title: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: theme.spacing.sm },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    editButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    manageListingRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      alignSelf: 'flex-start',
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    toggleButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.error + '44',
      backgroundColor: theme.colors.error + '10',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    deleteButtonText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '800',
    },
    priceValue: { color: theme.colors.primary, fontSize: 22, fontWeight: 'bold' },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    statusItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusCopy: {
      flex: 1,
      gap: 2,
    },
    statusLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    statusDivider: {
      width: 1,
      minHeight: 36,
      backgroundColor: theme.colors.border,
    },
    contactPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.primary + '55',
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      marginTop: -theme.spacing.sm,
      marginBottom: theme.spacing.lg,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 2,
    },
    contactPanelAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    contactPanelCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    contactPanelEyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    contactPanelName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    contactPanelHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    contactPanelButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 14,
      flexShrink: 0,
    },
    contactPanelButtonDisabled: {
      opacity: 0.45,
    },
    contactPanelButtonText: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
    },
    verifiedText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    pausedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#FF950010',
      borderWidth: 1,
      borderColor: '#FF950044',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
    },
    pausedText: {
      color: '#FF9500',
      fontSize: 11,
      fontWeight: '900',
    },
    quickFacts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: theme.spacing.lg,
    },
    factChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    factChipText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    pricingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: 4,
    },
    pricingEyebrow: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    pricingValueLarge: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
    },
    pricingHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 2,
    },
    sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: theme.spacing.sm },
    bodyText: { color: theme.colors.textMuted, fontSize: 16, lineHeight: 24, marginBottom: theme.spacing.lg },
    highlightsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: theme.spacing.lg,
    },
    highlightCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 6,
    },
    highlightLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    highlightValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: 4,
    },
    locationCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: 8,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    locationCopy: {
      flex: 1,
      gap: 2,
    },
    locationHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    infoGrid: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    infoGridItem: {
      flex: 1,
    },
    sellerCard: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    sellerHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    sellerAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sellerCopy: {
      flex: 1,
      gap: 2,
    },
    sellerName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    sellerHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    sellerTrustGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sellerTrustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    sellerTrustText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    sellerVerifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    sellerVerifiedText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
    },
    moderationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    secondaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryActionText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    reportActionText: {
      color: theme.colors.error,
    },
    safetyCard: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    safetyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    safetyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent + '18',
      flexShrink: 0,
    },
    safetyCopy: {
      flex: 1,
      gap: 3,
    },
    safetyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    safetyHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    sectionInlineTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    infoLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 6,
    },
    infoValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    amenitiesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: theme.spacing.xl,
    },
    amenityChip: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    amenityText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    lockCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    lockText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    contactBtn: {
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.md,
      borderRadius: theme.roundness.full,
      gap: 8,
      marginTop: 12,
    },
    contactBtnDisabled: {
      opacity: 0.45,
    },
    contactBtnText: { color: theme.colors.background, fontSize: 16, fontWeight: 'bold' },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.overlay,
    },
    reportModal: {
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    reportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    reportTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    reportCloseButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.colors.cardSoft,
    },
    reportHint: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    reportReasonList: {
      gap: 8,
    },
    reportReasonButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    reportReasonButtonActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent,
    },
    reportReasonText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    reportReasonTextActive: {
      color: theme.colors.background,
    },
    reportInput: {
      minHeight: 96,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      fontSize: 14,
      padding: 12,
      lineHeight: 20,
    },
    reportSubmitButton: {
      minHeight: 48,
      borderRadius: theme.roundness.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    reportSubmitText: {
      color: theme.colors.background,
      fontSize: 15,
      fontWeight: '900',
    },
  });
