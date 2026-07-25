import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { formatDistanceToNow } from 'date-fns';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { ListingCard } from '../../src/components/ListingCard';
import { MarketplaceFilters } from '../../src/components/MarketplaceFilters';
import { MarketplaceMapPreview } from '../../src/components/MarketplaceMapPreview';
import { AppSyncService } from '../../src/services/AppSyncService';
import { AirportSearchService } from '../../src/services/AirportSearchService';
import { supabase } from '../../src/lib/supabase';
import { confirmAction } from '../../src/utils/confirmAction';
import {
  Listing,
  ListingCategory,
} from '../../src/types/marketplace';
import { MarketplaceService } from '../../src/services/MarketplaceService';
import { MarketplaceModerationService } from '../../src/services/MarketplaceModerationService';
import { ChatService } from '../../src/services/ChatService';
import { ChatRoom } from '../../src/types/chat';

type MarketplaceViewMode = 'BROWSE' | 'MINE';
type BrowseLayoutMode = 'LIST' | 'MAP';
type MarketplaceFeedTab = 'SELL' | 'FOR_YOU' | 'LOCAL' | 'CATEGORIES';
type SellerListRow =
  | {
      type: 'section';
      id: string;
      title: string;
      subtitle: string;
      icon: keyof typeof Ionicons.glyphMap;
      count: number;
    }
  | {
      type: 'listing';
      id: string;
      listing: Listing;
    };

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMiles = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
) => {
  const radiusMiles = 3958.8;
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getListingCoordinate = (listing: Listing) => {
  const latitude = listing.details?.local?.latitude;
  const longitude = listing.details?.local?.longitude;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return { latitude, longitude };
  }

  const airport = AirportSearchService.getAirportByCode(listing.airportCode);
  return airport ? { latitude: airport.latitude, longitude: airport.longitude } : null;
};

export default function MarketplaceScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedAirport, setSelectedAirport] = useState('ANY');
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<MarketplaceViewMode>('BROWSE');
  const [localOnly, setLocalOnly] = useState(true);
  const [browseLayoutMode, setBrowseLayoutMode] = useState<BrowseLayoutMode>('LIST');
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [remoteCrewAccess, setRemoteCrewAccess] = useState<boolean | null>(null);
  const [hiddenListingIds, setHiddenListingIds] = useState<string[]>([]);
  const [sellerMessageRooms, setSellerMessageRooms] = useState<ChatRoom[]>([]);
  const router = useRouter();
  const hasAuthSession = Boolean(user?.id || profile.verifiedCrew || profile.verifiedMarketplace);
  const hasCrewAccess = Boolean(profile.verifiedCrew || profile.verifiedMarketplace || remoteCrewAccess);
  const canBrowseMarketplace = Boolean(hasAuthSession && hasCrewAccess);
  const canPostMarketplace = canBrowseMarketplace;
  const activeFeedTab: MarketplaceFeedTab =
    viewMode === 'MINE'
      ? 'SELL'
      : selectedCategory !== 'ALL'
        ? 'CATEGORIES'
        : localOnly
          ? 'LOCAL'
          : 'FOR_YOU';

  const handleSelectFeedTab = (tab: MarketplaceFeedTab) => {
    if (tab === 'SELL') {
      setViewMode('MINE');
      return;
    }

    setViewMode('BROWSE');

    if (tab === 'FOR_YOU') {
      setLocalOnly(false);
      setSelectedCategory('ALL');
      return;
    }

    if (tab === 'LOCAL') {
      setLocalOnly(true);
      setSelectedCategory('ALL');
      return;
    }

    setLocalOnly(false);
  };

  const loadListings = useCallback(async () => {
    if (!canBrowseMarketplace) {
      setListings([]);
      return;
    }

    const data =
      viewMode === 'MINE' && user?.id
        ? await MarketplaceService.getUserListings(user.id)
        : await MarketplaceService.getListings(
            undefined,
            selectedCategory === 'ALL' ? undefined : selectedCategory
          );

    setListings(data);
  }, [canBrowseMarketplace, selectedCategory, user?.id, viewMode]);

  const loadSellerMessageRooms = useCallback(async () => {
    if (!canBrowseMarketplace || !user?.id) {
      setSellerMessageRooms([]);
      return;
    }

    const rooms = await ChatService.getRoomIndex(user.id, {
      baseAirport: profile.baseAirport,
      favoriteAirports: profile.preferences.favoriteAirports,
    });

    setSellerMessageRooms(
      rooms.filter((room) => room.id.startsWith('listing:') && room.id.includes(`:host:${user.id}`))
    );
  }, [canBrowseMarketplace, profile.baseAirport, profile.preferences.favoriteAirports, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadListings();
      void loadSellerMessageRooms();
      void MarketplaceModerationService.getHiddenListingIds(user?.id).then(setHiddenListingIds);
    }, [loadListings, loadSellerMessageRooms, user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshCrewAccess = async () => {
        if (!user?.id) {
          setRemoteCrewAccess(null);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('verified_crew, verified_marketplace')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          console.warn('Failed to refresh Marketplace crew access:', error);
          setRemoteCrewAccess(null);
          return;
        }

        setRemoteCrewAccess(Boolean(data?.verified_crew || data?.verified_marketplace));
      };

      void refreshCrewAccess();

      return () => {
        active = false;
      };
    }, [user?.id])
  );

  useEffect(() => {
    return AppSyncService.subscribe((event) => {
      if (event === 'marketplace') {
        void loadListings();
      }
    });
  }, [loadListings]);

  const filteredListings = useMemo(
    () =>
      [...listings]
        .filter((listing) =>
          viewMode === 'BROWSE' ? !MarketplaceService.isListingPaused(listing) : true
        )
        .filter((listing) =>
          viewMode === 'BROWSE' ? !hiddenListingIds.includes(listing.id) : true
        )
        .filter((listing) =>
          viewMode === 'BROWSE' && localOnly ? listing.details?.local?.isLocalPickup !== false : true
        )
        .filter((listing) => {
          if (viewMode !== 'BROWSE' || selectedAirport === 'ANY') {
            return true;
          }

          const selectedAirportCenter = AirportSearchService.getAirportByCode(selectedAirport);
          const listingCoordinate = getListingCoordinate(listing);

          if (!selectedAirportCenter || !listingCoordinate) {
            return listing.airportCode === selectedAirport;
          }

          return getDistanceMiles(selectedAirportCenter, listingCoordinate) <= radiusMiles;
        })
        .sort((a, b) => MarketplaceService.getListingSortTime(b) - MarketplaceService.getListingSortTime(a)),
    [hiddenListingIds, listings, localOnly, radiusMiles, selectedAirport, viewMode]
  );
  const emptyTitle = !hasAuthSession
    ? 'Sign in to unlock Marketplace'
    : !hasCrewAccess
      ? 'Crew verification unlocks Marketplace'
    : viewMode === 'MINE'
      ? 'No listings posted yet'
      : 'No live listings yet';
  const emptyMessage = !hasAuthSession
    ? 'Use your verified crew account to browse and post crew-only listings.'
    : !hasCrewAccess
      ? 'Crew-only listings stay hidden until employee-email verification is approved.'
    : viewMode === 'MINE'
      ? 'Create a listing when you are ready to offer a crash pad, product, or service to verified crew.'
      : selectedAirport === 'ANY'
        ? 'When verified crew post listings, they will appear here without sample inventory.'
        : `No verified crew listings are live around ${selectedAirport} yet. Try another airport or radius.`;
  const lockedBannerMessage = hasAuthSession
    ? 'Marketplace browsing and posting unlock after crew verification is approved.'
    : 'Sign in with your verified crew account to browse and post Marketplace listings.';
  const lockedActionLabel = hasAuthSession ? 'Start verification' : 'Sign In';
  const lockedActionIcon = hasAuthSession ? 'shield-checkmark-outline' : 'log-in-outline';

  const mineCounts = useMemo(() => {
    const active = listings.filter((listing) => !MarketplaceService.isListingPaused(listing)).length;
    const paused = listings.length - active;
    const renewable = listings.filter((listing) => MarketplaceService.isListingRenewEligible(listing)).length;

    return {
      active,
      paused,
      renewable,
      total: listings.length,
    };
  }, [listings]);

  const sellerRows = useMemo<SellerListRow[]>(() => {
    const renewableListings = filteredListings.filter((listing) => MarketplaceService.isListingRenewEligible(listing));
    const pausedListings = filteredListings.filter((listing) => MarketplaceService.isListingPaused(listing));
    const activeListings = filteredListings.filter(
      (listing) =>
        !MarketplaceService.isListingPaused(listing) &&
        !MarketplaceService.isListingRenewEligible(listing)
    );

    const buildSection = (
      id: string,
      title: string,
      subtitle: string,
      icon: keyof typeof Ionicons.glyphMap,
      sectionListings: Listing[]
    ): SellerListRow[] =>
      sectionListings.length
        ? [
            { type: 'section', id, title, subtitle, icon, count: sectionListings.length },
            ...sectionListings.map((listing) => ({ type: 'listing' as const, id: listing.id, listing })),
          ]
        : [];

    return [
      ...buildSection(
        'renewable',
        'Renew now',
        'Ready to move back up in browse results',
        'refresh-circle-outline',
        renewableListings
      ),
      ...buildSection(
        'paused',
        'Paused',
        'Hidden from buyers until you resume',
        'pause-circle-outline',
        pausedListings
      ),
      ...buildSection(
        'active',
        'Active',
        'Live and waiting for buyer messages',
        'checkmark-circle-outline',
        activeListings
      ),
    ];
  }, [filteredListings]);

  const handleDeleteListing = (listing: Listing) => {
    confirmAction({
      title: 'Delete Listing',
      message: `Remove "${listing.title}" from the crew marketplace?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.deleteListing(listing.id);
            setListings((current) => current.filter((item) => item.id !== listing.id));
            AppSyncService.emit('marketplace');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete this listing right now.';
            Alert.alert('Delete Failed', message);
          }
        })();
      },
    });
  };

  const handleToggleListingStatus = (listing: Listing) => {
    const isPaused = MarketplaceService.isListingPaused(listing);
    const nextLabel = isPaused ? 'resume' : 'pause';

    confirmAction({
      title: `${isPaused ? 'Resume' : 'Pause'} Listing`,
      message: `${isPaused ? 'Bring' : 'Temporarily remove'} "${listing.title}" ${isPaused ? 'back into' : 'from'} the crew marketplace?`,
      confirmText: isPaused ? 'Resume' : 'Pause',
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.setListingLifecycleStatus(
              listing.id,
              isPaused ? 'ACTIVE' : 'PAUSED'
            );
            setListings((current) =>
              current.map((item) =>
                item.id === listing.id
                  ? {
                      ...item,
                      details: ({
                        ...(item.details || {}),
                        marketplace: {
                          ...((item.details as { marketplace?: { status?: string } } | undefined)?.marketplace || {}),
                          status: isPaused ? 'ACTIVE' : 'PAUSED',
                          updatedAt: new Date().toISOString(),
                        },
                      } as Listing['details']),
                    }
                  : item
              )
            );
            AppSyncService.emit('marketplace');
          } catch (error) {
            const message =
              error instanceof Error ? error.message : `Unable to ${nextLabel} this listing right now.`;
            Alert.alert('Listing Update Failed', message);
          }
        })();
      },
    });
  };

  const handleRenewListing = (listing: Listing) => {
    confirmAction({
      title: 'Renew Listing',
      message: `Move "${listing.title}" back up in Marketplace browse results? Renew will be available again in ${MarketplaceService.renewWaitDays} days.`,
      confirmText: 'Renew',
      onConfirm: () => {
        void (async () => {
          try {
            await MarketplaceService.renewListing(listing.id);
            const now = new Date();
            setListings((current) =>
              current.map((item) =>
                item.id === listing.id
                  ? {
                      ...item,
                      details: ({
                        ...(item.details || {}),
                        marketplace: {
                          ...((item.details || {}).marketplace || {}),
                          lastRenewedAt: now.toISOString(),
                          renewEligibleAt: new Date(now.getTime() + MarketplaceService.renewWaitDays * 24 * 60 * 60 * 1000).toISOString(),
                          expiresAt: new Date(now.getTime() + MarketplaceService.listingExpiresAfterDays * 24 * 60 * 60 * 1000).toISOString(),
                          updatedAt: now.toISOString(),
                        },
                      } as Listing['details']),
                    }
                  : item
              )
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

  const renderListing = ({ item }: { item: Listing }) => (
    <ListingCard
      listing={item}
      onPress={() => router.push(`/listing/${item.id}`)}
      canManage={Boolean(viewMode === 'MINE' && user?.id && item.hostId === user.id)}
      onEdit={() => router.push({ pathname: '/create-listing', params: { id: item.id } })}
      onDelete={() => handleDeleteListing(item)}
      onToggleStatus={() => handleToggleListingStatus(item)}
      onRenew={() => handleRenewListing(item)}
    />
  );
  const renderSellerRow = ({ item }: { item: SellerListRow }) => {
    if (item.type === 'section') {
      return (
        <View style={styles.sellerSectionHeader}>
          <View style={styles.sellerSectionIcon}>
            <Ionicons name={item.icon} size={18} color={theme.colors.background} />
          </View>
          <View style={styles.sellerSectionCopy}>
            <Text style={styles.sellerSectionTitle}>{item.title}</Text>
            <Text style={styles.sellerSectionSubtitle}>{item.subtitle}</Text>
          </View>
          <View style={styles.sellerSectionCount}>
            <Text style={styles.sellerSectionCountText}>{item.count}</Text>
          </View>
        </View>
      );
    }

    return renderListing({ item: item.listing });
  };
  const renderSellerMessageRoom = (room: ChatRoom) => (
    <TouchableOpacity
      key={room.id}
      style={styles.messageRoomCard}
      onPress={() =>
        router.push({
          pathname: '/chat/[roomId]',
          params: {
            roomId: room.id,
            name: room.name,
            city: room.city,
            memberCount: String(room.memberCount || 2),
          },
        })
      }
    >
      <View style={styles.messageRoomIcon}>
        <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.background} />
      </View>
      <View style={styles.messageRoomCopy}>
        <Text style={styles.messageRoomTitle} numberOfLines={1}>
          {room.name}
        </Text>
        <Text style={styles.messageRoomPreview} numberOfLines={1}>
          {room.lastMessage || 'Open buyer conversation'}
        </Text>
      </View>
      <View style={styles.messageRoomMeta}>
        {room.unreadCount ? (
          <View style={styles.messageUnreadBadge}>
            <Text style={styles.messageUnreadText}>{room.unreadCount}</Text>
          </View>
        ) : null}
        <Text style={styles.messageRoomTime} numberOfLines={1}>
          {room.lastActivity
            ? formatDistanceToNow(new Date(room.lastActivity), { addSuffix: true })
            : 'Open'}
        </Text>
      </View>
    </TouchableOpacity>
  );
  const renderBrowseListing = ({ item }: { item: Listing }) => (
    <ListingCard
      listing={item}
      onPress={() => router.push(`/listing/${item.id}`)}
    />
  );
  const browseLocationLabel =
    selectedAirport === 'ANY' ? 'Near your crew network' : `${selectedAirport} · within ${radiusMiles} mi`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroShell}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              Marketplace
            </Text>
            <Text style={styles.headerSub}>
              {viewMode === 'MINE' ? 'Manage your live crew inventory' : 'Find your home base'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.listBtn, !canPostMarketplace && styles.listBtnDisabled]}
            disabled={!canPostMarketplace}
            onPress={() => router.push('/create-listing')}
          >
            <Ionicons name="add" size={18} color={theme.colors.background} />
            <Text style={styles.listBtnText} numberOfLines={1}>List Space</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketNavRow}>
          {[
            { id: 'SELL' as const, label: 'Sell' },
            { id: 'FOR_YOU' as const, label: 'For You' },
            { id: 'LOCAL' as const, label: 'Local' },
            { id: 'CATEGORIES' as const, label: 'Categories' },
          ].map((tab) => {
            const active = activeFeedTab === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.marketNavTab, active && styles.marketNavTabActive]}
                onPress={() => handleSelectFeedTab(tab.id)}
              >
                <Text
                  style={[styles.marketNavText, active && styles.marketNavTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!canBrowseMarketplace ? (
        <CrewLockBanner message={lockedBannerMessage} />
      ) : null}

      {canBrowseMarketplace && viewMode === 'BROWSE' ? (
        <MarketplaceFilters
          selectedAirport={selectedAirport}
          selectedCategory={selectedCategory}
          localOnly={localOnly}
          browseLayoutMode={browseLayoutMode}
          radiusMiles={radiusMiles}
          onSelectAirport={setSelectedAirport}
          onSelectCategory={setSelectedCategory}
          onToggleLocalOnly={() => setLocalOnly((current) => !current)}
          onSelectBrowseLayoutMode={setBrowseLayoutMode}
          onSelectRadiusMiles={setRadiusMiles}
        />
      ) : null}

      {!canBrowseMarketplace ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={hasAuthSession ? 'lock-closed-outline' : 'person-circle-outline'}
            size={56}
            color={theme.colors.border}
          />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => router.push(hasAuthSession ? '/manual-review' : '/auth')}
          >
            <Ionicons name={lockedActionIcon} size={18} color={theme.colors.background} />
            <Text style={styles.emptyActionText}>{lockedActionLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canBrowseMarketplace && viewMode === 'MINE' ? (
        <View style={styles.ownerSummaryCard}>
          <View style={styles.ownerSummaryBlock}>
            <Text style={styles.ownerSummaryLabel}>Active listings</Text>
            <Text style={styles.ownerSummaryValue}>{mineCounts.active}</Text>
          </View>
          <View style={styles.ownerSummaryBlock}>
            <Text style={styles.ownerSummaryLabel}>Paused</Text>
            <Text style={styles.ownerSummaryValue}>{mineCounts.paused}</Text>
          </View>
          <View style={styles.ownerSummaryBlock}>
            <Text style={styles.ownerSummaryLabel}>Renew</Text>
            <Text style={styles.ownerSummaryValue}>{mineCounts.renewable}</Text>
          </View>
          <View style={styles.ownerSummaryBlock}>
            <Text style={styles.ownerSummaryLabel}>Base hub</Text>
            <Text style={styles.ownerSummaryValue}>{profile.baseAirport}</Text>
          </View>
          <TouchableOpacity
            style={[styles.ownerSummaryAction, !canPostMarketplace && styles.ownerSummaryActionDisabled]}
            disabled={!canPostMarketplace}
            onPress={() => router.push('/create-listing')}
          >
            <Ionicons name="add-circle-outline" size={16} color={theme.colors.background} />
            <Text style={styles.ownerSummaryActionText}>New Listing</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canBrowseMarketplace && viewMode === 'BROWSE' && browseLayoutMode === 'MAP' ? (
        <ScrollView
          style={styles.mapScroll}
          contentContainerStyle={[styles.mapContent, { paddingBottom: tabBarHeight + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <MarketplaceMapPreview
            airportCode={selectedAirport}
            listings={filteredListings}
            mapHeight={420}
            onSelectListing={(listing) =>
              router.push(`/listing/${listing.id}`)
            }
          />
        </ScrollView>
      ) : null}

      {canBrowseMarketplace && viewMode === 'MINE' ? (
        <FlatList
          data={sellerRows}
          keyExtractor={(item) => item.id}
          renderItem={renderSellerRow}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 24 }]}
          ListHeaderComponent={
            <View style={styles.sellerMessagesCard}>
              <View style={styles.sellerMessagesHeader}>
                <View>
                  <Text style={styles.sellerMessagesEyebrow}>Inbox</Text>
                  <Text style={styles.sellerMessagesTitle}>Marketplace messages</Text>
                </View>
                <TouchableOpacity
                  style={styles.sellerMessagesAction}
                  onPress={() => router.push('/chat')}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.background} />
                  <Text style={styles.sellerMessagesActionText}>All Messages</Text>
                </TouchableOpacity>
              </View>
              {sellerMessageRooms.length ? (
                <View style={styles.sellerMessagesList}>
                  {sellerMessageRooms.slice(0, 4).map(renderSellerMessageRoom)}
                </View>
              ) : (
                <View style={styles.sellerMessagesEmpty}>
                  <Ionicons name="chatbubble-outline" size={20} color={theme.colors.textMuted} />
                  <Text style={styles.sellerMessagesEmptyText}>
                    Buyer messages will appear here after someone contacts a listing.
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {canPostMarketplace ? (
                <TouchableOpacity style={styles.emptyAction} onPress={() => router.push('/create-listing')}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.background} />
                  <Text style={styles.emptyActionText}>
                    {viewMode === 'MINE' ? 'Create your first listing' : 'Create the first listing'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      ) : null}

      {canBrowseMarketplace && viewMode === 'BROWSE' && browseLayoutMode === 'LIST' ? (
        <FlatList
          key="marketplace-list"
          data={filteredListings}
          keyExtractor={(item) => item.id}
          renderItem={renderBrowseListing}
          contentContainerStyle={[styles.gridContent, { paddingBottom: tabBarHeight + 24 }]}
          ListHeaderComponent={
            <View style={styles.picksHeader}>
              <Text style={styles.picksTitle} numberOfLines={1}>Today's picks</Text>
              <View style={styles.picksLocation}>
                <Ionicons name="location" size={18} color={theme.colors.primary} />
                <Text style={styles.picksLocationText} numberOfLines={1}>{browseLocationLabel}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {canPostMarketplace ? (
                <TouchableOpacity style={styles.emptyAction} onPress={() => router.push('/create-listing')}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.background} />
                  <Text style={styles.emptyActionText}>Create the first listing</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      ) : null}
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
      padding: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: 12,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
    },
    headerSub: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginTop: 4,
    },
    listBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: theme.roundness.full,
      gap: 7,
      flexShrink: 0,
    },
    listBtnDisabled: {
      opacity: 0.45,
    },
    listBtnText: {
      color: theme.colors.background,
      fontWeight: '900',
      fontSize: 13,
    },
    marketNavRow: {
      gap: 6,
      paddingRight: 2,
    },
    marketNavTab: {
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    marketNavTabActive: {
      backgroundColor: theme.colors.primary + '28',
    },
    marketNavText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    marketNavTextActive: {
      color: theme.colors.primary,
    },
    viewModeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    viewModeChip: {
      flex: 1,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 10,
      alignItems: 'center',
    },
    viewModeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    viewModeChipText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    viewModeChipTextActive: {
      color: theme.colors.background,
    },
    ownerSummaryCard: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    ownerSummaryBlock: {
      flex: 1,
      gap: 4,
    },
    ownerSummaryLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    ownerSummaryValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    ownerSummaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
    },
    ownerSummaryActionDisabled: {
      opacity: 0.45,
    },
    ownerSummaryActionText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    listContent: {
      padding: theme.spacing.md,
    },
    sellerMessagesCard: {
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      gap: theme.spacing.md,
    },
    sellerMessagesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    sellerMessagesEyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    sellerMessagesTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 3,
    },
    sellerMessagesAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexShrink: 0,
    },
    sellerMessagesActionText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    sellerMessagesList: {
      gap: 10,
    },
    messageRoomCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    messageRoomIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    messageRoomCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    messageRoomTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    messageRoomPreview: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    messageRoomMeta: {
      alignItems: 'flex-end',
      gap: 5,
      maxWidth: 108,
    },
    messageUnreadBadge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 7,
    },
    messageUnreadText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    messageRoomTime: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    sellerMessagesEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    sellerMessagesEmptyText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    sellerSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sellerSectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    sellerSectionCopy: {
      flex: 1,
      gap: 2,
    },
    sellerSectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    sellerSectionSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    sellerSectionCount: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
    },
    sellerSectionCountText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    gridContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      width: '100%',
      maxWidth: 820,
      alignSelf: 'center',
    },
    picksHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 4,
      paddingBottom: 12,
    },
    picksTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    picksLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '56%',
    },
    picksLocationText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    mapContent: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
      flexGrow: 1,
    },
    mapScroll: {
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 72,
      marginHorizontal: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
    },
    emptyTitle: {
      color: theme.colors.text,
      marginTop: 18,
      fontSize: 21,
      lineHeight: 26,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyText: {
      color: theme.colors.textMuted,
      marginTop: 10,
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 360,
    },
    emptyAction: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emptyActionText: {
      color: theme.colors.background,
      fontWeight: '800',
    },
  });
