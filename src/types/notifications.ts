export type OpsNotificationCategory = 'OPS_ALERT' | 'DIGEST' | 'SYSTEM' | 'CHAT';

export interface NotificationMetadata {
  airportCode?: string;
  postId?: string;
  listingId?: string;
  roomId?: string;
  roomName?: string;
  memberCount?: number;
  screen?: string;
  route?: string;
  alertId?: string;
}

export interface OpsInboxItem {
  id: string;
  category: OpsNotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  airportCode?: string;
  metadata?: NotificationMetadata;
}

export interface OpsDigestItem {
  id: string;
  digestType: string;
  airportCode: string;
  title: string;
  summary: string;
  createdAt: string;
}
