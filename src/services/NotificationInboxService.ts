import { supabase } from '../lib/supabase';
import { NotificationMetadata, OpsDigestItem, OpsInboxItem } from '../types/notifications';

type InboxRow = {
  id: string;
  category: OpsInboxItem['category'];
  title: string;
  message: string;
  metadata: NotificationMetadata | null;
  is_read: boolean;
  created_at: string;
};

const normalizeMetadata = (metadata: InboxRow['metadata']): NotificationMetadata | undefined => {
  if (!metadata) {
    return undefined;
  }

  return {
    airportCode: typeof metadata.airportCode === 'string' ? metadata.airportCode : undefined,
    postId: typeof metadata.postId === 'string' ? metadata.postId : undefined,
    listingId: typeof metadata.listingId === 'string' ? metadata.listingId : undefined,
    roomId: typeof metadata.roomId === 'string' ? metadata.roomId : undefined,
    roomName: typeof metadata.roomName === 'string' ? metadata.roomName : undefined,
    memberCount: typeof metadata.memberCount === 'number' ? metadata.memberCount : undefined,
    screen: typeof metadata.screen === 'string' ? metadata.screen : undefined,
    route: typeof metadata.route === 'string' ? metadata.route : undefined,
    alertId: typeof metadata.alertId === 'string' ? metadata.alertId : undefined,
  };
};

type DigestRow = {
  id: string;
  digest_type: string;
  airport_code: string;
  title: string;
  summary: string;
  created_at: string;
};

type MarketplaceChatNotificationInput = {
  recipientUserId: string;
  roomId: string;
  listingId: string;
  roomName: string;
  airportCode?: string;
  senderName: string;
  message: string;
};

export const NotificationInboxService = {
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('ops_notification_inbox')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.warn('Failed to load unread notification count:', error);
      return 0;
    }

    return count || 0;
  },

  async getInbox(userId: string): Promise<OpsInboxItem[]> {
    const { data, error } = await supabase
      .from('ops_notification_inbox')
      .select('id, category, title, message, metadata, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      console.warn('Failed to load ops notification inbox:', error);
      return [];
    }

    return ((data || []) as InboxRow[]).map((row) => {
      const metadata = normalizeMetadata(row.metadata);

      return {
        id: row.id,
        category: row.category,
        title: row.title,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        metadata,
        airportCode: metadata?.airportCode,
      };
    });
  },

  async getDigests(userId: string): Promise<OpsDigestItem[]> {
    const { data, error } = await supabase
      .from('ops_digests')
      .select('id, digest_type, airport_code, title, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('Failed to load ops digests:', error);
      return [];
    }

    return ((data || []) as DigestRow[]).map((row) => ({
      id: row.id,
      digestType: row.digest_type,
      airportCode: row.airport_code,
      title: row.title,
      summary: row.summary,
      createdAt: row.created_at,
    }));
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('ops_notification_inbox')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      throw error;
    }
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('ops_notification_inbox')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw error;
    }
  },

  async markRoomAsRead(userId: string, roomId: string) {
    const inbox = await this.getInbox(userId);
    const unreadRoomItems = inbox.filter(
      (item) => !item.isRead && item.metadata?.roomId === roomId
    );

    if (unreadRoomItems.length === 0) {
      return;
    }

    await Promise.all(unreadRoomItems.map((item) => this.markAsRead(item.id)));
  },

  async notifyMarketplaceMessage(input: MarketplaceChatNotificationInput) {
    const preview = input.message.trim() || 'Photo shared';
    const { error } = await supabase.from('ops_notification_inbox').insert({
      user_id: input.recipientUserId,
      category: 'CHAT',
      title: input.roomName || 'Marketplace message',
      message: `${input.senderName}: ${preview}`,
      metadata: {
        roomId: input.roomId,
        roomName: input.roomName,
        listingId: input.listingId,
        airportCode: input.airportCode,
        memberCount: 2,
        screen: 'marketplace',
      },
      is_read: false,
    });

    if (error) {
      throw error;
    }
  },

  subscribeToInbox(userId: string, onNotification: (item: OpsInboxItem) => void) {
    const loadNotificationById = async (notificationId: string) => {
      const { data, error } = await supabase
        .from('ops_notification_inbox')
        .select('id, category, title, message, metadata, is_read, created_at')
        .eq('id', notificationId)
        .maybeSingle();

      if (error || !data) {
        return;
      }

      const row = data as InboxRow;
      const metadata = normalizeMetadata(row.metadata);
      onNotification({
        id: row.id,
        category: row.category,
        title: row.title,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        metadata,
        airportCode: metadata?.airportCode,
      });
    };

    return supabase
      .channel(`ops-inbox-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ops_notification_inbox',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          await loadNotificationById(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ops_notification_inbox',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          await loadNotificationById(payload.new.id);
        }
      )
      .subscribe();
  },
};
