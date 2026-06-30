import { supabase } from '../lib/supabase';
import { ListingCategory } from '../types/marketplace';
import { PostCategory } from '../types/community';

export type DashboardPostPreview = {
  id: string;
  title: string;
  category: PostCategory;
  createdAt: string;
};

export type DashboardListingPreview = {
  id: string;
  title: string;
  category: ListingCategory;
  airportCode: string;
  priceMonthly: number;
  createdAt: string;
};

export type DashboardSnapshot = {
  stats: {
    totalPosts: number;
    ventPosts: number;
    savedPosts: number;
    totalListings: number;
  };
  recentPosts: DashboardPostPreview[];
  recentListings: DashboardListingPreview[];
};

type PostPreviewRow = {
  id: string;
  title: string;
  type: PostCategory;
  created_at: string;
};

type ListingPreviewRow = {
  id: string;
  title: string;
  category: ListingCategory;
  airport_code: string;
  price_monthly: number;
  created_at: string;
};

const toPostPreview = (row: PostPreviewRow): DashboardPostPreview => ({
  id: row.id,
  title: row.title,
  category: row.type,
  createdAt: row.created_at,
});

const toListingPreview = (row: ListingPreviewRow): DashboardListingPreview => ({
  id: row.id,
  title: row.title,
  category: row.category,
  airportCode: row.airport_code,
  priceMonthly: row.price_monthly,
  createdAt: row.created_at,
});

export const DashboardService = {
  async getSnapshot(userId: string): Promise<DashboardSnapshot> {
    const [
      totalPostsResult,
      ventPostsResult,
      savedPostsResult,
      totalListingsResult,
      recentPostsResult,
      recentListingsResult,
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .eq('type', PostCategory.VENT),
      supabase.from('saved_posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('host_id', userId),
      supabase
        .from('posts')
        .select('id, title, type, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('listings')
        .select('id, title, category, airport_code, price_monthly, created_at')
        .eq('host_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (totalPostsResult.error) throw totalPostsResult.error;
    if (ventPostsResult.error) throw ventPostsResult.error;
    if (savedPostsResult.error) throw savedPostsResult.error;
    if (totalListingsResult.error) throw totalListingsResult.error;
    if (recentPostsResult.error) throw recentPostsResult.error;
    if (recentListingsResult.error) throw recentListingsResult.error;

    return {
      stats: {
        totalPosts: totalPostsResult.count || 0,
        ventPosts: ventPostsResult.count || 0,
        savedPosts: savedPostsResult.count || 0,
        totalListings: totalListingsResult.count || 0,
      },
      recentPosts: ((recentPostsResult.data || []) as PostPreviewRow[]).map(toPostPreview),
      recentListings: ((recentListingsResult.data || []) as ListingPreviewRow[]).map(toListingPreview),
    };
  },
};
