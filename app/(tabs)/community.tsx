import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { AppSyncService } from '../../src/services/AppSyncService';
import { CrewLockBanner } from '../../src/components/CrewLockBanner';
import { PostCard } from '../../src/components/PostCard';
import { CreatePostModal } from '../../src/components/CreatePostModal';
import { ChatRoom } from '../../src/types/chat';
import { Post, PostCategory } from '../../src/types/community';
import { CommunityService } from '../../src/services/CommunityService';
import { ChatService } from '../../src/services/ChatService';
import { NotificationInboxService } from '../../src/services/NotificationInboxService';

type CommunityViewMode = 'FOR_YOU' | 'LOCAL' | 'CATEGORIES' | 'SAVED';

type CommunityChannel = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  mode: CommunityViewMode;
  category?: PostCategory | 'ALL';
  searchHint?: string;
};

type CommunityChannelSection = {
  title: string;
  channels: CommunityChannel[];
};

const COMMUNITY_CHANNEL_SECTIONS: CommunityChannelSection[] = [
  {
    title: 'Base Ops',
    channels: [
      {
        id: 'for-you',
        label: 'Crew Feed',
        icon: 'newspaper-outline',
        description: 'A mixed crew feed from your base, saved interests, and recent discussion.',
        mode: 'FOR_YOU',
        category: 'ALL',
      },
      {
        id: 'local-base',
        label: 'Base Intel',
        icon: 'airplane-outline',
        description: 'Airport-specific intel from your base and favorite hubs.',
        mode: 'LOCAL',
        category: 'ALL',
        searchHint: 'base airport local tips shuttle hotels tsa',
      },
      {
        id: 'ops-alerts',
        label: 'Ops Alerts',
        icon: 'warning-outline',
        description: 'Delays, airport updates, and crew-visible operational chatter.',
        mode: 'CATEGORIES',
        category: PostCategory.NEWS,
        searchHint: 'delay tsa kcm gate weather ops alert',
      },
    ],
  },
  {
    title: 'Layovers',
    channels: [
      {
        id: 'hotels',
        label: 'Hotels',
        icon: 'bed-outline',
        description: 'Hotel condition, shuttle pickup, quiet rooms, and nearby basics.',
        mode: 'CATEGORIES',
        category: PostCategory.TIP,
        searchHint: 'hotel shuttle room pickup quiet breakfast',
      },
      {
        id: 'crash-pads',
        label: 'Crash Pads',
        icon: 'home-outline',
        description: 'Crash pad leads, commuting setups, roommate tips, and base housing notes.',
        mode: 'CATEGORIES',
        category: PostCategory.DEAL,
        searchHint: 'crash pad commuter room rent reserve',
      },
      {
        id: 'food-finds',
        label: 'Food Finds',
        icon: 'fast-food-outline',
        description: 'Food, coffee, groceries, and quick crew reset spots around airports.',
        mode: 'CATEGORIES',
        category: PostCategory.TIP,
        searchHint: 'food coffee grocery meal layover',
      },
    ],
  },
  {
    title: 'Crew Desk',
    channels: [
      {
        id: 'questions',
        label: 'Questions',
        icon: 'help-circle-outline',
        description: 'Ask working crew for fast answers before report, commute, or a new base.',
        mode: 'CATEGORIES',
        category: PostCategory.QUESTION,
      },
      {
        id: 'deals',
        label: 'Deals',
        icon: 'ticket-outline',
        description: 'Crew discounts, local finds, reserve-friendly deals, and swaps.',
        mode: 'CATEGORIES',
        category: PostCategory.DEAL,
      },
      {
        id: 'saved',
        label: 'Saved',
        icon: 'bookmark-outline',
        description: 'Your kept threads, tips, and posts worth coming back to.',
        mode: 'SAVED',
        category: 'ALL',
      },
    ],
  },
  {
    title: 'Crew Lounge',
    channels: [
      {
        id: 'stories',
        label: 'Crew Stories',
        icon: 'reader-outline',
        description: 'Crew stories, wins, lessons, and the human side of the job.',
        mode: 'CATEGORIES',
        category: PostCategory.STORY,
      },
    ],
  },
];

export default function CommunityScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<CommunityViewMode>('FOR_YOU');
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | 'ALL'>('ALL');
  const [selectedChannelId, setSelectedChannelId] = useState('for-you');
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const router = useRouter();

  const loadPosts = useCallback(async () => {
    const data = await CommunityService.getPosts(undefined, user?.id);
    setPosts(data);
  }, [user?.id]);

  const loadChatRooms = useCallback(async () => {
    if (!user?.id) {
      setChatRooms([]);
      return;
    }

    setChatRooms(
      await ChatService.getRoomIndex(user.id, {
        baseAirport: profile.baseAirport,
        favoriteAirports: profile.preferences.favoriteAirports,
      })
    );
  }, [profile.baseAirport, profile.preferences.favoriteAirports, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
      void loadChatRooms();
    }, [loadChatRooms, loadPosts])
  );

  useEffect(() => {
    return AppSyncService.subscribe((event) => {
      if (event === 'community') {
        void loadPosts();
      }
    });
  }, [loadPosts]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const subscription = NotificationInboxService.subscribeToInbox(user.id, () => {
      void loadChatRooms();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadChatRooms, user?.id]);

  const localAirportCodes = useMemo(
    () =>
      Array.from(
        new Set([profile.baseAirport, ...profile.preferences.favoriteAirports].filter(Boolean))
      ).map((code) => code.toUpperCase()),
    [profile.baseAirport, profile.preferences.favoriteAirports]
  );
  const unreadRoomCount = chatRooms.filter((room) => (room.unreadCount || 0) > 0).length;
  const savedPostCount = posts.filter((post) => post.isSaved).length;
  const baseLabel = profile.baseAirport || 'Crew base';
  const allCommunityChannels = useMemo(
    () => COMMUNITY_CHANNEL_SECTIONS.flatMap((section) => section.channels),
    []
  );
  const selectedChannel =
    allCommunityChannels.find((channel) => channel.id === selectedChannelId) || allCommunityChannels[0];
  const composerInitialCategory =
    selectedChannel.category && selectedChannel.category !== 'ALL'
      ? selectedChannel.category
      : PostCategory.STORY;
  const composerInitialTopicTags = useMemo(
    () =>
      selectedChannel.id === 'hotels'
        ? ['Hotels']
        : selectedChannel.id === 'crash-pads'
          ? ['Crash Pads']
          : selectedChannel.id === 'deals'
            ? ['Deals']
            : selectedChannel.id === 'ops-alerts'
              ? ['Safety']
              : [],
    [selectedChannel.id]
  );
  const composerInitialAirportTag = selectedChannel.mode === 'LOCAL' ? profile.baseAirport : '';
  const filteredPosts = posts.filter((post) => {
    const query = searchQuery.trim().toLowerCase();
    const searchableText = [
      post.title,
      post.content,
      post.category,
      post.authorName,
      post.authorRole,
      post.airportCode,
      ...(post.topicTags || []),
    ].join(' ').toLowerCase();
    const matchesSearch = !query || searchableText.includes(query);
    const isCommunityPost = post.category !== PostCategory.VENT;
    const matchesMode =
      viewMode === 'FOR_YOU' ||
      viewMode === 'CATEGORIES' ||
      (viewMode === 'SAVED' && post.isSaved) ||
      (viewMode === 'LOCAL' &&
        (post.postScope === 'LOCAL' ||
          (post.airportCode && localAirportCodes.includes(post.airportCode.toUpperCase())) ||
          localAirportCodes.some((code) =>
            `${post.title} ${post.content}`.toUpperCase().includes(code)
          )));
    const matchesCategory =
      selectedCategory === 'ALL' ||
      post.category === selectedCategory;

    return isCommunityPost && matchesSearch && matchesMode && matchesCategory;
  });
  const activeChannelCountLabel = `${filteredPosts.length} ${filteredPosts.length === 1 ? 'post' : 'posts'}`;
  const trendingTopics = useMemo(() => {
    const topicCounts = new Map<string, number>();

    posts.forEach((post) => {
      const hashtags = post.content.match(/#[A-Za-z0-9_]+/g) || [];
      hashtags.forEach((tag) => {
        topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
      });
    });

    return [...topicCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6)
      .map(([label]) => label);
  }, [posts]);
  const emptyMessage = searchQuery.trim().length > 0
    ? 'No discussions match that search yet.'
    : viewMode === 'SAVED'
      ? 'No saved posts yet. Bookmark threads to keep them handy.'
      : viewMode === 'LOCAL'
      ? `No local crew posts mention ${localAirportCodes.join(', ') || 'your base'} yet.`
      : 'No crew discussions yet. Verified crew can start the first thread.';
  const roomSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return allCommunityChannels
      .filter((channel) =>
        [channel.label, channel.description, channel.mode, channel.category, channel.searchHint]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 5);
  }, [allCommunityChannels, searchQuery]);
  const postSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return posts
      .filter((post) => {
        const searchableText = [
          post.title,
          post.content,
          post.category,
          post.authorName,
          post.authorRole,
          post.airportCode,
          ...(post.topicTags || []),
        ]
          .join(' ')
          .toLowerCase();

        return post.category !== PostCategory.VENT && searchableText.includes(query);
      })
      .slice(0, 4);
  }, [posts, searchQuery]);
  const airportSearchResults = useMemo(() => {
    const query = searchQuery.trim().toUpperCase();
    const airportCodes = new Set<string>();

    posts.forEach((post) => {
      if (post.category !== PostCategory.VENT && post.airportCode) {
        airportCodes.add(post.airportCode.toUpperCase());
      }
    });
    localAirportCodes.forEach((code) => airportCodes.add(code));

    if (!query) {
      return [];
    }

    return [...airportCodes].filter((code) => code.includes(query)).slice(0, 5);
  }, [localAirportCodes, posts, searchQuery]);
  const tagSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tags = new Set<string>();

    posts.forEach((post) => {
      if (post.category === PostCategory.VENT) {
        return;
      }

      (post.topicTags || []).forEach((tag) => tags.add(tag));
      const hashtags = post.content.match(/#[A-Za-z0-9_]+/g) || [];
      hashtags.forEach((tag) => tags.add(tag.replace(/^#/, '')));
    });

    if (!query) {
      return [];
    }

    return [...tags].filter((tag) => tag.toLowerCase().includes(query)).slice(0, 6);
  }, [posts, searchQuery]);
  const hasGroupedSearchResults =
    searchQuery.trim().length > 0 &&
    (roomSearchResults.length > 0 ||
      postSearchResults.length > 0 ||
      airportSearchResults.length > 0 ||
      tagSearchResults.length > 0);

  const handleSelectChannel = (channel: CommunityChannel) => {
    setSelectedChannelId(channel.id);
    setViewMode(channel.mode);
    setSelectedCategory(channel.category || 'ALL');
  };

  const handleSelectChannelById = (channelId: string) => {
    const channel = allCommunityChannels.find((item) => item.id === channelId);

    if (channel) {
      handleSelectChannel(channel);
    }
  };

  const handleOpenChatRoom = async (room: ChatRoom) => {
    if (user?.id) {
      await NotificationInboxService.markRoomAsRead(user.id, room.id);
      void loadChatRooms();
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

  const handleCreatePost = async (
    title: string,
    content: string,
    category: PostCategory,
    isAnonymous: boolean,
    airportCode?: string,
    topicTags?: string[]
  ) => {
    try {
      const newPost = await CommunityService.createPost({
        title,
        content,
        category,
        isAnonymous,
        airportCode,
        topicTags,
        postScope: airportCode ? 'LOCAL' : 'GLOBAL',
      });
      setPosts((prev) => [newPost, ...prev]);
      setSelectedCategory(category);
      setIsModalVisible(false);
      AppSyncService.emit('community');
    } catch (err) {
      console.error('Failed to create post:', err);
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
      console.error('Failed to toggle post upvote:', error);
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
      console.error('Failed to toggle saved post:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[styles.pageScrollContent, { paddingBottom: tabBarHeight + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Crew Community</Text>
            <Text style={styles.headerSubtitle}>Posts, rooms, local tips, and saved crew intel</Text>
          </View>
          <TouchableOpacity style={styles.roomsButton} onPress={() => router.push('/chat')}>
            <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.text} />
            <Text style={styles.roomsButtonText}>Rooms</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroPanelTop}>
            <View style={styles.baseBadge}>
              <Ionicons name="airplane-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.baseBadgeText}>{baseLabel}</Text>
            </View>
            {unreadRoomCount > 0 ? (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{unreadRoomCount} unread</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>Crew signal, not noise.</Text>
          <Text style={styles.heroText}>
            Browse organized rooms by base, layover need, crew topic, or saved intel.
          </Text>
          <View style={styles.statRow}>
            <TouchableOpacity
              style={styles.statPill}
              onPress={() => handleSelectChannelById('for-you')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statPill}
              onPress={() => router.push('/chat')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{chatRooms.length}</Text>
              <Text style={styles.statLabel}>Rooms</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statPill}
              onPress={() => handleSelectChannelById('saved')}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{savedPostCount}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.serverPanel}>
          <View style={styles.serverPanelHeader}>
            <View>
              <Text style={styles.serverTitle}>Crew Server</Text>
              <Text style={styles.serverSubtitle}>
                {selectedChannel.label} · {selectedChannel.description}
              </Text>
            </View>
            <TouchableOpacity style={styles.serverSearchButton} onPress={() => router.push('/chat')}>
              <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
          <View style={styles.channelGroupRail}>
            {COMMUNITY_CHANNEL_SECTIONS.map((section) => (
              <View
                key={section.title}
                style={[
                  styles.channelGroupCard,
                  section.channels.some((channel) => channel.id === selectedChannelId) &&
                    styles.channelGroupCardActive,
                ]}
              >
                <Text style={styles.channelSectionTitle}>{section.title}</Text>
                <View style={styles.channelRail}>
                  {section.channels.map((channel) => {
                  const active = selectedChannelId === channel.id;

                  return (
                    <TouchableOpacity
                      key={channel.id}
                      style={[styles.channelChip, active && styles.channelChipActive]}
                      onPress={() => handleSelectChannel(channel)}
                    >
                      <Ionicons
                        name={channel.icon}
                        size={15}
                        color={active ? theme.colors.background : theme.colors.accent}
                      />
                      <Text style={[styles.channelChipText, active && styles.channelChipTextActive]}>
                        {channel.label}
                      </Text>
                      {active ? <View style={styles.channelActiveDot} /> : null}
                    </TouchableOpacity>
                  );
                })}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.activeChannelCard}>
          <View style={styles.activeChannelIcon}>
            <Ionicons name={selectedChannel.icon} size={18} color={theme.colors.background} />
          </View>
          <View style={styles.activeChannelCopy}>
            <Text style={styles.activeChannelEyebrow}>Active channel</Text>
            <Text style={styles.activeChannelTitle}># {selectedChannel.label}</Text>
            <Text style={styles.activeChannelDescription}>{selectedChannel.description}</Text>
          </View>
          <View style={styles.activeChannelCountPill}>
            <Text style={styles.activeChannelCountText}>{activeChannelCountLabel}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          <TouchableOpacity
            style={[styles.topTab, viewMode === 'FOR_YOU' && styles.topTabActive]}
            onPress={() => handleSelectChannelById('for-you')}
          >
            <Text style={[styles.topTabText, viewMode === 'FOR_YOU' && styles.topTabTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topTab, viewMode === 'LOCAL' && styles.topTabActive]}
            onPress={() => handleSelectChannelById('local-base')}
          >
            <Text style={[styles.topTabText, viewMode === 'LOCAL' && styles.topTabTextActive]}>Local</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topTab, viewMode === 'CATEGORIES' && styles.topTabActive]}
            onPress={() => handleSelectChannelById('questions')}
          >
            <Text style={[styles.topTabText, viewMode === 'CATEGORIES' && styles.topTabTextActive]}>Topics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topTab, viewMode === 'SAVED' && styles.topTabActive]}
            onPress={() => handleSelectChannelById('saved')}
          >
            <Text style={[styles.topTabText, viewMode === 'SAVED' && styles.topTabTextActive]}>
              Saved
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
          {(['ALL', PostCategory.QUESTION, PostCategory.TIP, PostCategory.DEAL, PostCategory.NEWS, PostCategory.STORY] as const).map((category) => {
            const active = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => {
                  setSelectedCategory(category);
                }}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {category === 'ALL' ? 'All topics' : category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            placeholder="Search rooms, posts, airports, tags..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {hasGroupedSearchResults ? (
          <View style={styles.searchResultsPanel}>
            {roomSearchResults.length > 0 ? (
              <View style={styles.searchResultSection}>
                <Text style={styles.searchResultsTitle}>Channels</Text>
                <View style={styles.searchResultGrid}>
                  {roomSearchResults.map((channel) => (
                    <TouchableOpacity
                      key={channel.id}
                      style={styles.searchResultChip}
                      onPress={() => handleSelectChannel(channel)}
                    >
                      <Ionicons name={channel.icon} size={14} color={theme.colors.accent} />
                      <Text style={styles.searchResultText}>{channel.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            {postSearchResults.length > 0 ? (
              <View style={styles.searchResultSection}>
                <Text style={styles.searchResultsTitle}>Posts</Text>
                {postSearchResults.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.searchPostRow}
                    onPress={() => router.push(`/post/${post.id}?category=${post.category}`)}
                  >
                    <View style={styles.searchPostIcon}>
                      <Ionicons name="document-text-outline" size={14} color={theme.colors.accent} />
                    </View>
                    <View style={styles.searchPostCopy}>
                      <Text style={styles.searchPostTitle} numberOfLines={1}>{post.title}</Text>
                      <Text style={styles.searchPostMeta} numberOfLines={1}>
                        {post.category} {post.airportCode ? `· ${post.airportCode}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {airportSearchResults.length > 0 ? (
              <View style={styles.searchResultSection}>
                <Text style={styles.searchResultsTitle}>Airports</Text>
                <View style={styles.searchResultGrid}>
                  {airportSearchResults.map((code) => (
                    <TouchableOpacity
                      key={code}
                      style={styles.searchResultChip}
                      onPress={() => setSearchQuery(code)}
                    >
                      <Ionicons name="airplane-outline" size={14} color={theme.colors.accent} />
                      <Text style={styles.searchResultText}>{code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            {tagSearchResults.length > 0 ? (
              <View style={styles.searchResultSection}>
                <Text style={styles.searchResultsTitle}>Tags</Text>
                <View style={styles.searchResultGrid}>
                  {tagSearchResults.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.searchResultChip}
                      onPress={() => setSearchQuery(tag)}
                    >
                      <Ionicons name="pricetag-outline" size={14} color={theme.colors.accent} />
                      <Text style={styles.searchResultText}>#{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {!profile.verifiedCrew && (
        <CrewLockBanner message="Posting in community spaces stays locked until your crew verification is approved." />
      )}

      <View style={styles.feedBody}>
        <View style={styles.listHeader}>
            <TouchableOpacity
              style={styles.composerCard}
              onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
              disabled={!profile.verifiedCrew}
            >
              <View style={styles.composerAvatar}>
                <Ionicons name="person" size={18} color={theme.colors.textMuted} />
              </View>
              <View style={styles.composerCopy}>
                <Text style={styles.composerTitle}>Start a crew thread</Text>
                <Text style={styles.composerText}>Question, tip, local find, deal, or airport update</Text>
              </View>
              <Ionicons name="create-outline" size={20} color={theme.colors.accent} />
            </TouchableOpacity>

            {chatRooms.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Active Crew Chats</Text>
                  <Text style={styles.sectionMeta}>
                    {chatRooms.some((room) => (room.unreadCount || 0) > 0)
                      ? `${chatRooms.filter((room) => (room.unreadCount || 0) > 0).length} unread rooms`
                      : 'Stay close to airport chat'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chatRoomsScroll}>
                  {chatRooms.map((room) => (
                    <TouchableOpacity
                      key={room.id}
                      style={styles.chatRoomCard}
                      onPress={() => void handleOpenChatRoom(room)}
                    >
                      <View style={styles.chatRoomTop}>
                        <View style={styles.chatRoomBadge}>
                          <Text style={styles.chatRoomBadgeText}>{room.city || 'CREW'}</Text>
                        </View>
                        {(room.unreadCount || 0) > 0 ? (
                          <View style={styles.chatUnreadBadge}>
                            <Text style={styles.chatUnreadBadgeText}>
                              {(room.unreadCount || 0) > 9 ? '9+' : room.unreadCount || 0}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.chatRoomName} numberOfLines={1}>
                        {room.name}
                      </Text>
                      <Text style={styles.chatRoomMessage} numberOfLines={2}>
                        {room.lastMessage}
                      </Text>
                      <View style={styles.chatRoomFooter}>
                        <Text style={styles.chatRoomMeta}>{room.memberCount} crew</Text>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.accent} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
            {trendingTopics.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Trending Topics</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingScroll}>
                  {trendingTopics.map((topic) => (
                    <TouchableOpacity
                      key={topic}
                      style={[styles.topicChip, !isDark && styles.topicChipLight]}
                    >
                      <Text style={styles.topicLabel}>{topic}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
            {filteredPosts.length > 0 ? (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {viewMode === 'LOCAL' ? 'Local Knowledge' : viewMode === 'CATEGORIES' ? 'Organized Topics' : 'Recent Discussions'}
                </Text>
                <Text style={styles.sectionMeta}>{filteredPosts.length} searchable posts</Text>
              </View>
            ) : null}
        </View>

        {filteredPosts.length > 0 ? (
          filteredPosts.map((item) => (
            <PostCard
              key={item.id}
              post={item}
              isVentMode={false}
              onPress={() => router.push(`/post/${item.id}?category=${item.category}`)}
              onToggleUpvote={handleToggleUpvote}
              onToggleSave={handleToggleSave}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name={selectedChannel.icon} size={42} color={theme.colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>#{selectedChannel.label} is quiet</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={[styles.emptyActionButton, !profile.verifiedCrew && styles.emptyActionDisabled]}
                onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
                disabled={!profile.verifiedCrew}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.background} />
                <Text style={styles.emptyActionText}>Start Post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptySecondaryButton} onPress={() => router.push('/chat')}>
                <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.text} />
                <Text style={styles.emptySecondaryText}>Open Rooms</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: tabBarHeight + 16 }, !profile.verifiedCrew && styles.fabDisabled]}
        onPress={() => profile.verifiedCrew && setIsModalVisible(true)}
        disabled={!profile.verifiedCrew}
        activeOpacity={0.86}
      >
        <Ionicons name="create-outline" size={28} color={theme.colors.background} />
      </TouchableOpacity>

      <CreatePostModal
        visible={isModalVisible}
        initialCategory={composerInitialCategory}
        allowedCategories={[
          PostCategory.STORY,
          PostCategory.QUESTION,
          PostCategory.DEAL,
          PostCategory.NEWS,
          PostCategory.TIP,
        ]}
        channelContext={{
          label: selectedChannel.label,
          description: selectedChannel.description,
          icon: selectedChannel.icon,
        }}
        initialAirportTag={composerInitialAirportTag}
        initialTopicTags={composerInitialTopicTags}
        onClose={() => setIsModalVisible(false)}
        onPost={handleCreatePost}
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
    pageScroll: {
      flex: 1,
    },
    pageScrollContent: {
      flexGrow: 1,
    },
    header: {
      padding: theme.spacing.md,
      paddingTop: theme.spacing.lg,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '900',
    },
    headerSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
    roomsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.roundness.full,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    roomsButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    heroPanel: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: 10,
      marginBottom: theme.spacing.md,
    },
    heroPanelTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    baseBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '55',
      backgroundColor: theme.colors.accent + '10',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    baseBadgeText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    unreadPill: {
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    unreadPillText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    heroText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    statRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    statPill: {
      flex: 1,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      padding: 10,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    serverPanel: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    serverPanelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
    },
    serverTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    serverSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
      marginTop: 3,
      maxWidth: 520,
    },
    serverSearchButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      backgroundColor: theme.colors.accent + '10',
    },
    channelGroupRail: {
      flexDirection: 'column',
      gap: 7,
    },
    channelGroupCard: {
      width: '100%',
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      padding: 8,
      gap: 7,
    },
    channelGroupCardActive: {
      borderColor: theme.colors.accent + '77',
      backgroundColor: theme.colors.accent + '08',
    },
    channelSectionTitle: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    channelRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    channelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 34,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    channelChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    channelActiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.background,
    },
    channelChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '900',
    },
    activeChannelCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    activeChannelIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    activeChannelCopy: {
      flex: 1,
      gap: 2,
    },
    activeChannelEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    activeChannelTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    activeChannelDescription: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    activeChannelCountPill: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    activeChannelCountText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '900',
    },
    channelChipTextActive: {
      color: theme.colors.background,
    },
    tabContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    topTab: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 96,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    topTabActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    topTabText: {
      color: theme.colors.textMuted,
      fontWeight: 'bold',
      fontSize: 14,
    },
    topTabTextActive: {
      color: theme.colors.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 15,
      height: 44,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryRail: {
      gap: 10,
      paddingBottom: theme.spacing.md,
    },
    categoryPill: {
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    categoryPillActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryPillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    categoryPillTextActive: {
      color: theme.colors.background,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      color: theme.colors.text,
      fontSize: 16,
    },
    searchResultsPanel: {
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.accent + '24',
      backgroundColor: theme.colors.accent + '0D',
      padding: 12,
      marginTop: theme.spacing.sm,
      gap: 12,
    },
    searchResultSection: {
      gap: 8,
    },
    searchResultsTitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.1,
    },
    searchResultGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    searchResultChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    searchResultText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    searchPostRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 10,
    },
    searchPostIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent + '12',
    },
    searchPostCopy: {
      flex: 1,
      gap: 2,
    },
    searchPostTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    searchPostMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    listContent: {
      padding: theme.spacing.md,
    },
    feedBody: {
      padding: theme.spacing.md,
      paddingTop: 0,
    },
    listHeader: {
      marginBottom: theme.spacing.md,
    },
    composerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: theme.roundness.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    composerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    composerCopy: {
      flex: 1,
      gap: 2,
    },
    composerTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    composerText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 12,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 12,
      marginTop: 10,
    },
    sectionMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 12,
    },
    chatRoomsScroll: {
      marginBottom: theme.spacing.lg,
    },
    chatRoomCard: {
      width: 220,
      height: 150,
      marginRight: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.roundness.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'space-between',
    },
    chatRoomTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    chatRoomBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.roundness.full,
    },
    chatRoomBadgeText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '900',
    },
    chatUnreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
    },
    chatUnreadBadgeText: {
      color: theme.colors.background,
      fontSize: 10,
      fontWeight: '900',
    },
    chatRoomName: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
    },
    chatRoomMessage: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      minHeight: 32,
      marginBottom: 10,
    },
    chatRoomFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chatRoomMeta: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    trendingScroll: {
      marginBottom: theme.spacing.lg,
    },
    topicChip: {
      backgroundColor: theme.colors.primary + '12',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.roundness.full,
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.colors.primary + '22',
    },
    topicChipLight: {
      backgroundColor: theme.colors.cardSoft,
      borderColor: theme.colors.primary + '33',
    },
    topicLabel: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
    fabDisabled: {
      opacity: 0.4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 36,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.md,
    },
    emptyIconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 1,
      borderColor: theme.colors.accent + '44',
      backgroundColor: theme.colors.accent + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 23,
      fontWeight: '700',
      maxWidth: 340,
    },
    emptyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    emptyActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    emptyActionDisabled: {
      opacity: 0.45,
    },
    emptyActionText: {
      color: theme.colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    emptySecondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: theme.roundness.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    emptySecondaryText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
  });
