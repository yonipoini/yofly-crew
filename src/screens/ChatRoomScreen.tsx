import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppTheme, useTheme } from '../theme/theme';
import { ChatRoom, Message } from '../types/chat';
import { MessageBubble } from '../components/MessageBubble';
import { ChatService } from '../services/ChatService';
import { useAuth } from '../context/AuthContext';
import { NotificationInboxService } from '../services/NotificationInboxService';
import { ChatReactionService } from '../services/ChatReactionService';

interface ChatRoomScreenProps {
  room: ChatRoom;
  onClose: () => void;
}

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ room, onClose }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      const data = await ChatService.getMessages(room.id);
      const nextMessages = user?.id
        ? await Promise.all(
            data.map(async (message) => ({
              ...message,
              reactions: await ChatReactionService.getReactions(message.id, user.id),
            }))
          )
        : data;

      if (active) {
        setMessages(nextMessages);
      }
    };

    void loadMessages();
    if (user?.id) {
      void NotificationInboxService.markRoomAsRead(user.id, room.id);
    }

    const subscription = ChatService.subscribeToRoom(room.id, async (message) => {
      if (!active) {
        return;
      }

      const nextMessage = user?.id
        ? {
            ...message,
            reactions: await ChatReactionService.getReactions(message.id, user.id),
          }
        : message;

      setMessages((current) => {
        if (current.some((item) => item.id === nextMessage.id)) {
          return current;
        }

        return [...current, nextMessage];
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [room.id, user?.id]);

  const handlePickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo Permission', 'Allow photo access to attach an image in crew chat.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAttachmentUri(result.assets[0].uri);
    }
  };

  const handleReact = async (message: Message, emoji: string) => {
    if (!user?.id) {
      return;
    }

    const reactions = await ChatReactionService.toggleReaction(message.id, emoji, user.id);
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, reactions }
          : item
      )
    );
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && !attachmentUri) || isSendingMessage) {
      return;
    }

    const draftText = inputText.trim();
    const draftAttachmentUri = attachmentUri;

    try {
      setIsSendingMessage(true);
      setChatError(null);
      setInputText('');
      setAttachmentUri(null);
      const sentMessage = await ChatService.sendMessage(room.id, draftText, draftAttachmentUri || undefined);
      const sentMessageWithReactions = user?.id
        ? {
            ...sentMessage,
            reactions: await ChatReactionService.getReactions(sentMessage.id, user.id),
          }
        : sentMessage;

      setMessages((current) => {
        if (current.some((item) => item.id === sentMessageWithReactions.id)) {
          return current;
        }

        return [...current, sentMessageWithReactions];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.';
      setChatError(message);
      setInputText(draftText);
      setAttachmentUri(draftAttachmentUri);
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>{room.memberCount} crew online</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.infoBtn}>
          <Ionicons name="information-circle-outline" size={24} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} onReact={handleReact} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No messages yet. Start the conversation.</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {attachmentUri ? (
          <View style={styles.attachmentPreviewBar}>
            <Image source={{ uri: attachmentUri }} style={styles.attachmentPreviewImage} />
            <View style={styles.attachmentPreviewCopy}>
              <Text style={styles.attachmentPreviewTitle}>Photo ready to send</Text>
              <Text style={styles.attachmentPreviewHint}>This will post with your next message.</Text>
            </View>
            <TouchableOpacity onPress={() => setAttachmentUri(null)} style={styles.attachmentPreviewClose}>
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => void handlePickAttachment()}>
            <Ionicons name="image-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Message crew..."
              placeholderTextColor={theme.colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() && !attachmentUri || isSendingMessage) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={(!inputText.trim() && !attachmentUri) || isSendingMessage}
          >
            <Ionicons name="send" size={20} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    backBtn: {
      padding: 4,
    },
    headerInfo: {
      flex: 1,
      marginLeft: 12,
    },
    roomName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.success,
    },
    statusText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
    },
    infoBtn: {
      padding: 4,
    },
    listContent: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    attachBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    input: {
      color: theme.colors.text,
      fontSize: 16,
      paddingTop: 0,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    sendBtnDisabled: {
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    attachmentPreviewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    attachmentPreviewImage: {
      width: 48,
      height: 48,
      borderRadius: 12,
    },
    attachmentPreviewCopy: {
      flex: 1,
    },
    attachmentPreviewTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    attachmentPreviewHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    attachmentPreviewClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatError: {
      color: theme.colors.error,
      fontSize: 13,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    emptyStateText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
  });
