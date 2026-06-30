import { ChatRoom } from '../types/chat';
import { supabase } from '../lib/supabase';
import { getSignedInUserId, shouldFallbackToLocalPersistence } from './RemotePersistenceSupport';
import { UserScopedStorage } from './UserScopedStorage';

const STORAGE_KEY = 'yofly.chat.custom-rooms';

const readRooms = async (): Promise<ChatRoom[]> => {
  try {
    const raw = await UserScopedStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as ChatRoom[];
  } catch (error) {
    console.warn('Failed to load custom chat rooms:', error);
    return [];
  }
};

const writeRooms = async (rooms: ChatRoom[]) => {
  try {
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch (error) {
    console.warn('Failed to persist custom chat rooms:', error);
  }
};

const mergeRooms = (primary: ChatRoom[], secondary: ChatRoom[]) => {
  const roomMap = new Map<string, ChatRoom>();

  [...primary, ...secondary].forEach((room) => {
    const existing = roomMap.get(room.id);
    if (!existing) {
      roomMap.set(room.id, room);
      return;
    }

    roomMap.set(room.id, {
      ...existing,
      ...room,
      memberCount: Math.max(existing.memberCount || 0, room.memberCount || 0),
      lastActivity:
        new Date(room.lastActivity || 0).getTime() >= new Date(existing.lastActivity || 0).getTime()
          ? room.lastActivity
          : existing.lastActivity,
    });
  });

  return [...roomMap.values()].sort(
    (left, right) =>
      new Date(right.lastActivity || 0).getTime() - new Date(left.lastActivity || 0).getTime()
  );
};

export const ChatRoomDirectoryService = {
  async getCustomRooms() {
    const userId = await getSignedInUserId();

    if (!userId) {
      return readRooms();
    }

    try {
      const localRooms = await readRooms();
      const { data, error } = await supabase
        .from('crew_custom_rooms')
        .select('id, room_name, airport_code, member_count, created_at, updated_at')
        .eq('created_by', userId)
        .order('updated_at', { ascending: false })
        .limit(12);

      if (error) {
        throw error;
      }

      const rooms: ChatRoom[] = (data || []).map((row) => ({
        id: row.id as string,
        name: row.room_name as string,
        city: row.airport_code as string,
        memberCount: Number(row.member_count || 1),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastMessage: 'Room created. Start the conversation.',
        unreadCount: 0,
        lastActivity: (row.updated_at as string) || (row.created_at as string),
        roomType: 'custom',
        subtitle: 'Custom crew room',
      }));

      if (localRooms.length > 0) {
        const { error: syncError } = await supabase.from('crew_custom_rooms').upsert(
          localRooms.map((room) => ({
            id: room.id,
            created_by: userId,
            room_name: room.name,
            airport_code: room.city,
            member_count: room.memberCount,
            created_at: room.lastActivity || room.expiresAt,
            updated_at: room.lastActivity || room.expiresAt,
          })),
          { onConflict: 'id' }
        );

        if (syncError && !shouldFallbackToLocalPersistence(syncError)) {
          console.warn('Failed to sync local custom crew rooms to remote:', syncError);
        }
      }

      const mergedRooms = mergeRooms(rooms, localRooms).slice(0, 12);
      await writeRooms(mergedRooms);
      return mergedRooms;
    } catch (error) {
      if (!shouldFallbackToLocalPersistence(error)) {
        console.warn('Failed to load remote custom crew rooms:', error);
      }
      return readRooms();
    }
  },

  async createRoom(params: { name: string; city: string }) {
    const airportCode = params.city.trim().toUpperCase();
    const roomId = `custom:${airportCode}:${Date.now()}`;
    const room: ChatRoom = {
      id: roomId,
      name: params.name.trim(),
      city: airportCode,
      memberCount: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastMessage: 'Room created. Start the conversation.',
      unreadCount: 0,
      lastActivity: new Date().toISOString(),
      roomType: 'custom',
      subtitle: 'Custom crew room',
    };

    const current = await readRooms();
    const next = [room, ...current].slice(0, 12);
    await writeRooms(next);

    const userId = await getSignedInUserId();
    if (userId) {
      try {
        const { error } = await supabase.from('crew_custom_rooms').upsert({
          id: room.id,
          created_by: userId,
          room_name: room.name,
          airport_code: room.city,
          member_count: room.memberCount,
          created_at: room.lastActivity,
          updated_at: room.lastActivity,
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to persist remote custom crew room:', error);
        }
      }
    }

    return room;
  },
};
