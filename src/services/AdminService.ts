import { supabase } from '../lib/supabase';
import { CrewVerificationMethod, CrewVerificationStatus } from '../types/verification';

export interface ManualReviewQueueItem {
  id: string;
  profileId: string;
  workEmail?: string;
  claimedAirline?: string;
  employeeIdLast4?: string;
  badgeImagePath?: string;
  status: string;
  reviewNotes?: string;
  createdAt: string;
  fullName?: string;
}

export type MarketplaceReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';

export interface MarketplaceReportQueueItem {
  id: string;
  listingId: string;
  reporterId: string;
  reason: string;
  notes?: string;
  status: MarketplaceReportStatus;
  createdAt: string;
  updatedAt?: string;
  listingTitle?: string;
  listingAirport?: string;
  listingHostId?: string;
  listingHostName?: string;
  reporterName?: string;
  reporterEmail?: string;
}

const mapStatusToNotes = (decision: 'APPROVED' | 'REJECTED', note?: string) =>
  note || (decision === 'APPROVED' ? 'Manual review approved.' : 'Manual review rejected.');

export const AdminService = {
  async isCurrentUserAdmin(email?: string | null) {
    if (!email) {
      return false;
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  },

  async getManualReviewQueue() {
    const { data, error } = await supabase
      .from('manual_review_requests')
      .select('id, profile_id, work_email, claimed_airline, employee_id_last4, badge_image_url, status, review_notes, created_at, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any): ManualReviewQueueItem => ({
      id: row.id,
      profileId: row.profile_id,
      workEmail: row.work_email || undefined,
      claimedAirline: row.claimed_airline || undefined,
      employeeIdLast4: row.employee_id_last4 || undefined,
      badgeImagePath: row.badge_image_url || undefined,
      status: row.status,
      reviewNotes: row.review_notes || undefined,
      createdAt: row.created_at,
      fullName: row.profiles?.full_name || undefined,
    }));
  },

  async createBadgePreviewUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('manual-review-badges')
      .createSignedUrl(path, 60 * 10);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  },

  async reviewManualRequest(params: {
    requestId: string;
    profileId: string;
    decision: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
  }) {
    const notes = mapStatusToNotes(params.decision, params.reviewNotes);
    const isApproved = params.decision === 'APPROVED';

    const { error: requestError } = await supabase
      .from('manual_review_requests')
      .update({
        status: params.decision,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.requestId);

    if (requestError) {
      throw requestError;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        verification_status: isApproved
          ? CrewVerificationStatus.VERIFIED_CREW
          : CrewVerificationStatus.REJECTED,
        verification_method: CrewVerificationMethod.MANUAL_REVIEW,
        verified_crew: isApproved,
        verified_marketplace: isApproved,
        verified_at: isApproved ? new Date().toISOString() : null,
        verification_notes: notes,
      })
      .eq('id', params.profileId);

    if (profileError) {
      throw profileError;
    }
  },

  async getMarketplaceReportQueue() {
    const { data: reportRows, error } = await supabase
      .from('marketplace_listing_reports')
      .select('id, listing_id, reporter_id, reason, notes, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const reports = (reportRows || []) as any[];
    const listingIds = Array.from(new Set(reports.map((row) => row.listing_id).filter(Boolean)));
    const profileIds = Array.from(
      new Set(
        reports
          .flatMap((row) => [row.reporter_id])
          .filter(Boolean)
      )
    );

    const [listingResult, reporterResult] = await Promise.all([
      listingIds.length
        ? supabase
            .from('listings')
            .select('id, title, airport_code, host_id, profiles(full_name)')
            .in('id', listingIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase
            .from('profiles')
            .select('id, full_name, airline_email')
            .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (listingResult.error) {
      throw listingResult.error;
    }

    if (reporterResult.error) {
      throw reporterResult.error;
    }

    const listingsById = new Map((listingResult.data || []).map((listing: any) => [listing.id, listing]));
    const reportersById = new Map((reporterResult.data || []).map((reporter: any) => [reporter.id, reporter]));

    return reports.map((row: any): MarketplaceReportQueueItem => {
      const listing = listingsById.get(row.listing_id);
      const reporter = reportersById.get(row.reporter_id);

      return {
        id: row.id,
        listingId: row.listing_id,
        reporterId: row.reporter_id,
        reason: row.reason,
        notes: row.notes || undefined,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at || undefined,
        listingTitle: listing?.title || undefined,
        listingAirport: listing?.airport_code || undefined,
        listingHostId: listing?.host_id || undefined,
        listingHostName: listing?.profiles?.full_name || undefined,
        reporterName: reporter?.full_name || undefined,
        reporterEmail: reporter?.airline_email || undefined,
      };
    });
  },

  async updateMarketplaceReportStatus(reportId: string, status: MarketplaceReportStatus) {
    const { error } = await supabase
      .from('marketplace_listing_reports')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (error) {
      throw error;
    }
  },
};
