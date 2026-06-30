import { supabase } from '../lib/supabase';
import { CrewAccessService } from './CrewAccessService';
import { UserScopedStorage } from './UserScopedStorage';

const HIDDEN_LISTINGS_KEY = 'yofly.marketplace.hiddenListings';

export type ListingReportReason =
  | 'INACCURATE'
  | 'UNSAFE'
  | 'SPAM'
  | 'UNAVAILABLE'
  | 'OTHER';

export const MARKETPLACE_REPORT_REASONS: Array<{ id: ListingReportReason; label: string }> = [
  { id: 'INACCURATE', label: 'Inaccurate listing' },
  { id: 'UNSAFE', label: 'Unsafe or suspicious' },
  { id: 'SPAM', label: 'Duplicate or spam' },
  { id: 'UNAVAILABLE', label: 'Already unavailable' },
  { id: 'OTHER', label: 'Other' },
];

const parseHiddenListings = (value: string | null) => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((listingId): listingId is string => typeof listingId === 'string')
      : [];
  } catch (_error) {
    return [];
  }
};

export const MarketplaceModerationService = {
  async getHiddenListingIds(userId?: string | null) {
    const raw = await UserScopedStorage.getItem(HIDDEN_LISTINGS_KEY, { userId });
    return parseHiddenListings(raw);
  },

  async hideListing(listingId: string, userId?: string | null) {
    const current = await this.getHiddenListingIds(userId);
    const next = Array.from(new Set([...current, listingId]));
    await UserScopedStorage.setItem(HIDDEN_LISTINGS_KEY, JSON.stringify(next), { userId });
    return next;
  },

  async unhideListing(listingId: string, userId?: string | null) {
    const current = await this.getHiddenListingIds(userId);
    const next = current.filter((hiddenListingId) => hiddenListingId !== listingId);
    await UserScopedStorage.setItem(HIDDEN_LISTINGS_KEY, JSON.stringify(next), { userId });
    return next;
  },

  async reportListing(listingId: string, reason: ListingReportReason, notes?: string) {
    const user = await CrewAccessService.requireVerifiedCrew();
    const cleanNotes = notes?.trim();

    const { error } = await supabase.from('marketplace_listing_reports').upsert(
      {
        listing_id: listingId,
        reporter_id: user.id,
        reason,
        notes: cleanNotes || null,
      },
      {
        onConflict: 'listing_id,reporter_id,reason',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      throw error;
    }
  },
};
