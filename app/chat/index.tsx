import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { ChatRoom } from '../../src/types/chat';
import { ChatService } from '../../src/services/ChatService';
import { NotificationInboxService } from '../../src/services/NotificationInboxService';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { ChatCreateRoomModal } from '../../src/components/ChatCreateRoomModal';
import { ChatRoomDirectoryService } from '../../src/services/ChatRoomDirectoryService';
import { AppSyncService } from '../../src/services/AppSyncService';

export default function ChatIndexScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!user?.id) {
      setRooms([]);
      return;
    }

    const nextRooms = await ChatService.getRoomIndex(user.id, {
      baseAirport: profile.baseAirport,
      favoriteAirports: profile.preferences.favoriteAirports,
    });
    setRooms(nextRooms);
  }, [profile.baseAirport, profile.preferences.favoriteAirports, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadRooms();
    }, [loadRooms])
  );

  React.useEffect(() => {
    if (!user?.id) {
      return;
    }

    const inboxSubscription = NotificationInboxService.subscribeToInbox(user.id, () => {
      void loadRooms();
    });
    const syncSubscription = AppSyncService.subscribe((event) => {
      if (event === 'community' || event === 'marketplace' || event === 'profile') {
        void loadRooms();
      }
    });

    return () => {
      inboxSubscription.unsubscribe();
      syncSubscription();
    };
  }, [loadRooms, user?.id]);

  const handleOpenRoom = async (room: ChatRoom) => {
    if (user?.id) {
      await NotificationInboxService.markRoomAsRead(user.id, room.id);
    }

    router.push({
      pathname: '/chat/[roomId]',
      params: {
        roomId: room.id,
        name: room.name,
        city: room.city,
        memberCount: String(room.memberCount),
      },
    });
  };

  const handleCreateRoom = async (payload: { name: string; city: string }) => {
    try {
      const room = await ChatRoomDirectoryService.createRoom(payload);
      setIsCreateModalVisible(false);
      void loadRooms();
      router.push({
        pathname: '/chat/[roomId]',
        params: {
          roomId: room.id,
          name: room.name,
          city: room.city,
          memberCount: String(room.memberCount),
        },
      });
    } catch (error) {
      console.warn('Failed to create custom crew room:', error);
      const message = error instanceof Error ? error.message : 'Unable to create the room right now.';
      Alert.alert('Room Not Created', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Crew Rooms</Text>
          <Text style={styles.subtitle}>Airport-based chat rooms and live crew conversations</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => setIsCreateModalVisible(true)}>
          <Ionicons name="add" size={18} color={theme.colors.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.roomCard} onPress={() => void handleOpenRoom(item)}>
            <View style={styles.roomTop}>
              <View style={[styles.airportBadge, item.roomType === 'listing' && styles.airportBadgeListing]}>
                <Text style={styles.airportBadgeText}>
                  {item.roomType === 'listing' ? 'HOST' : item.city || 'CREW'}
                </Text>
              </View>
              {item.unreadCount ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.roomName}>{item.name}</Text>
            {item.subtitle ? <Text style={styles.roomSubtitle}>{item.subtitle}</Text> : null}
            {item.roomType !== 'airport' && item.city ? <Text style={styles.roomAirportMeta}>{item.city} hub</Text> : null}
            <Text style={styles.roomMessage} numberOfLines={2}>
              {item.lastMessage || 'Open room'}
            </Text>
            <View style={styles.roomFooter}>
              <Text style={styles.roomMeta}>{item.memberCount} crew</Text>
              <Text style={styles.roomMeta}>
                {item.lastActivity ? new Date(item.lastActivity).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Now'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={54} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No crew rooms yet</Text>
            <Text style={styles.emptyBody}>Rooms will appear here as airport and listing conversations start flowing.</Text>
          </View>
        }
      />

      <ChatCreateRoomModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateRoom}
        favoriteAirports={profile.preferences.favoriteAirports}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerCopy: {
      flex: 1,
    },
    createButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 4,
    },
    content: {
      padding: theme.spacing.md,
      paddingBottom: 100,
    },
    roomCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    roomTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    airportBadge: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    airportBadgeListing: {
      backgroundColor: theme.colors.accent,
    },
    airportBadgeText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    unreadBadgeText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    roomName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    roomSubtitle: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    roomAirportMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    roomMessage: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 10,
    },
    roomFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    roomMeta: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 12,
    },
    emptyBody: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      textAlign: 'center',
    },
  });
