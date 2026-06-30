import { supabase } from '../lib/supabase';

const MANUAL_REVIEW_BUCKET = 'manual-review-badges';

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-');

export const ManualReviewService = {
  async uploadBadgePhoto(userId: string, uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${userId}/${Date.now()}-${sanitizeFileName(uri.split('/').pop() || 'badge.jpg')}`;

    const { error } = await supabase.storage.from(MANUAL_REVIEW_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return path;
  },

  async submitRequest(params: {
    profileId: string;
    workEmail: string;
    claimedAirline: string;
    employeeIdLast4?: string;
    badgeImagePath?: string;
  }) {
    const { error } = await supabase.from('manual_review_requests').insert({
      profile_id: params.profileId,
      work_email: params.workEmail || null,
      claimed_airline: params.claimedAirline,
      employee_id_last4: params.employeeIdLast4 || null,
      badge_image_url: params.badgeImagePath || null,
      status: 'PENDING',
    });

    if (error) {
      throw error;
    }
  },
};
