import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../theme/theme';
import { PostCategory } from '../types/community';

interface CreatePostModalProps {
  visible: boolean;
  initialCategory?: PostCategory;
  allowedCategories?: PostCategory[];
  channelContext?: {
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
  };
  initialAirportTag?: string;
  initialTopicTags?: string[];
  onClose: () => void;
  onPost: (
    title: string,
    content: string,
    category: PostCategory,
    isAnonymous: boolean,
    airportCode?: string,
    topicTags?: string[]
  ) => void;
}

const CATEGORIES = [
  { type: PostCategory.STORY, icon: 'search-outline', label: 'Story' },
  { type: PostCategory.QUESTION, icon: 'help-circle-outline', label: 'Question' },
  { type: PostCategory.DEAL, icon: 'pricetag-outline', label: 'Deal' },
  { type: PostCategory.NEWS, icon: 'newspaper-outline', label: 'News' },
  { type: PostCategory.VENT, icon: 'eye-outline', label: 'Vent' },
  { type: PostCategory.TIP, icon: 'bulb-outline', label: 'Tip' },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  initialCategory = PostCategory.STORY,
  allowedCategories,
  channelContext,
  initialAirportTag = '',
  initialTopicTags = [],
  onClose,
  onPost,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>(PostCategory.STORY);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [airportTag, setAirportTag] = useState('');
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const isVentPost = category === PostCategory.VENT;
  const visibleCategories = allowedCategories?.length
    ? CATEGORIES.filter((cat) => allowedCategories.includes(cat.type))
    : CATEGORIES;
  const normalizedInitialCategory = visibleCategories.some((cat) => cat.type === initialCategory)
    ? initialCategory
    : visibleCategories[0]?.type || PostCategory.STORY;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCategory(normalizedInitialCategory);
    setIsAnonymous(normalizedInitialCategory === PostCategory.VENT);
    setAirportTag(initialAirportTag);
    setTopicTags(initialTopicTags);
  }, [initialAirportTag, initialTopicTags, normalizedInitialCategory, visible]);

  const toggleTopicTag = (tag: string) => {
    setTopicTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const handleSubmit = () => {
    if (title.trim() && content.trim()) {
      const normalizedAirport = airportTag.trim().toUpperCase();
      const structuredTags = [
        normalizedAirport ? `#${normalizedAirport}` : '',
        ...topicTags.map((tag) => `#${tag.replace(/\s+/g, '')}`),
      ].filter(Boolean);
      const nextContent = structuredTags.length
        ? `${content.trim()}\n\n${structuredTags.join(' ')}`
        : content.trim();

      onPost(title, nextContent, category, isAnonymous, normalizedAirport || undefined, topicTags);
      setTitle('');
      setContent('');
      setAirportTag('');
      setTopicTags([]);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isVentPost ? 'New Vent' : 'New Post'}</Text>
            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={!title.trim() || !content.trim()}
            >
              <Text style={[
                styles.postText,
                (!title.trim() || !content.trim()) && styles.postTextDisabled
              ]}>Post</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Select Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {visibleCategories.map((cat) => (
                <TouchableOpacity 
                  key={cat.type}
                  style={[
                    styles.categoryChip,
                    category === cat.type && styles.categoryChipActive
                  ]}
                  onPress={() => setCategory(cat.type)}
                >
                   <Ionicons 
                    name={cat.icon as any} 
                    size={16} 
                    color={category === cat.type ? theme.colors.background : theme.colors.text} 
                  />
                  <Text style={[
                    styles.categoryLabel,
                    category === cat.type && styles.categoryLabelActive
                  ]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isVentPost ? (
              <View style={styles.ventContextCard}>
                <Ionicons name="flame-outline" size={18} color={theme.colors.error} />
                <View style={styles.ventContextCopy}>
                  <Text style={styles.ventContextTitle}>Venting Room selected</Text>
                  <Text style={styles.ventContextText}>
                    This post will stay in the Vent room and anonymous posting starts on by default.
                  </Text>
                </View>
              </View>
            ) : null}

            {channelContext && !isVentPost ? (
              <View style={styles.channelContextCard}>
                <Ionicons name={channelContext.icon} size={18} color={theme.colors.accent} />
                <View style={styles.ventContextCopy}>
                  <Text style={styles.ventContextTitle}>Posting in #{channelContext.label}</Text>
                  <Text style={styles.ventContextText}>{channelContext.description}</Text>
                </View>
              </View>
            ) : null}

            <TextInput
              style={styles.titleInput}
              placeholder="Post title"
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.contentInput}
              placeholder="Share the useful details crew will search for later..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={content}
              onChangeText={setContent}
            />

            <Text style={styles.label}>Organize this post</Text>
            <TextInput
              style={styles.airportInput}
              placeholder="Airport or base tag, like JFK, LAX, DFW"
              placeholderTextColor={theme.colors.textMuted}
              value={airportTag}
              onChangeText={setAirportTag}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.topicGrid}>
              {['Crash Pads', 'Reserve', 'Commuting', 'Hotels', 'Parking', 'Training', 'Deals', 'Safety'].map((tag) => {
                const active = topicTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.topicChip, active && styles.topicChipActive]}
                    onPress={() => toggleTopicTag(tag)}
                  >
                    <Text style={[styles.topicChipText, active && styles.topicChipTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="eye-off-outline" size={20} color={theme.colors.textMuted} />
                <View>
                  <Text style={styles.settingLabel}>Post Anonymously</Text>
                  <Text style={styles.settingSub}>Hide your name and airline role</Text>
                </View>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <TouchableOpacity style={styles.mediaBtn}>
              <Ionicons name="image-outline" size={24} color={theme.colors.accent} />
              <Text style={styles.mediaBtnText}>Add Photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background,
    height: '92%',
    borderTopLeftRadius: theme.roundness.lg,
    borderTopRightRadius: theme.roundness.lg,
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  postText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  postTextDisabled: {
    opacity: 0.5,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: theme.spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryLabel: {
    color: theme.colors.text,
    fontSize: 14,
  },
  categoryLabelActive: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  ventContextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
    backgroundColor: theme.colors.error + '10',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  channelContextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '40',
    backgroundColor: theme.colors.accent + '10',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  ventContextCopy: {
    flex: 1,
    gap: 3,
  },
  ventContextTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  ventContextText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  contentInput: {
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 130,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.lg,
  },
  airportInput: {
    height: 48,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  topicChip: {
    borderRadius: theme.roundness.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  topicChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  topicChipTextActive: {
    color: theme.colors.background,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.roundness.md,
    marginBottom: theme.spacing.lg,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.accent + '0D',
    padding: theme.spacing.md,
    borderRadius: theme.roundness.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.accent + '33',
    justifyContent: 'center',
  },
  mediaBtnText: {
    color: theme.colors.accent,
    fontWeight: 'bold',
  }
});
