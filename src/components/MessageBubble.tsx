import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme, useTheme } from '../theme/theme';
import { Message } from '../types/chat';

interface MessageBubbleProps {
  message: Message;
  onReact?: (message: Message, emoji: string) => void;
  onLongPress?: (message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onReact, onLongPress }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, message.isMe ? styles.mine : styles.theirs]}>
      {!message.isMe && (
        <Text style={styles.authorName}>
          {message.senderName} • {message.senderRole}
        </Text>
      )}
      <TouchableOpacity 
        style={[styles.bubble, message.isMe ? styles.bubbleMine : styles.bubbleTheirs]}
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        activeOpacity={0.8}
      >
        {message.attachmentUrl ? (
          <Image source={{ uri: message.attachmentUrl }} style={styles.attachmentImage} />
        ) : null}
        {message.content ? (
          <Text style={[styles.content, message.isMe ? styles.contentMine : styles.contentTheirs]}>
            {message.content}
          </Text>
        ) : null}
      </TouchableOpacity>
      <View style={[styles.reactionRow, message.isMe ? styles.reactionRowMine : styles.reactionRowTheirs]}>
        {['👍', '🔥', '🛫'].map((emoji) => {
          const reaction = message.reactions?.find((item) => item.emoji === emoji);
          return (
            <TouchableOpacity
              key={emoji}
              style={[styles.reactionChip, reaction?.isMine && styles.reactionChipActive]}
              onPress={() => onReact?.(message, emoji)}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {reaction?.count ? <Text style={styles.reactionCount}>{reaction.count}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.timestamp, message.isMe ? styles.timestampMine : styles.timestampTheirs]}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
      maxWidth: '80%',
    },
    mine: {
      alignSelf: 'flex-end',
    },
    theirs: {
      alignSelf: 'flex-start',
    },
    authorName: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: 'bold',
      marginBottom: 4,
      marginLeft: 4,
    },
    bubble: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      elevation: 1,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    bubbleMine: {
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: theme.colors.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    content: {
      fontSize: 16,
      lineHeight: 22,
    },
    attachmentImage: {
      width: 220,
      height: 180,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: theme.colors.background,
    },
    contentMine: {
      color: theme.colors.background,
      fontWeight: '500',
    },
    contentTheirs: {
      color: theme.colors.text,
    },
    reactionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    reactionRowMine: {
      justifyContent: 'flex-end',
    },
    reactionRowTheirs: {
      justifyContent: 'flex-start',
    },
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    reactionChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '14',
    },
    reactionEmoji: {
      fontSize: 12,
    },
    reactionCount: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    timestamp: {
      fontSize: 10,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    timestampMine: {
      textAlign: 'right',
      marginRight: 4,
    },
    timestampTheirs: {
      textAlign: 'left',
      marginLeft: 4,
    },
  });
