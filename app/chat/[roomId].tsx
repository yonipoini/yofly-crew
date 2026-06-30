import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatRoomScreen } from '../../src/screens/ChatRoomScreen';
import { ChatRoom } from '../../src/types/chat';

export default function ChatRoomRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    roomId: string;
    name?: string;
    city?: string;
    memberCount?: string;
  }>();

  const room: ChatRoom = {
    id: params.roomId,
    name: params.name || 'Crew Chat',
    city: params.city || '',
    memberCount: Number(params.memberCount || '2'),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const handleClose = () => {
    if (params.roomId.startsWith('listing:')) {
      const listingId = params.roomId.split(':')[1];
      router.replace(listingId ? `/listing/${listingId}` : '/marketplace');
      return;
    }

    router.replace('/community');
  };

  return <ChatRoomScreen room={room} onClose={handleClose} />;
}
