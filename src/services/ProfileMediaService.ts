import { supabase } from '../lib/supabase';

const PROFILE_MEDIA_BUCKET = 'listing-images';

export const ProfileMediaService = {
  async uploadAvatar(userId: string, uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `avatars/${userId}/${Date.now()}-${(uri.split('/').pop() || 'avatar.jpg').replace(/[^a-zA-Z0-9._-]/g, '-')}`;

    const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    return path;
  },

  async resolveAvatarUrl(value?: string | null) {
    if (!value) {
      return undefined;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const { data, error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(value, 60 * 60);

    if (error) {
      console.warn('Failed to create signed URL for avatar:', error);
      return undefined;
    }

    return data.signedUrl;
  },
};
