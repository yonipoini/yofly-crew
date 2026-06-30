import { supabase } from '../lib/supabase';

const CHAT_MEDIA_BUCKET = 'listing-images';

export const ChatMediaService = {
  async uploadAttachment(userId: string, uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const sanitizedName = (uri.split('/').pop() || 'chat-image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `chat-attachments/${userId}/${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    return path;
  },

  async resolveAttachmentUrl(value?: string | null) {
    if (!value) {
      return undefined;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(value, 60 * 60);

    if (error) {
      console.warn('Failed to create signed URL for chat attachment:', error);
      return undefined;
    }

    return data.signedUrl;
  },
};
