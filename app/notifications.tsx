import React, { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppTheme, useTheme } from '../src/theme/theme';
import { useAuth } from '../src/context/AuthContext';
import { useProfile } from '../src/context/ProfileContext';
import { NotificationInboxService } from '../src/services/NotificationInboxService';
import { ChatService } from '../src/services/ChatService';
import { OpsDigestItem, OpsInboxItem } from '../src/types/notifications';
import { formatDistanceToNow, isThisWeek, isToday, isYesterday } from 'date-fns';

type NotificationRow =
  | ({ kind: 'inbox' } & OpsInboxItem)
  | {
      kind: 'digest';
      id: string;
      title: string;
      message: string;
      createdAt: string;
      isRead: boolean;
      airportCode?: string;
    };

type DisplayNotificationRow = NotificationRow & {
  sourceIds?: string[];
};

type NotificationFilter = 'ALL' | 'UNREAD' | 'ALERTS' | 'DIGESTS' | 'CHATS';

type NotificationSection = {
  title: string;
  data: DisplayNotificationRow[];
};

const iconForItem = (item: NotificationRow) => {
  if (item.kind === 'digest') return 'newspaper';
  if (item.metadata?.roomId) return 'chatbubble-ellipses';
  if (item.metadata?.listingId) return 'cart';
  if (item.category === 'OPS_ALERT') return 'warning';
  if (item.category === 'DIGEST') return 'newspaper';
  return 'notifications';
};

const resolveNotificationRoute = (item: NotificationRow) => {
  const metadata = item.kind === 'inbox' ? item.metadata : undefined;

  if (metadata?.postId) {
    return { pathname: `/post/${metadata.postId}` as const };
  }

  if (metadata?.roomId) {
    return {
      pathname: '/chat/[roomId]' as const,
      params: {
        roomId: metadata.roomId,
        name: metadata.roomName || item.title,
        city: metadata.airportCode || item.airportCode || '',
        memberCount: String(metadata.memberCount || 2),
      },
    };
  }

  if (metadata?.listingId) {
    return {
      pathname: '/listing/[id]' as const,
      params: { id: metadata.listingId },
    };
  }

  if (metadata?.route && metadata.route.startsWith('/')) {
    return metadata.route as '/(tabs)' | '/(tabs)/alerts' | '/community' | '/marketplace' | '/dashboard' | '/notifications';
  }

  if (metadata?.screen) {
    const screenMap: Record<string, string> = {
      alerts: '/(tabs)/alerts',
      dashboard: '/dashboard',
      community: '/community',
      marketplace: '/marketplace',
      notifications: '/notifications',
      home: '/(tabs)',
    };

    return screenMap[metadata.screen] || null;
  }

  return null;
};

const getSectionTitle = (createdAt: string) => {
  const date = new Date(createdAt);

  if (isToday(date)) {
    return 'Today';
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return 'Earlier This Week';
  }

  return 'Older';
};

const getListingIdFromRoomId = (roomId: string) => {
  const match = roomId.match(/^listing:([^:]+):/);
  return match?.[1];
};

const collapseNotificationThreads = (rows: NotificationRow[]): DisplayNotificationRow[] => {
  const collapsedRows = new Map<string, DisplayNotificationRow>();
  const passthroughRows: DisplayNotificationRow[] = [];

  rows.forEach((row) => {
    const roomId = row.kind === 'inbox' ? row.metadata?.roomId : undefined;

    if (!roomId) {
      passthroughRows.push(row);
      return;
    }

    const key = `room:${roomId}`;
    const current = collapsedRows.get(key);
    const isNewer =
      !current ||
      new Date(row.createdAt).getTime() > new Date(current.createdAt).getTime();
    const sourceIds = [
      ...(current?.sourceIds || []),
      ...(row.id.startsWith('chat-room-') ? [] : [row.id]),
    ];

    collapsedRows.set(key, {
      ...(isNewer ? row : current!),
      id: key,
      isRead: Boolean(current?.isRead ?? true) && row.isRead,
      sourceIds,
    });
  });

  return [...collapsedRows.values(), ...passthroughRows].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

const getMessageParts = (message: string) => {
  const separatorIndex = message.indexOf(':');

  if (separatorIndex <= 0) {
    return { sender: '', body: message };
  }

  return {
    sender: message.slice(0, separatorIndex),
    body: message.slice(separatorIndex + 1).trim(),
  };
};

const getNotificationTypeLabel = (item: NotificationRow) => {
  if (item.kind === 'digest' || item.category === 'DIGEST') {
    return 'Digest';
  }

  if (item.metadata?.listingId) {
    return 'Marketplace';
  }

  if (item.metadata?.roomId) {
    return 'Chat';
  }

  if (item.category === 'OPS_ALERT') {
    return 'Ops';
  }

  return 'System';
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile, mergeProfile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('ALL');

  const loadNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const [inbox, digests, chatRooms] = await Promise.all([
      NotificationInboxService.getInbox(user.id),
      NotificationInboxService.getDigests(user.id),
      ChatService.getRoomIndex(user.id, {
        baseAirport: profile.baseAirport,
        favoriteAirports: profile.preferences.favoriteAirports,
      }),
    ]);

    const inboxDigestKeys = new Set(
      inbox
        .filter((item) => item.category === 'DIGEST')
        .map((item) => `${item.title}-${item.airportCode || ''}`)
    );

    const inboxRoomIds = new Set(
      inbox
        .map((item) => item.metadata?.roomId)
        .filter((roomId): roomId is string => typeof roomId === 'string')
    );
    const chatRows: NotificationRow[] = chatRooms
      .filter((room) => typeof room.id === 'string' && !inboxRoomIds.has(room.id))
      .filter((room) => room.roomType === 'listing' || room.id.startsWith('listing:'))
      .map((room) => ({
        kind: 'inbox' as const,
        id: `chat-room-${room.id}`,
        category: 'CHAT' as const,
        title: room.name,
        message: room.lastMessage || room.subtitle || 'Open Marketplace conversation',
        createdAt: room.lastActivity || new Date().toISOString(),
        isRead: true,
        airportCode: room.city,
        metadata: {
          roomId: room.id,
          roomName: room.name,
          listingId: getListingIdFromRoomId(room.id),
          airportCode: room.city,
          memberCount: room.memberCount || 2,
          screen: 'marketplace',
        },
      }));

    const rows: NotificationRow[] = [
      ...inbox.map((item) => ({ ...item, kind: 'inbox' as const })),
      ...chatRows,
      ...digests.map((item: OpsDigestItem) => ({
        kind: 'digest' as const,
        id: item.id,
        title: item.title,
        message: item.summary,
        createdAt: item.createdAt,
        airportCode: item.airportCode,
        isRead: true,
      })).filter((item) => !inboxDigestKeys.has(`${item.title}-${item.airportCode || ''}`)),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    setNotifications(rows);
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadNotifications();
    }, [profile.baseAirport, profile.preferences.favoriteAirports, user?.id])
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const subscription = NotificationInboxService.subscribeToInbox(user.id, (item) => {
      setNotifications((current) => {
        if (current.some((existing) => existing.id === item.id)) {
          return current;
        }

        return [{ ...item, kind: 'inbox' as const }, ...current];
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const displayNotifications = useMemo(
    () => collapseNotificationThreads(notifications),
    [notifications]
  );
  const unreadCount = displayNotifications.filter((item) => !item.isRead).length;
  const filteredNotifications = displayNotifications.filter((item) => {
    if (filter === 'UNREAD') return !item.isRead;
    if (filter === 'DIGESTS') return item.kind === 'digest' || item.category === 'DIGEST';
    if (filter === 'CHATS') return item.kind === 'inbox' && typeof item.metadata?.roomId === 'string';
    if (filter === 'ALERTS') {
      return item.kind === 'inbox' && item.category === 'OPS_ALERT';
    }

    return true;
  });
  const filterChips: Array<{ id: NotificationFilter; label: string }> = [
    { id: 'ALL', label: 'All' },
    { id: 'UNREAD', label: `Unread ${unreadCount > 0 ? unreadCount : ''}`.trim() },
    { id: 'ALERTS', label: 'Alerts' },
    { id: 'DIGESTS', label: 'Digests' },
    { id: 'CHATS', label: 'Chats' },
  ];
  const notificationPreferenceSummary = [
    { label: 'Intel', active: profile.preferences.intelPush },
    { label: 'Ops', active: profile.preferences.opsPush },
    { label: 'Digest', active: profile.preferences.dailyDigest },
    { label: 'Chat', active: profile.preferences.layoverChat },
  ];
  const sections = useMemo<NotificationSection[]>(() => {
    const grouped = new Map<string, NotificationRow[]>();

    filteredNotifications.forEach((item) => {
      const title = getSectionTitle(item.createdAt);
      grouped.set(title, [...(grouped.get(title) || []), item]);
    });

    return ['Today', 'Yesterday', 'Earlier This Week', 'Older']
      .map((title) => ({
        title,
        data: grouped.get(title) || [],
      }))
      .filter((section) => section.data.length > 0);
  }, [filteredNotifications]);
  const emptyCopy =
    filter === 'CHATS'
      ? 'No Marketplace or crew chat notifications yet.'
      : filter === 'ALERTS'
        ? 'No ops alerts yet.'
        : filter === 'DIGESTS'
          ? 'No digests yet.'
          : 'No notifications yet. Marketplace messages, crew alerts, and digests will appear here.';

  const handleNotificationPress = async (item: DisplayNotificationRow) => {
    if (item.kind === 'inbox' && !item.isRead) {
      try {
        const sourceIds = item.sourceIds?.length
          ? item.sourceIds
          : item.id.startsWith('chat-room-') || item.id.startsWith('room:')
            ? []
            : [item.id];

        await Promise.all(sourceIds.map((id) => NotificationInboxService.markAsRead(id)));
      } catch (error) {
        console.warn('Failed to mark notification as read:', error);
      }

      setNotifications((current) =>
        current.map((entry) =>
          entry.id === item.id || item.sourceIds?.includes(entry.id)
            ? { ...entry, isRead: true }
            : entry
        )
      );
    }

    if (item.airportCode) {
      mergeProfile({
        preferences: {
          opsContextMode: 'MANUAL',
          activeOpsAirport: item.airportCode,
        },
      });
    }

    const route = resolveNotificationRoute(item);
    if (route) {
      router.push(route as never);
      return;
    }

    if (item.kind === 'digest' || item.category === 'DIGEST') {
      router.push('/(tabs)/alerts');
      return;
    }

    if (item.kind === 'inbox' && item.category === 'OPS_ALERT') {
      router.push('/(tabs)/alerts');
      return;
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) {
      return;
    }

    try {
      await NotificationInboxService.markAllAsRead(user.id);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error);
    }
  };

  const handleMarkRead = async (item: DisplayNotificationRow) => {
    if (item.kind !== 'inbox' || item.isRead) {
      return;
    }

    try {
      const sourceIds = item.sourceIds?.length
        ? item.sourceIds
        : item.id.startsWith('chat-room-') || item.id.startsWith('room:')
          ? []
          : [item.id];

      await Promise.all(sourceIds.map((id) => NotificationInboxService.markAsRead(id)));
      setNotifications((current) =>
        current.map((entry) =>
          entry.id === item.id || item.sourceIds?.includes(entry.id)
            ? { ...entry, isRead: true }
            : entry
        )
      );
    } catch (error) {
      console.warn('Failed to mark notification as read:', error);
    }
  };

  const handleBack = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerMeta}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
          disabled={unreadCount === 0}
        >
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.filtersWrap}>
              {filterChips.map((chip) => {
                const active = chip.id === filter;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(chip.id)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.preferencesCard} onPress={() => router.push('/settings')}>
              <View style={styles.preferencesHeader}>
                <View>
                  <Text style={styles.preferencesTitle}>Notification preferences</Text>
                  <Text style={styles.preferencesHint}>Tune what reaches your inbox and push layer.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </View>
              <View style={styles.preferenceChipRow}>
                {notificationPreferenceSummary.map((item) => (
                  <View
                    key={item.label}
                    style={[styles.preferenceChip, item.active && styles.preferenceChipActive]}
                  >
                    <Text
                      style={[styles.preferenceChipText, item.active && styles.preferenceChipTextActive]}
                    >
                      {item.label} {item.active ? 'On' : 'Off'}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const messageParts = getMessageParts(item.message);

          return (
            <TouchableOpacity
              style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
              onPress={() => void handleNotificationPress(item)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: (item.kind === 'digest' ? theme.colors.accent : theme.colors.primary) + '20' },
                ]}
              >
                <Ionicons
                  name={iconForItem(item) as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={item.kind === 'digest' ? theme.colors.accent : theme.colors.primary}
              />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !item.isRead && styles.unreadText]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{getNotificationTypeLabel(item)}</Text>
                </View>
              </View>
              <Text style={styles.message} numberOfLines={2}>
                  {messageParts.sender ? (
                    <>
                      <Text style={styles.messageSender}>{messageParts.sender}</Text>
                      <Text>{`: ${messageParts.body}`}</Text>
                    </>
                  ) : (
                    item.message
                  )}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.time}>
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    {item.airportCode ? ` • ${item.airportCode}` : ''}
                  </Text>
                  {item.kind === 'inbox' && !item.isRead ? (
                    <TouchableOpacity
                      onPress={() => void handleMarkRead(item)}
                      style={styles.inlineAction}
                    >
                      <Text style={styles.inlineActionText}>Mark read</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyCopy}</Text>}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { padding: 8, marginLeft: -8, width: 40 },
    headerTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' },
    headerCopy: {
      flex: 1,
      marginLeft: 12,
    },
    headerMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    markAllBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    markAllBtnDisabled: {
      opacity: 0.45,
    },
    markAllText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    listContent: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
    headerStack: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    filtersWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    preferencesCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    preferencesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: theme.spacing.sm,
    },
    preferencesTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    preferencesHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    preferenceChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    preferenceChip: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    preferenceChipActive: {
      backgroundColor: theme.colors.primary + '16',
      borderColor: theme.colors.primary + '44',
    },
    preferenceChipText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    preferenceChipTextActive: {
      color: theme.colors.text,
    },
    filterChip: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    filterChipTextActive: {
      color: theme.colors.background,
    },
    sectionHeader: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 4,
    },
    notificationCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unreadCard: {
      borderColor: theme.colors.primary + '50',
      backgroundColor: theme.colors.primary + '10',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: { flex: 1 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    title: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    typeChip: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '44',
      backgroundColor: theme.colors.accent + '14',
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 0,
    },
    typeChipText: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    unreadText: { fontWeight: 'bold' },
    message: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    messageSender: {
      color: theme.colors.accent,
      fontWeight: '900',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    time: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '500', flex: 1 },
    inlineAction: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    inlineActionText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginTop: 8,
    },
    emptyText: {
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: theme.spacing.lg,
    },
  });
