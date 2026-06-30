import { supabase } from '../lib/supabase';
import { CreateCommunityPostInput, Post, PostCategory, PostComment } from '../types/community';
import { CrewAccessService } from './CrewAccessService';

type PostRow = {
  id: string;
  author_id: string;
  type: PostCategory;
  title: string;
  content: string;
  airport_code?: string | null;
  topic_tags?: string[] | null;
  post_scope?: Post['postScope'] | null;
  metadata?: Record<string, unknown> | null;
  is_anonymous: boolean;
  like_count: number | null;
  comment_count: number | null;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    role?: string | null;
    avatar_url?: string | null;
  } | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    role?: string | null;
  } | null;
};

const normalizeRole = (role?: string | null): Post['authorRole'] => {
  if (role === 'PILOT' || role === 'FA' || role === 'DISPATCH' || role === 'GROUND') {
    return role;
  }

  return 'GROUND';
};

const mapPostRow = (
  row: PostRow,
  viewerState: { upvotedPostIds: Set<string>; savedPostIds: Set<string> }
): Post => ({
  id: row.id,
  category: row.type as PostCategory,
  airportCode: row.airport_code || getFallbackAirportCode(row.content),
  topicTags:
    Array.isArray(row.topic_tags) && row.topic_tags.length > 0
      ? row.topic_tags
      : getFallbackTopicTags(row.content),
  postScope: row.post_scope || undefined,
  title: row.title,
  content: row.content,
  authorId: row.author_id,
  authorName: row.is_anonymous ? 'Anonymous Crew' : row.profiles?.full_name || 'Crew Member',
  authorRole: row.is_anonymous ? 'GROUND' : normalizeRole(row.profiles?.role),
  authorAvatar: row.is_anonymous ? undefined : row.profiles?.avatar_url || undefined,
  createdAt: row.created_at,
  upvotes: row.like_count || 0,
  commentCount: row.comment_count || 0,
  isAnonymous: row.is_anonymous,
  isUpvoted: viewerState.upvotedPostIds.has(row.id),
  isSaved: viewerState.savedPostIds.has(row.id),
});

const mapCommentRow = (row: CommentRow): PostComment => ({
  id: row.id,
  postId: row.post_id,
  authorId: row.author_id,
  authorName: row.profiles?.full_name || 'Crew Member',
  authorRole: normalizeRole(row.profiles?.role),
  content: row.content,
  createdAt: row.created_at,
});

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const MISSING_TABLE_ERROR_CODES = new Set(['42P01', 'PGRST205']);
const MISSING_COLUMN_ERROR_CODES = new Set(['42703', 'PGRST204']);

const isMissingTableError = (error: { code?: string } | null | undefined) =>
  typeof error?.code === 'string' && MISSING_TABLE_ERROR_CODES.has(error.code);

const isMissingStructuredPostColumnError = (error: { code?: string; message?: string } | null | undefined) =>
  (typeof error?.code === 'string' && MISSING_COLUMN_ERROR_CODES.has(error.code)) ||
  /airport_code|topic_tags|post_scope|metadata/i.test(error?.message || '');

const getHashtagTags = (content: string) =>
  Array.from(new Set((content.match(/#[A-Za-z0-9_]+/g) || []).map((tag) => tag.replace('#', ''))));

const getFallbackAirportCode = (content: string) => {
  const match = getHashtagTags(content).find((tag) => /^[A-Za-z]{3}$/.test(tag));
  return match?.toUpperCase();
};

const getFallbackTopicTags = (content: string) =>
  getHashtagTags(content)
    .filter((tag) => !/^[A-Za-z]{3}$/.test(tag))
    .map((tag) => tag.replace(/([a-z])([A-Z])/g, '$1 $2'));

export const CommunityService = {
  async getViewerState(userId?: string) {
    if (!userId) {
      return {
        upvotedPostIds: new Set<string>(),
        savedPostIds: new Set<string>(),
      };
    }

    const [votesResult, savesResult] = await Promise.all([
      supabase.from('post_votes').select('post_id').eq('user_id', userId),
      supabase.from('saved_posts').select('post_id').eq('user_id', userId),
    ]);

    if (votesResult.error) {
      console.warn('Error fetching post votes:', votesResult.error);
    }

    if (savesResult.error) {
      console.warn('Error fetching saved posts:', savesResult.error);
    }

    return {
      upvotedPostIds: new Set((votesResult.data || []).map((row) => row.post_id as string)),
      savedPostIds: new Set((savesResult.data || []).map((row) => row.post_id as string)),
    };
  },

  /**
   * Fetch latest posts
   */
  async getPosts(category?: PostCategory, userId?: string): Promise<Post[]> {
    let query = supabase
      .from('posts')
      .select('*, profiles(full_name, role, avatar_url)')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('type', category);
    }

    const [{ data, error }, viewerState] = await Promise.all([query, this.getViewerState(userId)]);

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase posts table unavailable, showing an empty community feed:'
          : 'Post feed fetch failed:',
        error
      );
      return [];
    }

    return ((data || []) as PostRow[]).map((row) => mapPostRow(row, viewerState));
  },

  async getPostById(postId: string, userId?: string): Promise<Post | null> {
    if (!isValidUuid(postId)) {
      return null;
    }

    const [{ data, error }, viewerState] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles(full_name, role, avatar_url)')
        .eq('id', postId)
        .maybeSingle(),
      this.getViewerState(userId),
    ]);

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase posts table unavailable while loading post detail:'
          : 'Post detail fetch failed:',
        error
      );
      return null;
    }

    if (!data) {
      return null;
    }

    return mapPostRow(data as PostRow, viewerState);
  },

  async getComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, profiles(full_name, role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn(
        isMissingTableError(error)
          ? 'Supabase comments table unavailable, showing no comments:'
          : 'Post comments fetch failed:',
        error
      );
      return [];
    }

    return ((data || []) as CommentRow[]).map(mapCommentRow);
  },

  async refreshPostCounts(postId: string) {
    const [voteCountResult, commentCountResult] = await Promise.all([
      supabase.from('post_votes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    ]);

    if (voteCountResult.error) {
      throw voteCountResult.error;
    }

    if (commentCountResult.error) {
      throw commentCountResult.error;
    }

    const likeCount = voteCountResult.count || 0;
    const commentCount = commentCountResult.count || 0;

    const { error } = await supabase
      .from('posts')
      .update({
        like_count: likeCount,
        comment_count: commentCount,
      })
      .eq('id', postId);

    if (error) {
      throw error;
    }

    return { likeCount, commentCount };
  },

  /**
   * Create a new post
   */
  async createPost(post: CreateCommunityPostInput): Promise<Post> {
    const user = await CrewAccessService.requireVerifiedCrew();
    const structuredInsert = {
      author_id: user.id,
      type: post.category,
      title: post.title,
      content: post.content,
      is_anonymous: post.isAnonymous,
      airport_code: post.airportCode?.trim().toUpperCase() || null,
      topic_tags: post.topicTags || [],
      post_scope: post.postScope || (post.airportCode ? 'LOCAL' : 'GLOBAL'),
      metadata: {
        source: 'crew-community',
        createdVia: 'mobile-composer',
      },
    };

    let { data, error } = await supabase
      .from('posts')
      .insert(structuredInsert)
      .select('*, profiles(full_name, role, avatar_url)')
      .single();

    if (error && isMissingStructuredPostColumnError(error)) {
      const fallbackResult = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          type: post.category,
          title: post.title,
          content: post.content,
          is_anonymous: post.isAnonymous,
        })
        .select('*, profiles(full_name, role, avatar_url)')
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) throw error;

    return mapPostRow(data as PostRow, {
      upvotedPostIds: new Set<string>(),
      savedPostIds: new Set<string>(),
    });
  },

  async createComment(postId: string, content: string): Promise<PostComment> {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content,
      })
      .select('*, profiles(full_name, role)')
      .single();

    if (error) {
      throw error;
    }

    await this.refreshPostCounts(postId);
    return mapCommentRow(data as CommentRow);
  },

  async deleteComment(commentId: string, postId: string) {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', user.id);

    if (error) {
      throw error;
    }

    const counts = await this.refreshPostCounts(postId);
    return counts;
  },

  async updatePost(postId: string, params: { title: string; content: string }) {
    const user = await CrewAccessService.requireVerifiedCrew();

    const { data, error } = await supabase
      .from('posts')
      .update({
        title: params.title,
        content: params.content,
      })
      .eq('id', postId)
      .eq('author_id', user.id)
      .select('*, profiles(full_name, role, avatar_url)')
      .single();

    if (error) {
      throw error;
    }

    return mapPostRow(data as PostRow, await this.getViewerState(user.id));
  },

  async deletePost(postId: string) {
    const user = await CrewAccessService.requireVerifiedCrew();

    await supabase.from('post_comments').delete().eq('post_id', postId);
    await supabase.from('post_votes').delete().eq('post_id', postId);
    await supabase.from('saved_posts').delete().eq('post_id', postId);

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', user.id);

    if (error) {
      throw error;
    }
  },

  async toggleUpvote(postId: string, isUpvoted: boolean) {
    const user = await CrewAccessService.requireVerifiedCrew();

    if (isUpvoted) {
      const { error } = await supabase
        .from('post_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('post_votes')
        .upsert(
          {
            post_id: postId,
            user_id: user.id,
          },
          {
            onConflict: 'post_id,user_id',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        throw error;
      }
    }

    const counts = await this.refreshPostCounts(postId);

    return {
      isUpvoted: !isUpvoted,
      upvotes: counts.likeCount,
    };
  },

  async toggleSaved(postId: string, isSaved: boolean) {
    const user = await CrewAccessService.requireVerifiedCrew();

    if (isSaved) {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('saved_posts')
        .upsert(
          {
            post_id: postId,
            user_id: user.id,
          },
          {
            onConflict: 'post_id,user_id',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        throw error;
      }
    }

    return {
      isSaved: !isSaved,
    };
  }
};
