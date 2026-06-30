import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { CommunityService } from '../../src/services/CommunityService';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { CreatePostModal } from '../../src/components/CreatePostModal';
import { PostCard } from '../../src/components/PostCard';
import { Post, PostCategory } from '../../src/types/community';

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

  const loadPosts = useCallback(async () => {
    const data = await CommunityService.getPosts(PostCategory.VENT, user?.id);
    setPosts(data.filter((post) => post.category === PostCategory.VENT));
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
    _isAnonymous: boolean,
    airportCode?: string,
    topicTags?: string[]
  ) => {
    try {
      const newPost = await CommunityService.createPost({
        title,
        content,
        category: PostCategory.VENT,
        isAnonymous: true,
        airportCode,
        topicTags,
        postScope: airportCode ? 'LOCAL' : 'GLOBAL',
      });
      setPosts((prev) => [newPost, ...prev]);
      setIsModalVisible(false);
      AppSyncService.emit('community');
    } catch (error) {
      console.error('Failed to create vent:', error);
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

        {posts.length > 0 ? (
          <View style={styles.feed}>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isVentMode
                onPress={() => router.push(`/post/${post.id}?category=${post.category}`)}
              />
            ))}
          </View>
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
  });
