import { supabase } from '../lib/supabase';
import {
  CreateListingInput,
  Listing,
  ListingCategory,
  GenderPreference,
  MarketplaceListingDetails,
} from '../types/marketplace';
import { CrewAccessService } from './CrewAccessService';

const LISTING_IMAGE_BUCKET = 'listing-images';
const MISSING_TABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);
const RENEW_WAIT_DAYS = 5;
const LISTING_EXPIRES_AFTER_DAYS = 30;

export type ListingLifecycleStatus = 'ACTIVE' | 'PAUSED';

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const getListingMarketplaceDetails = (details?: Listing['details'] | null) => details?.marketplace || {};

const getListingLifecycleStatus = (details?: Listing['details'] | null): ListingLifecycleStatus =>
  getListingMarketplaceDetails(details).status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';

const buildRenewalFields = (date: Date): Required<Pick<
  MarketplaceListingDetails,
  'lastRenewedAt' | 'renewEligibleAt' | 'expiresAt'
>> => ({
  lastRenewedAt: date.toISOString(),
  renewEligibleAt: addDays(date, RENEW_WAIT_DAYS).toISOString(),
  expiresAt: addDays(date, LISTING_EXPIRES_AFTER_DAYS).toISOString(),
});

const ensureMarketplaceDetails = (
  details: Listing['details'] | null | undefined,
  createdAt?: string | null
): NonNullable<Listing['details']> => {
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const existing = getListingMarketplaceDetails(details);
  const listedAt = existing.listedAt || safeBaseDate.toISOString();
  const lastRenewedAt = existing.lastRenewedAt || listedAt;
  const renewalBaseDate = new Date(lastRenewedAt);
  const safeRenewalBaseDate = Number.isNaN(renewalBaseDate.getTime()) ? safeBaseDate : renewalBaseDate;

  return {
    ...(details || {}),
    marketplace: {
      status: existing.status || 'ACTIVE',
      listedAt,
      ...buildRenewalFields(safeRenewalBaseDate),
      ...existing,
    },
  };
};

const setListingRenewedAt = (
  details: Listing['details'] | null | undefined,
  renewedAt: Date
): Listing['details'] => ({
  ...(details || {}),
  marketplace: {
    ...getListingMarketplaceDetails(details),
    ...buildRenewalFields(renewedAt),
    updatedAt: renewedAt.toISOString(),
  },
});

const setListingLifecycleStatus = (
  details: Listing['details'] | null | undefined,
  status: ListingLifecycleStatus
): Listing['details'] => {
  const nextDetails = {
    ...(details || {}),
    marketplace: {
      ...getListingMarketplaceDetails(details),
      status,
      updatedAt: new Date().toISOString(),
    },
  } as Listing['details'];

  return nextDetails;
};

const isMissingTableError = (error: { code?: string } | null | undefined) =>
  typeof error?.code === 'string' && MISSING_TABLE_ERROR_CODES.has(error.code);

const getStoredImageRefs = (row: { image_url?: string | null; image_urls?: string[] | null } | null | undefined) => {
  const refs = Array.isArray(row?.image_urls) && row.image_urls.length > 0
    ? row.image_urls
    : row?.image_url
      ? [row.image_url]
      : [];

  return refs.filter((ref): ref is string => typeof ref === 'string' && !/^https?:\/\//i.test(ref));
};

const removeStoredImages = async (imageRefs: string[]) => {
  const uniqueRefs = Array.from(new Set(imageRefs)).filter(Boolean);
  if (uniqueRefs.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(LISTING_IMAGE_BUCKET).remove(uniqueRefs);
  if (error) {
    console.warn('Failed to remove listing images from storage:', error);
  }
};

const resolveListingImageUrl = async (imageRef?: string | null) => {
  if (!imageRef) {
    return undefined;
  }

  if (/^https?:\/\//i.test(imageRef)) {
    return imageRef;
  }

  const { data, error } = await supabase.storage
    .from(LISTING_IMAGE_BUCKET)
    .createSignedUrl(imageRef, 60 * 60);

  if (error) {
    console.warn('Failed to create signed URL for listing image:', error);
    return undefined;
  }

  return data.signedUrl;
};

const resolveListingImageUrls = async (imageRefs?: string[] | null) => {
  if (!Array.isArray(imageRefs) || imageRefs.length === 0) {
    return [];
  }

  const signedUrls = await Promise.all(imageRefs.map((imageRef) => resolveListingImageUrl(imageRef)));
  return signedUrls.filter((imageUrl): imageUrl is string => Boolean(imageUrl));
};

const mapRowToListing = async (row: any, hostListingCount?: number): Promise<Listing> => {
  const resolvedGallery =
    Array.isArray(row.image_urls) && row.image_urls.length > 0
      ? await resolveListingImageUrls(row.image_urls)
      : [];
  const primaryImageUrl = await resolveListingImageUrl(row.image_url);
  const imageUrls = resolvedGallery.length > 0
    ? resolvedGallery
    : primaryImageUrl
      ? [primaryImageUrl]
      : [];
  const imageRefs =
    Array.isArray(row.image_urls) && row.image_urls.length > 0
      ? row.image_urls.filter((imageRef: unknown): imageRef is string => typeof imageRef === 'string')
      : typeof row.image_url === 'string'
        ? [row.image_url]
        : [];

  const normalizedDetails = ensureMarketplaceDetails(row.details || undefined, row.created_at);

  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    priceMonthly: row.price_monthly,
    airportCode: row.airport_code,
    category: row.category as ListingCategory,
    genderPreference: (row.gender_pref as GenderPreference) || GenderPreference.MIXED,
    bedsAvailable: row.beds_available ?? 0,
    distanceToAirport: row.distance_info || '',
    hostName: row.profiles?.full_name || 'Verified Host',
    isCrewVerified: Boolean(row.profiles?.verified_crew || row.profiles?.verified_marketplace || row.is_verified),
    createdAt: row.created_at,
    description: row.description || '',
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    imageUrl: imageUrls[0],
    imageUrls,
    imageRefs,
    hostBaseAirport: row.profiles?.base_airport || undefined,
    hostJoinedAt: row.profiles?.created_at || undefined,
    hostListingCount,
    details: normalizedDetails,
  };
};

export const MarketplaceService = {
  getListingLifecycleStatus,
  renewWaitDays: RENEW_WAIT_DAYS,
  listingExpiresAfterDays: LISTING_EXPIRES_AFTER_DAYS,

  isListingPaused(listing: Pick<Listing, 'details'>) {
    return getListingLifecycleStatus(listing.details) === 'PAUSED';
  },

  isListingRenewEligible(listing: Pick<Listing, 'details' | 'createdAt'>, now = new Date()) {
    if (getListingLifecycleStatus(listing.details) === 'PAUSED') {
      return false;
    }

    const details = ensureMarketplaceDetails(listing.details, listing.createdAt);
    const renewEligibleAt = details.marketplace?.renewEligibleAt;
    const eligibleAt = renewEligibleAt ? new Date(renewEligibleAt) : addDays(new Date(listing.createdAt), RENEW_WAIT_DAYS);

    return !Number.isNaN(eligibleAt.getTime()) && eligibleAt.getTime() <= now.getTime();
  },

  getListingRenewEligibleAt(listing: Pick<Listing, 'details' | 'createdAt'>) {
    return ensureMarketplaceDetails(listing.details, listing.createdAt).marketplace?.renewEligibleAt;
  },

  getListingSortTime(listing: Pick<Listing, 'details' | 'createdAt'>) {
    const marketplace = ensureMarketplaceDetails(listing.details, listing.createdAt).marketplace;
    const sortDate = new Date(marketplace?.lastRenewedAt || listing.createdAt);

    return Number.isNaN(sortDate.getTime()) ? new Date(listing.createdAt).getTime() : sortDate.getTime();
  },

  /**
   * Fetch listings with filters
   */
  async getListings(airportCode?: string, category?: ListingCategory): Promise<Listing[]> {
    let query = supabase
      .from('listings')
      .select('*, profiles(full_name, role, base_airport, created_at, verified_crew, verified_marketplace)');

    if (airportCode) {
      query = query.eq('airport_code', airportCode);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase listings table unavailable, showing empty marketplace:'
          : 'Listing fetch failed:',
        error
      );
      return [];
    }

    return Promise.all((data || []).map(mapRowToListing));
  },

  async getListingById(id: string): Promise<Listing | null> {
    if (!isValidUuid(id)) {
      return null;
    }

    const { data, error } = await supabase
      .from('listings')
      .select('*, profiles(full_name, role, base_airport, created_at, verified_crew, verified_marketplace)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase listings table unavailable while loading listing detail:'
          : 'Listing detail fetch failed:',
        error
      );
      return null;
    }

    if (!data) {
      return null;
    }

    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', data.host_id);

    return mapRowToListing(data, count ?? undefined);
  },

  async getUserListings(userId: string): Promise<Listing[]> {
    const { data, error } = await supabase
      .from('listings')
      .select('*, profiles(full_name, role, base_airport, created_at, verified_crew, verified_marketplace)')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase listings table unavailable while loading user listings:'
          : 'User listing fetch failed:',
        error
      );
      return [];
    }

    return Promise.all((data || []).map(mapRowToListing));
  },

  async uploadListingImage(userId: string, uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${userId}/${Date.now()}-${(uri.split('/').pop() || 'listing.jpg').replace(/[^a-zA-Z0-9._-]/g, '-')}`;

    const { error } = await supabase.storage.from(LISTING_IMAGE_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return path;
  },

  async uploadListingImages(userId: string, uris: string[]) {
    return Promise.all(uris.map((uri) => this.uploadListingImage(userId, uri)));
  },

  /**
   * Create a new listing
   */
  async createListing(listing: CreateListingInput) {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { data, error } = await supabase
      .from('listings')
      .insert({
        host_id: user.id,
        title: listing.title,
        price_monthly: listing.priceMonthly,
        airport_code: listing.airportCode,
        category: listing.category,
        gender_pref: listing.genderPreference,
        beds_available: listing.bedsAvailable,
        distance_info: listing.distanceToAirport,
        description: listing.description,
        amenities: listing.amenities,
        image_url: listing.imageUrls[0] || listing.imageUrl || null,
        image_urls: listing.imageUrls,
        details: ensureMarketplaceDetails(listing.details),
        is_verified: false,
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id as string;
  },

  async updateListing(listingId: string, listing: CreateListingInput) {
    const user = await CrewAccessService.requireVerifiedCrew();
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('details, image_url, image_urls')
      .eq('id', listingId)
      .eq('host_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingListing) {
      throw new Error('Listing not found or you do not own it.');
    }

    const { error } = await supabase
      .from('listings')
      .update({
        title: listing.title,
        price_monthly: listing.priceMonthly,
        airport_code: listing.airportCode,
        category: listing.category,
        gender_pref: listing.genderPreference,
        beds_available: listing.bedsAvailable,
        distance_info: listing.distanceToAirport,
        description: listing.description,
        amenities: listing.amenities,
        image_url: listing.imageUrls[0] || listing.imageUrl || null,
        image_urls: listing.imageUrls,
        details: {
          ...(listing.details || {}),
          marketplace: getListingMarketplaceDetails(existingListing.details),
        },
      })
      .eq('id', listingId)
      .eq('host_id', user.id);

    if (error) throw error;

    const nextRefs = new Set((listing.imageUrls || []).filter((ref) => !/^https?:\/\//i.test(ref)));
    const removedRefs = getStoredImageRefs(existingListing).filter((ref) => !nextRefs.has(ref));
    await removeStoredImages(removedRefs);
  },

  async setListingLifecycleStatus(listingId: string, status: ListingLifecycleStatus) {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('details')
      .eq('id', listingId)
      .eq('host_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingListing) {
      throw new Error('Listing not found or you do not own it.');
    }

    const { error } = await supabase
      .from('listings')
      .update({
        details: setListingLifecycleStatus(existingListing.details, status),
      })
      .eq('id', listingId)
      .eq('host_id', user.id);

    if (error) {
      throw error;
    }
  },

  async pauseListing(listingId: string) {
    return this.setListingLifecycleStatus(listingId, 'PAUSED');
  },

  async resumeListing(listingId: string) {
    return this.setListingLifecycleStatus(listingId, 'ACTIVE');
  },

  async relistListing(listingId: string) {
    return this.resumeListing(listingId);
  },

  async renewListing(listingId: string) {
    const user = await CrewAccessService.requireVerifiedCrew();
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('created_at, details')
      .eq('id', listingId)
      .eq('host_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingListing) {
      throw new Error('Listing not found or you do not own it.');
    }

    const now = new Date();
    const normalizedDetails = ensureMarketplaceDetails(existingListing.details, existingListing.created_at);
    const renewEligibleAt = normalizedDetails.marketplace?.renewEligibleAt
      ? new Date(normalizedDetails.marketplace.renewEligibleAt)
      : addDays(new Date(existingListing.created_at), RENEW_WAIT_DAYS);

    if (!Number.isNaN(renewEligibleAt.getTime()) && renewEligibleAt.getTime() > now.getTime()) {
      throw new Error(`Renew is available ${renewEligibleAt.toLocaleDateString()}.`);
    }

    const { error } = await supabase
      .from('listings')
      .update({
        details: setListingRenewedAt(normalizedDetails, now),
      })
      .eq('id', listingId)
      .eq('host_id', user.id);

    if (error) {
      throw error;
    }
  },

  async deleteListing(listingId: string) {
    const user = await CrewAccessService.requireVerifiedCrew();
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('image_url, image_urls')
      .eq('id', listingId)
      .eq('host_id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('host_id', user.id);

    if (error) throw error;
    await removeStoredImages(getStoredImageRefs(existingListing));
  },
};
