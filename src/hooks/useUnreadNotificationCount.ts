import React from 'react';
import { NotificationInboxService } from '../services/NotificationInboxService';
import { NotificationService } from '../services/NotificationService';

export const useUnreadNotificationCount = (userId?: string | null) => {
  const [unreadCount, setUnreadCount] = React.useState(0);

  const refreshUnreadCount = React.useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const nextCount = await NotificationInboxService.getUnreadCount(userId);
    setUnreadCount(nextCount);
  }, [userId]);

  React.useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  React.useEffect(() => {
    void NotificationService.syncBadgeCount(unreadCount);
  }, [unreadCount]);

  React.useEffect(() => {
    if (!userId) {
      return;
    }

    const subscription = NotificationInboxService.subscribeToInbox(userId, () => {
      void refreshUnreadCount();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUnreadCount, userId]);

  return {
    unreadCount,
    refreshUnreadCount,
  };
};
