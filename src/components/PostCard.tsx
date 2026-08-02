import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Alert, AlertButton } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { Post, PostCategory } from '../types/community';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { ModerationService } from '../services/ModerationService';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  isVentMode?: boolean;
  onToggleUpvote?: (post: Post) => void;
  onToggleSave?: (post: Post) => void;
  onBlockSuccess?: () => void;
}

const getCategoryColor = (theme: AppTheme, category: PostCategory) => {
  switch (category) {
    case PostCategory.STORY: return theme.colors.primary;
    case PostCategory.QUESTION: return theme.colors.accent;
    case PostCategory.DEAL: return theme.colors.success;
    case PostCategory.NEWS: return '#FF9500';
    case PostCategory.VENT: return theme.colors.error;
    case PostCategory.TIP: return theme.colors.secondary;
    default: return theme.colors.textMuted;
  }
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  isVentMode,
  onToggleUpvote,
  onToggleSave,
  onBlockSuccess,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const knowledgeTags = React.useMemo(() => {
    const tags = post.content.match(/#[A-Za-z0-9_]+/g) || [];
    const structuredTags = [
      post.airportCode ? `#${post.airportCode}` : '',
      ...(post.topicTags || []).map((tag) => `#${tag.replace(/\s+/g, '')}`),
    ].filter(Boolean);

    return Array.from(new Set([...structuredTags, ...tags])).slice(0, 4);
  }, [post.airportCode, post.content, post.topicTags]);

  const renderContentWithHashtags = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <Text key={index} style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{part}</Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  const handlePostOptions = () => {
    supabase.auth.getUser().then((result: any) => {
      const user = result.data?.user;
      if (!user) {
        Alert.alert('Authentication Required', 'Please sign in to manage safety features.');
        return;
      }
      
      const isOwnPost = post.authorId === user.id;
      const displayAuthorName = post.isAnonymous ? 'Anonymous Crew' : post.authorName;
      const options: AlertButton[] = [];

      if (!isOwnPost) {
        options.push(
          {
            text: 'Report Post',
            onPress: () => {
              Alert.alert(
                'Report Content',
                'Why are you reporting this content?',
                [
                  { text: 'Harassment / Hate Speech', onPress: () => submitReport('Harassment / Hate Speech') },
                  { text: 'Spam / Advertising', onPress: () => submitReport('Spam / Advertising') },
                  { text: 'Explicit Content', onPress: () => submitReport('Explicit Content') },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }
          },
          {
            text: `Block ${displayAuthorName}`,
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Block User',
                `Are you sure you want to block this user? You will no longer see their posts, comments, or messages.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await ModerationService.blockUser(post.authorId);
                        Alert.alert('Blocked', 'User has been blocked.');
                        onBlockSuccess?.();
                      } catch (err) {
                        Alert.alert('Error', 'Failed to block user.');
                      }
                    }
                  }
                ]
              );
            }
          }
        );
      } else {
        Alert.alert('Post Options', 'This is your own post.', [{ text: 'OK' }]);
        return;
      }

      options.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Safety & Moderation', 'Report or block this content:', options);
    });
  };

  const submitReport = async (reason: string) => {
    try {
      await ModerationService.reportContent('POST', post.id, reason);
      Alert.alert('Report Submitted', 'Thank you. We will review this post within 24 hours.');
    } catch (err) {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isVentMode && styles.cardVent]} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.header, isVentMode && { display: 'none' }]}>
        <View style={styles.authorInfo}>
          <View style={styles.avatar}>
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color={theme.colors.textMuted} />
            )}
          </View>
          <View>
            <Text style={styles.authorName}>
              {post.isAnonymous ? 'Anonymous Crew' : post.authorName}
            </Text>
            <Text style={styles.metaText}>
              {post.authorRole} • {formatDistanceToNow(new Date(post.createdAt))} ago
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.categoryBadge, { borderColor: getCategoryColor(theme, post.category) }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(theme, post.category) }]}>
              {post.category}
            </Text>
          </View>
          <TouchableOpacity onPress={handlePostOptions} style={{ padding: 6 }}>
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.title, isVentMode && styles.ventTitle]}>{post.title}</Text>
      <Text style={[styles.content, isVentMode && styles.ventContent]} numberOfLines={isVentMode ? 10 : 3}>
        {renderContentWithHashtags(post.content)}
      </Text>

      {!isVentMode && knowledgeTags.length > 0 ? (
        <View style={styles.knowledgeRow}>
          {knowledgeTags.map((tag) => (
            <View key={tag} style={styles.knowledgeChip}>
              <Text style={styles.knowledgeChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {post.imageUrl && (
        <View style={styles.imagePlaceholder}>
           <Ionicons name="image-outline" size={32} color={theme.colors.border} />
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.interactionRow}>
          <TouchableOpacity 
            style={[styles.interactionBtn, post.isUpvoted && styles.interactionBtnActive]} 
            onPress={() => onToggleUpvote?.(post)}
          >
            <Ionicons 
              name={post.isUpvoted ? "heart" : "heart-outline"} 
              size={28} 
              color={post.isUpvoted ? theme.colors.error : theme.colors.textMuted} 
            />
            <Text style={[styles.interactionText, post.isUpvoted && { color: theme.colors.error }, { fontSize: 15 }]}>
              {post.upvotes}
            </Text>
          </TouchableOpacity>

          {post.category !== PostCategory.VENT && (
            <TouchableOpacity style={styles.interactionBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.interactionText}>{post.commentCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isVentMode && (
            <TouchableOpacity onPress={handlePostOptions} style={{ padding: 6 }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.shareBtn} onPress={() => onToggleSave?.(post)}>
            <Ionicons
              name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={post.isSaved ? theme.colors.accent : theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.roundness.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardVent: {
    height: Dimensions.get('window').height * 0.65,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  ventTitle: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  ventContent: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 30,
    color: theme.colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  authorName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  content: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  imagePlaceholder: {
    height: 180,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness.md,
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  knowledgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  knowledgeChip: {
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
    backgroundColor: theme.colors.accent + '10',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  knowledgeChipText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  interactionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  interactionBtnActive: {
    // Optional: add background glow
  },
  interactionText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  interactionTextActive: {
    color: theme.colors.primary,
  },
  shareBtn: {
    padding: 4,
  }
});
