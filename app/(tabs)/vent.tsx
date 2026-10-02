import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { CommunityService } from '../../src/services/CommunityService';
import { ChatMediaService } from '../../src/services/ChatMediaService';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { CreatePostModal } from '../../src/components/CreatePostModal';
import { PostCard } from '../../src/components/PostCard';
import { Post, PostCategory } from '../../src/types/community';
import { ModerationService } from '../../src/services/ModerationService';

const VENT_RED = '#ff2f3a';

export default function VentRoomScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'SWIPE' | 'FEED'>('SWIPE');
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const loadPosts = useCallback(async () => {
    const data = await CommunityService.getPosts(PostCategory.VENT, user?.id);
    setPosts(
      data.filter(
        (post) =>
          post.category === PostCategory.VENT &&
          !ModerationService.isUserBlockedSync(post.authorId) &&
          !ModerationService.isPostHiddenSync(post.id)
      )
    );
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  useEffect(() => {
    return AppSyncService.subscribe((event) => {
      if (event === 'community') {
        void loadPosts();
      }
    });
  }, [loadPosts]);

  const handleCreateVent = async (
    title: string,
    content: string,
    _category: PostCategory,
    isAnonymous: boolean,
    airportCode?: string,
    topicTags?: string[],
    photoUri?: string | null
  ) => {
    try {
      let finalPhotoPath = undefined;
      if (photoUri && user?.id) {
        try {
          finalPhotoPath = await ChatMediaService.uploadAttachment(user.id, photoUri);
        } catch (uploadErr) {
          console.warn('Failed to upload attachment:', uploadErr);
        }
      }

      const newPost = await CommunityService.createPost({
        title,
        content,
        category: PostCategory.VENT,
        isAnonymous: isAnonymous,
        airportCode,
        topicTags,
        postScope: airportCode ? 'LOCAL' : 'GLOBAL',
        imageUrl: finalPhotoPath,
      } as any);
      setPosts((prev) => [newPost, ...prev]);
      setIsModalVisible(false);
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to create vent:', error);
    }
  };

  const handleToggleUpvote = async (post: Post) => {
    const currentUpvoteState = Boolean(post.isUpvoted);
    const optimisticCount = post.upvotes + (currentUpvoteState ? -1 : 1);

    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? { ...item, isUpvoted: !currentUpvoteState, upvotes: optimisticCount }
          : item
      )
    );

    try {
      const result = await CommunityService.toggleUpvote(post.id, currentUpvoteState);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, isUpvoted: result.isUpvoted, upvotes: result.upvotes }
            : item
        )
      );
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to toggle vent upvote:', error);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, isUpvoted: currentUpvoteState, upvotes: post.upvotes }
            : item
        )
      );
      Alert.alert('Action Blocked', error instanceof Error ? error.message : 'Unable to complete action.');
    }
  };

  const handleToggleSave = async (post: Post) => {
    const currentSavedState = Boolean(post.isSaved);

    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? { ...item, isSaved: !currentSavedState }
          : item
      )
    );

    try {
      const result = await CommunityService.toggleSaved(post.id, currentSavedState);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, isSaved: result.isSaved }
            : item
        )
      );
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to toggle saved vent:', error);
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, isSaved: currentSavedState }
            : item
        )
      );
      Alert.alert('Action Blocked', error instanceof Error ? error.message : 'Unable to complete action.');
    }
  };

  const handleVentOptions = (vent: Post) => {
    Alert.alert(
      'Safety & Content Options',
      'YoFly Crew maintains a strict zero-tolerance policy against objectionable content. Reports are investigated and acted upon within 24 hours. Offending users will be ejected.',
      [
        {
          text: 'Hide This Vent (Remove from Feed)',
          onPress: async () => {
            await ModerationService.hidePost(vent.id);
            setPosts((prev) => {
              const updated = prev.filter((p) => p.id !== vent.id);
              setActiveCardIndex((curr) => (curr >= updated.length ? Math.max(0, updated.length - 1) : curr));
              return updated;
            });
            Alert.alert('Vent Removed', 'This vent has been immediately removed from your feed.');
          },
        },
        {
          text: 'Report Objectionable Content',
          onPress: () => {
            Alert.alert(
              'Report Vent',
              'Why are you reporting this vent?',
              [
                { text: 'Harassment / Abusive Behavior', onPress: () => submitVentReport(vent, 'Harassment / Abusive Behavior') },
                { text: 'Hate Speech / Discrimination', onPress: () => submitVentReport(vent, 'Hate Speech / Discrimination') },
                { text: 'Explicit / Sexual Content', onPress: () => submitVentReport(vent, 'Explicit / Sexual Content') },
                { text: 'Spam / Commercial', onPress: () => submitVentReport(vent, 'Spam / Commercial') },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          },
        },
        {
          text: 'Block Author',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Block Author',
              'Are you sure you want to block this user? All of their vents and posts will be removed from your view.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await ModerationService.blockUser(vent.authorId);
                      await ModerationService.hidePost(vent.id);
                      setPosts((prev) => {
                        const updated = prev.filter((p) => p.authorId !== vent.authorId);
                        setActiveCardIndex((curr) => (curr >= updated.length ? Math.max(0, updated.length - 1) : curr));
                        return updated;
                      });
                      Alert.alert('Author Blocked', 'This author has been blocked and their content removed.');
                    } catch {
                      Alert.alert('Error', 'Failed to block author.');
                    }
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Contact Developer Safety Team',
          onPress: () => {
            Linking.openURL(`mailto:admin@yoflycrew.com?subject=Report%20Inappropriate%20Vent&body=Vent%20ID:%20${vent.id}%0APlease%20describe%20the%20issue:`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitVentReport = async (vent: Post, reason: string) => {
    try {
      await ModerationService.reportContent('POST', vent.id, reason);
      await ModerationService.hidePost(vent.id);
      setPosts((prev) => {
        const updated = prev.filter((p) => p.id !== vent.id);
        setActiveCardIndex((curr) => (curr >= updated.length ? Math.max(0, updated.length - 1) : curr));
        return updated;
      });
      Alert.alert(
        'Report Submitted & Vent Removed',
        'Thank you. This vent has been immediately removed from your feed.\n\nYoFly Crew acts on all reports within 24 hours. Offending content will be removed and abusive users permanently ejected.\n\nDirect developer contact: admin@yoflycrew.com'
      );
    } catch {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.flameBadge}>
            <Ionicons name="flame-outline" size={24} color={theme.colors.background} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Crew Lounge</Text>
            <Text style={styles.title}>Vent Room</Text>
            <Text style={styles.subtitle}>
              A separate crew-only space for rough trips, hotel chaos, delays, and the stuff only
              other crew understand.
            </Text>
          </View>
        </View>

        <View style={styles.rulePanel}>
          <View style={styles.ruleItem}>
            <Ionicons name="eye-off-outline" size={17} color={VENT_RED} />
            <Text style={styles.ruleText}>Anonymous starts on by default</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="shield-checkmark-outline" size={17} color={VENT_RED} />
            <Text style={styles.ruleText}>Verified crew only</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={VENT_RED} />
            <Text style={styles.ruleText}>{posts.length} vents</Text>
          </View>
        </View>

        {!profile.verifiedCrew ? (
          <CrewLockBanner message="Vent Room posting stays locked until your crew verification is approved." />
        ) : null}

        <TouchableOpacity
          style={[styles.composeCard, !profile.verifiedCrew && styles.disabled]}
          onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
          disabled={!profile.verifiedCrew}
        >
          <View style={styles.composeIcon}>
            <Ionicons name="create-outline" size={20} color={VENT_RED} />
          </View>
          <View style={styles.composeCopy}>
            <Text style={styles.composeTitle}>Post a vent</Text>
            <Text style={styles.composeText}>Anonymous crew pressure valve</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[styles.modeToggleButton, viewMode === 'SWIPE' && styles.modeToggleButtonActive]}
            onPress={() => setViewMode('SWIPE')}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={viewMode === 'SWIPE' ? theme.colors.background : VENT_RED} />
            <Text style={[styles.modeToggleText, viewMode === 'SWIPE' && styles.modeToggleTextActive]}>Swipe Deck</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeToggleButton, viewMode === 'FEED' && styles.modeToggleButtonActive]}
            onPress={() => setViewMode('FEED')}
          >
            <Ionicons name="list-outline" size={16} color={viewMode === 'FEED' ? theme.colors.background : VENT_RED} />
            <Text style={[styles.modeToggleText, viewMode === 'FEED' && styles.modeToggleTextActive]}>Feed View</Text>
          </TouchableOpacity>
        </View>

        {posts.length > 0 ? (
          viewMode === 'SWIPE' ? (
            <View style={styles.swipeDeckContainer}>
              {activeCardIndex < posts.length ? (
                <View style={styles.swipeCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.anonymousBadge}>
                      <Ionicons name="eye-off" size={14} color={VENT_RED} />
                      <Text style={styles.anonymousBadgeText}>
                        {posts[activeCardIndex].isAnonymous ? 'Anonymous Crew' : posts[activeCardIndex].authorName}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {posts[activeCardIndex].airportCode ? (
                        <View style={styles.cardAirportTag}>
                          <Text style={styles.cardAirportText}>#{posts[activeCardIndex].airportCode}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => handleVentOptions(posts[activeCardIndex])}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{posts[activeCardIndex].title}</Text>
                  <Text style={styles.cardContent}>{posts[activeCardIndex].content}</Text>

                  <View style={styles.swipeActionsRow}>
                    <TouchableOpacity
                      style={styles.swipeSkipButton}
                      onPress={() => setActiveCardIndex((prev) => (prev + 1) % posts.length)}
                    >
                      <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                      <Text style={styles.swipeSkipText}>Next Vent</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.swipeUpvoteButton,
                        posts[activeCardIndex].isUpvoted && styles.swipeUpvoteButtonActive,
                      ]}
                      onPress={() => handleToggleUpvote(posts[activeCardIndex])}
                    >
                      <Ionicons name="flame" size={22} color="#ffffff" />
                      <Text style={styles.swipeUpvoteText}>
                        {posts[activeCardIndex].upvotes} {posts[activeCardIndex].isUpvoted ? 'Vented!' : 'Upvote'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardCounter}>
                    Vent {activeCardIndex + 1} of {posts.length}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={44} color={VENT_RED} />
                  <Text style={styles.emptyTitle}>You're all caught up!</Text>
                  <TouchableOpacity style={styles.resetButton} onPress={() => setActiveCardIndex(0)}>
                    <Text style={styles.resetButtonText}>Replay Vents</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.feed}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isVentMode
                  onPress={() => router.push(`/post/${post.id}?category=${post.category}`)}
                  onToggleUpvote={handleToggleUpvote}
                  onToggleSave={handleToggleSave}
                  onBlockSuccess={loadPosts}
                  onHideSuccess={loadPosts}
                />
              ))}
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="flame-outline" size={44} color={VENT_RED} />
            <Text style={styles.emptyTitle}>No vents yet</Text>
            <Text style={styles.emptyText}>When crew need a pressure valve, the room will start here.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: tabBarHeight + 16 }, !profile.verifiedCrew && styles.disabled]}
        onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
        disabled={!profile.verifiedCrew}
      >
        <Ionicons name="flame-outline" size={28} color={theme.colors.background} />
      </TouchableOpacity>

      <CreatePostModal
        visible={isModalVisible}
        initialCategory={PostCategory.VENT}
        allowedCategories={[PostCategory.VENT]}
        onClose={() => setIsModalVisible(false)}
        onPost={handleCreateVent}
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: VENT_RED + '52',
      backgroundColor: VENT_RED + '12',
      padding: theme.spacing.md,
    },
    flameBadge: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: VENT_RED,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    kicker: {
      color: VENT_RED,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    title: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    rulePanel: {
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: 10,
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    ruleText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    composeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: VENT_RED + '42',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
    },
    disabled: {
      opacity: 0.45,
    },
    composeIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: VENT_RED + '14',
    },
    composeCopy: {
      flex: 1,
      gap: 2,
    },
    composeTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    composeText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    feed: {
      gap: theme.spacing.md,
    },
    emptyState: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 20,
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: VENT_RED,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: VENT_RED,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
    modeToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginVertical: 4,
    },
    modeToggleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: VENT_RED + '40',
      backgroundColor: theme.colors.surface,
    },
    modeToggleButtonActive: {
      backgroundColor: VENT_RED,
      borderColor: VENT_RED,
    },
    modeToggleText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    modeToggleTextActive: {
      color: theme.colors.background,
    },
    swipeDeckContainer: {
      marginVertical: 8,
    },
    swipeCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: VENT_RED + '60',
      padding: 20,
      gap: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    anonymousBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: VENT_RED + '18',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    anonymousBadgeText: {
      color: VENT_RED,
      fontSize: 12,
      fontWeight: '800',
    },
    cardAirportTag: {
      backgroundColor: theme.colors.border + '40',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    cardAirportText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 26,
    },
    cardContent: {
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
    },
    swipeActionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 10,
    },
    swipeSkipButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    swipeSkipText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    swipeUpvoteButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: VENT_RED,
    },
    swipeUpvoteButtonActive: {
      backgroundColor: '#cc111a',
    },
    swipeUpvoteText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    cardCounter: {
      textAlign: 'center',
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    resetButton: {
      backgroundColor: VENT_RED,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 14,
      marginTop: 12,
    },
    resetButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
  });
