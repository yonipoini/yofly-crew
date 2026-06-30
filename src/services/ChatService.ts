import { supabase } from '../lib/supabase';
import { ChatRoom, Message } from '../types/chat';
import { CrewAccessService } from './CrewAccessService';
import { NotificationInboxService } from './NotificationInboxService';
import { ChatMediaService } from './ChatMediaService';
import { parseChatMessageContent, serializeChatMessageContent } from '../utils/chatMessageContent';
import { ChatRoomDirectoryService } from './ChatRoomDirectoryService';

type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    role?: string | null;
  } | null;
};

const getFallbackRoomLabel = (roomId: string) => {
  if (roomId.startsWith('crew:')) {
    const airportCode = roomId.split(':')[1] || 'Crew';
    return `${airportCode} Layover Crew`;
  }

  if (roomId.startsWith('listing:')) {
    return 'Listing Host Thread';
  }

  if (roomId.startsWith('custom:')) {
    return 'Custom Crew Room';
  }

  return 'Crew Chat';
};

const getFallbackAirportCode = (roomId: string) => {
  if (roomId.startsWith('crew:')) {
    return roomId.split(':')[1] || '';
  }

  return '';
};

const parseListingRoomId = (roomId: string) => {
  const match = roomId.match(/^listing:([^:]+):buyer:([^:]+):host:([^:]+)$/);
  if (!match) {
    return null;
  }

  return {
    listingId: match[1],
    buyerId: match[2],
    hostId: match[3],
  };
};

const toMessage = async (row: MessageRow, currentUserId?: string | null): Promise<Message> => {
  const parsedContent = parseChatMessageContent(row.content);

  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: row.profiles?.full_name || 'Crew Member',
    senderRole: (row.profiles?.role as any) || 'FA',
    content: parsedContent.text,
    attachmentUrl: await ChatMediaService.resolveAttachmentUrl(parsedContent.attachmentUrl),
    timestamp: row.created_at,
    isMe: row.sender_id === currentUserId,
  };
};

export const ChatService = {
  /**
   * Fetch messages for a specific room
   */
  async getMessages(roomId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(full_name, role)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.warn('Error fetching messages:', error);
      return [];
    }

    const { data: { user } } = await supabase.auth.getUser();

    return Promise.all(((data || []) as MessageRow[]).map((row) => toMessage(row, user?.id)));
  },

  /**
   * Send a new message to a room
   */
  async sendMessage(roomId: string, content: string, attachmentUri?: string): Promise<Message> {
    const user = await CrewAccessService.requireVerifiedCrew();
    const attachmentUrl = attachmentUri
      ? await ChatMediaService.uploadAttachment(user.id, attachmentUri)
      : undefined;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: user.id,
        content: serializeChatMessageContent({
          text: content,
          attachmentUrl,
        }),
      })
      .select('*, profiles(full_name, role)')
      .single();

    if (error) throw error;

    const sentMessage = await toMessage(data as MessageRow, user.id);
    const listingRoom = parseListingRoomId(roomId);

    if (listingRoom) {
      const recipientUserId =
        user.id === listingRoom.buyerId
          ? listingRoom.hostId
          : user.id === listingRoom.hostId
            ? listingRoom.buyerId
            : null;

      if (recipientUserId) {
        void NotificationInboxService.notifyMarketplaceMessage({
          recipientUserId,
          roomId,
          listingId: listingRoom.listingId,
          roomName: getFallbackRoomLabel(roomId),
          senderName: sentMessage.senderName,
          message: sentMessage.content || (sentMessage.attachmentUrl ? 'Photo shared' : 'New message'),
        }).catch((notifyError) => {
          console.warn('Failed to create marketplace chat notification:', notifyError);
        });
      }
    }

    return sentMessage;
  },

  async getRoomIndex(userId: string, profile: { baseAirport: string; favoriteAirports: string[] }): Promise<ChatRoom[]> {
    const [inbox, messageRows, customRooms] = await Promise.all([
      NotificationInboxService.getInbox(userId),
      supabase
        .from('messages')
        .select('room_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(150),
      ChatRoomDirectoryService.getCustomRooms(),
    ]);

    const roomMap = new Map<string, ChatRoom>();

    if (!messageRows.error) {
      (messageRows.data || []).forEach((row) => {
        const existing = roomMap.get(row.room_id);
        const parsedContent = parseChatMessageContent(row.content);

        if (!existing) {
          const roomType = row.room_id.startsWith('listing:')
            ? 'listing'
            : row.room_id.startsWith('custom:')
              ? 'custom'
              : 'airport';
          roomMap.set(row.room_id, {
            id: row.room_id,
            name: getFallbackRoomLabel(row.room_id),
            city: getFallbackAirportCode(row.room_id),
            memberCount: 2,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            lastMessage: parsedContent.text || (parsedContent.attachmentUrl ? 'Photo shared' : 'Open chat'),
            unreadCount: 0,
            lastActivity: row.created_at,
            roomType,
            subtitle:
              roomType === 'listing'
                ? 'Listing conversation'
                : roomType === 'custom'
                  ? 'Custom crew room'
                  : 'Airport crew room',
          });
        }
      });
    }

    inbox
      .filter((item) => typeof item.metadata?.roomId === 'string')
      .forEach((item) => {
        const roomId = item.metadata!.roomId!;
        const current = roomMap.get(roomId);
        const unreadCount = (current?.unreadCount || 0) + (item.isRead ? 0 : 1);
        const roomType = roomId.startsWith('listing:')
          ? 'listing'
          : roomId.startsWith('custom:')
            ? 'custom'
            : 'airport';

        roomMap.set(roomId, {
          id: roomId,
          name: item.metadata?.roomName || current?.name || item.title || getFallbackRoomLabel(roomId),
          city: item.metadata?.airportCode || item.airportCode || current?.city || getFallbackAirportCode(roomId),
          memberCount: item.metadata?.memberCount || current?.memberCount || 2,
          expiresAt: current?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          lastMessage:
            new Date(item.createdAt).getTime() >= new Date(current?.lastActivity || 0).getTime()
              ? item.message
              : current?.lastMessage,
          unreadCount,
          lastActivity:
            new Date(item.createdAt).getTime() >= new Date(current?.lastActivity || 0).getTime()
              ? item.createdAt
              : current?.lastActivity,
          roomType,
          subtitle:
            current?.subtitle ||
            (roomType === 'listing'
              ? 'Listing conversation'
              : roomType === 'custom'
                ? 'Custom crew room'
                : 'Airport crew room'),
        });
      });

    customRooms.forEach((room) => {
      const existing = roomMap.get(room.id);
      roomMap.set(room.id, existing ? { ...room, ...existing, roomType: 'custom', subtitle: 'Custom crew room' } : room);
    });

    Array.from(
      new Set([profile.baseAirport, ...profile.favoriteAirports].filter(Boolean).map((airportCode) => airportCode.toUpperCase()))
    )
      .slice(0, 4)
      .forEach((airportCode) => {
        const roomId = `crew:${airportCode}`;
        const existing = roomMap.get(roomId);

        roomMap.set(roomId, {
          id: roomId,
          name: existing?.name || `${airportCode} Layover Crew`,
          city: airportCode,
          memberCount: existing?.memberCount || (airportCode === profile.baseAirport ? 12 : 6),
          expiresAt: existing?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          lastMessage: existing?.lastMessage || 'Swap pickup, meal, and gate intel with nearby crew.',
          unreadCount: existing?.unreadCount || 0,
          lastActivity: existing?.lastActivity || new Date().toISOString(),
          roomType: 'airport',
          subtitle: existing?.subtitle || 'Airport crew room',
        });
      });

    return [...roomMap.values()].sort(
      (left, right) =>
        new Date(right.lastActivity || 0).getTime() - new Date(left.lastActivity || 0).getTime()
    );
  },

  /**
   * Real-time subscription to room messages
   */
  subscribeToRoom(roomId: string, onMessage: (msg: Message) => void) {
    return supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, profiles(full_name, role)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const { data: authData } = await supabase.auth.getUser();
            onMessage(await toMessage(data as MessageRow, authData.user?.id));
          }
        }
      )
      .subscribe();
  }
};
