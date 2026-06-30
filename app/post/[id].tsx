import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { CommunityService } from '../../src/services/CommunityService';
import { Post, PostCategory, PostComment } from '../../src/types/community';

const renderHashtags = (text: string, theme: AppTheme) =>
  text.split(/(#\w+)/g).map((part, index) =>
    part.startsWith('#') ? (
      <Text key={`${part}-${index}`} style={{ color: theme.colors.primary, fontWeight: '800' }}>
        {part}
      </Text>
    ) : (
      <Text key={`${part}-${index}`}>{part}</Text>
    )
  );

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    let active = true;

    const loadThread = async () => {
      if (!id) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const detail = await CommunityService.getPostById(id, user?.id);

      if (!active) {
        return;
      }

      setPost(detail);
      setEditTitle(detail?.title || '');
      setEditContent(detail?.content || '');

      if (detail && detail.category !== PostCategory.VENT) {
        const threadComments = await CommunityService.getComments(id);
        if (!active) {
          return;
        }
        setComments(threadComments);
      } else {
        setComments([]);
      }

      if (active) {
        setIsLoading(false);
      }
    };

    void loadThread();

    return () => {
      active = false;
    };
  }, [id, user?.id]);

  const handleToggleUpvote = async () => {
    if (!post) {
      return;
    }

    const currentUpvoteState = Boolean(post.isUpvoted);
    const optimisticCount = post.upvotes + (currentUpvoteState ? -1 : 1);
    setPost({
      ...post,
      isUpvoted: !currentUpvoteState,
      upvotes: optimisticCount,
    });

    try {
      const result = await CommunityService.toggleUpvote(post.id, currentUpvoteState);
      setPost((current) =>
        current
          ? {
              ...current,
              isUpvoted: result.isUpvoted,
              upvotes: result.upvotes,
            }
          : current
      );
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to toggle thread upvote:', error);
      setPost(post);
    }
  };

  const handleToggleSave = async () => {
    if (!post) {
      return;
    }

    const currentSavedState = Boolean(post.isSaved);
    setPost({
      ...post,
      isSaved: !currentSavedState,
    });

    try {
      const result = await CommunityService.toggleSaved(post.id, currentSavedState);
      setPost((current) =>
        current
          ? {
              ...current,
              isSaved: result.isSaved,
            }
          : current
      );
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to toggle thread save:', error);
      setPost(post);
    }
  };

  const handleSendComment = async () => {
    if (!post || !newComment.trim() || post.category === PostCategory.VENT) {
      return;
    }

    setIsSubmittingComment(true);

    try {
      const createdComment = await CommunityService.createComment(post.id, newComment.trim());
      setComments((prev) => [...prev, createdComment]);
      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: current.commentCount + 1,
            }
          : current
      );
      setNewComment('');
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to create thread comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const canManagePost = Boolean(user?.id && post?.authorId === user.id);

  const handleSavePostEdit = async () => {
    if (!post) {
      return;
    }

    try {
      const updated = await CommunityService.updatePost(post.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setPost(updated);
      setIsEditingPost(false);
      AppSyncService.emit('community');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update this post right now.';
      Alert.alert('Update Failed', message);
    }
  };

  const handleDeletePost = () => {
    if (!post) {
      return;
    }

    Alert.alert(
      'Delete Post',
      `Remove "${post.title}" from the crew community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await CommunityService.deletePost(post.id);
                AppSyncService.emit('community');
                router.replace('/community');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Unable to delete this post right now.';
                Alert.alert('Delete Failed', message);
              }
            })();
          },
        },
      ]
    );
  };

  const handleDeleteComment = (comment: PostComment) => {
    Alert.alert(
      'Delete Comment',
      'Remove your comment from this thread?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const counts = await CommunityService.deleteComment(comment.id, comment.postId);
                setComments((current) => current.filter((entry) => entry.id !== comment.id));
                setPost((current) =>
                  current
                    ? {
                        ...current,
                        commentCount: counts.commentCount,
                      }
                    : current
                );
                AppSyncService.emit('community');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Unable to delete this comment right now.';
                Alert.alert('Delete Failed', message);
              }
            })();
          },
        },
      ]
    );
  };

  const handleSharePost = async () => {
    if (!post) {
      return;
    }

    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\n${post.content}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the share sheet right now.';
      Alert.alert('Share Failed', message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thread Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={56} color={theme.colors.border} />
          <Text style={styles.emptyTitle}>Thread not found</Text>
          <Text style={styles.emptyText}>This post may have been removed or never loaded correctly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isVent = post.category === PostCategory.VENT;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thread Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => void handleSharePost()} style={styles.saveButton}>
            <Ionicons name="share-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleSave} style={styles.saveButton}>
            <Ionicons
              name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={post.isSaved ? theme.colors.accent : theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flexFill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={theme.colors.background} />
            </View>
            <View style={styles.authorCopy}>
              <Text style={styles.authorName}>{post.isAnonymous ? 'Anonymous Crew' : post.authorName}</Text>
              <Text style={styles.postMeta}>
                {post.authorRole} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </Text>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{post.category}</Text>
            </View>
          </View>

          {isEditingPost ? (
            <View style={styles.editCard}>
              <TextInput
                style={styles.editTitleInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Post title"
                placeholderTextColor={theme.colors.textMuted}
              />
              <TextInput
                style={styles.editBodyInput}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Update your crew post"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editPrimaryButton} onPress={() => void handleSavePostEdit()}>
                  <Text style={styles.editPrimaryButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSecondaryButton} onPress={() => setIsEditingPost(false)}>
                  <Text style={styles.editSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{post.title}</Text>
              <Text style={styles.bodyText}>{renderHashtags(post.content, theme)}</Text>
            </>
          )}

          {canManagePost && !isEditingPost ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerActionButton} onPress={() => setIsEditingPost(true)}>
                <Ionicons name="create-outline" size={16} color={theme.colors.text} />
                <Text style={styles.ownerActionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerDeleteButton} onPress={handleDeletePost}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                <Text style={styles.ownerDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.interactionRow}>
            <TouchableOpacity style={styles.interactionBtn} onPress={handleToggleUpvote}>
              <Ionicons
                name={post.isUpvoted ? 'heart' : 'heart-outline'}
                size={24}
                color={post.isUpvoted ? theme.colors.error : theme.colors.textMuted}
              />
              <Text style={[styles.interactionText, post.isUpvoted && styles.interactionTextActive]}>
                {post.upvotes}
              </Text>
            </TouchableOpacity>
            <View style={styles.interactionBtn}>
              <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textMuted} />
              <Text style={styles.interactionText}>{post.commentCount}</Text>
            </View>
            <TouchableOpacity style={styles.interactionBtn} onPress={handleToggleSave}>
              <Ionicons
                name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={post.isSaved ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={[styles.interactionText, post.isSaved && styles.interactionTextSaved]}>
                {post.isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isVent ? (
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Comments</Text>
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentMeta}>
                        {comment.authorName} • {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </Text>
                      {comment.authorId === user?.id ? (
                        <TouchableOpacity onPress={() => handleDeleteComment(comment)} style={styles.commentAction}>
                          <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                          <Text style={styles.commentActionText}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>No comments yet. Start the thread.</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.ventWarning}>
              <Ionicons name="eye-outline" size={20} color={theme.colors.error} />
              <Text style={styles.ventWarningText}>Comments are disabled in the Venting Room.</Text>
            </View>
          )}
        </ScrollView>

        {!isVent ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                profile.verifiedCrew ? 'Add a comment...' : 'Crew verification is required to comment'
              }
              placeholderTextColor={theme.colors.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              editable={profile.verifiedCrew && !isSubmittingComment}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!newComment.trim() || !profile.verifiedCrew || isSubmittingComment) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendComment}
              disabled={!newComment.trim() || !profile.verifiedCrew || isSubmittingComment}
            >
              <Ionicons name="send" size={20} color={theme.colors.background} />
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    loadingScreen: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexFill: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitle: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold' },
    headerSpacer: { width: 40 },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    saveButton: {
      width: 40,
      alignItems: 'flex-end',
    },
    content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
    authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    authorCopy: {
      flex: 1,
    },
    authorName: { color: theme.colors.text, fontSize: 16, fontWeight: 'bold' },
    postMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    categoryBadge: {
      borderWidth: 1,
      borderColor: theme.colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
    },
    categoryText: {
      color: theme.colors.accent,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    editCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    editTitleInput: {
      height: 48,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      paddingHorizontal: 14,
      fontSize: 16,
      fontWeight: '700',
    },
    editBodyInput: {
      minHeight: 120,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    editActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    editPrimaryButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.roundness.full,
      alignItems: 'center',
      paddingVertical: 12,
    },
    editPrimaryButtonText: {
      color: theme.colors.background,
      fontSize: 14,
      fontWeight: '900',
    },
    editSecondaryButton: {
      paddingHorizontal: 18,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editSecondaryButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    title: { color: theme.colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: theme.spacing.md },
    bodyText: { color: theme.colors.textMuted, fontSize: 16, lineHeight: 24, marginBottom: theme.spacing.md },
    ownerActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    ownerActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ownerActionText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    ownerDeleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.error + '44',
      backgroundColor: theme.colors.error + '10',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ownerDeleteText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '800',
    },
    interactionRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.md,
      gap: 18,
      marginBottom: theme.spacing.lg,
    },
    interactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    interactionText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
    interactionTextActive: { color: theme.colors.error },
    interactionTextSaved: { color: theme.colors.accent },
    commentsSection: { marginTop: theme.spacing.sm },
    commentsTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: theme.spacing.md,
    },
    commentBubble: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 6,
    },
    commentMeta: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 6 },
    commentAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.error + '28',
      backgroundColor: theme.colors.error + '10',
    },
    commentActionText: {
      color: theme.colors.error,
      fontSize: 11,
      fontWeight: '800',
    },
    commentText: { color: theme.colors.text, fontSize: 15, lineHeight: 21 },
    emptyComments: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyCommentsText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      paddingHorizontal: 16,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginRight: 12,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
    ventWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
      gap: 8,
      backgroundColor: theme.colors.error + '12',
      borderRadius: theme.roundness.md,
    },
    ventWarningText: { color: theme.colors.error, fontSize: 14, fontWeight: 'bold' },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginTop: theme.spacing.md,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      textAlign: 'center',
    },
  });
