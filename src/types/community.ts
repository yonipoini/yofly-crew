export enum PostCategory {
  NEWS = 'NEWS',
  QUESTION = 'QUESTION',
  STORY = 'STORY',
  DEAL = 'DEAL',
  VENT = 'VENT',
  TIP = 'TIP',
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'PILOT' | 'FA' | 'DISPATCH' | 'GROUND';
  category: PostCategory;
  airportCode?: string;
  topicTags: string[];
  postScope?: 'GLOBAL' | 'LOCAL' | 'BASE' | 'TRIP';
  title: string;
  content: string;
  imageUrl?: string;
  authorAvatar?: string;
  upvotes: number;
  commentCount: number;
  createdAt: string; // ISO string
  isAnonymous?: boolean;
  isUpvoted?: boolean;
  isSaved?: boolean;
}

export interface CreateCommunityPostInput {
  title: string;
  content: string;
  category: PostCategory;
  isAnonymous: boolean;
  airportCode?: string;
  topicTags?: string[];
  postScope?: 'GLOBAL' | 'LOCAL' | 'BASE' | 'TRIP';
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: 'PILOT' | 'FA' | 'DISPATCH' | 'GROUND';
  content: string;
  createdAt: string;
}
