export interface MessageReaction {
  emoji: string;
  count: number;
  isMine: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'PILOT' | 'FA' | 'DISPATCH';
  content: string;
  attachmentUrl?: string;
  reactions?: MessageReaction[];
  timestamp: string; // ISO string
  isMe: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  expiresAt: string; // ISO string
  lastMessage?: string;
  unreadCount?: number;
  lastActivity?: string;
  roomType?: 'airport' | 'listing' | 'custom';
  subtitle?: string;
}
