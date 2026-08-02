import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const BLOCKLIST_STORAGE_KEY = 'yofly_blocked_users';

class ModerationServiceClass {
  private blockedUserIds: Set<string> = new Set();

  /**
   * Initialize and load the blocked user list from cache and DB
   */
  async init() {
    try {
      // 1. Load from AsyncStorage for immediate availability
      const cached = await AsyncStorage.getItem(BLOCKLIST_STORAGE_KEY);
      if (cached) {
        const ids: string[] = JSON.parse(cached);
        this.blockedUserIds = new Set(ids);
      }

      // 2. Fetch fresh list from Supabase if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.syncBlockListWithDb(user.id);
      }
    } catch (error) {
      console.warn('[ModerationService] Initialization failed:', error);
    }
  }

  /**
   * Syncs blocks with database and updates cache
   */
  async syncBlockListWithDb(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) throw error;

      const ids = (data || []).map((row: any) => row.blocked_id);
      this.blockedUserIds = new Set(ids);
      await AsyncStorage.setItem(BLOCKLIST_STORAGE_KEY, JSON.stringify(ids));
      return ids;
    } catch (error) {
      console.warn('[ModerationService] DB Sync failed:', error);
      return Array.from(this.blockedUserIds);
    }
  }

  /**
   * Block a user
   */
  async blockUser(blockedId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to block a user.');

    if (user.id === blockedId) throw new Error('You cannot block yourself.');

    // Optimistic local update
    this.blockedUserIds.add(blockedId);
    await AsyncStorage.setItem(
      BLOCKLIST_STORAGE_KEY,
      JSON.stringify(Array.from(this.blockedUserIds))
    );

    // Save to database
    const { error } = await supabase.from('user_blocks').insert({
      blocker_id: user.id,
      blocked_id: blockedId,
    });

    if (error && !error.message.includes('unique constraint')) {
      // Rollback local update if actual insert failed
      this.blockedUserIds.delete(blockedId);
      await AsyncStorage.setItem(
        BLOCKLIST_STORAGE_KEY,
        JSON.stringify(Array.from(this.blockedUserIds))
      );
      throw error;
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockedId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to unblock a user.');

    // Optimistic local update
    this.blockedUserIds.delete(blockedId);
    await AsyncStorage.setItem(
      BLOCKLIST_STORAGE_KEY,
      JSON.stringify(Array.from(this.blockedUserIds))
    );

    // Delete from database
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);

    if (error) {
      // Rollback
      this.blockedUserIds.add(blockedId);
      await AsyncStorage.setItem(
        BLOCKLIST_STORAGE_KEY,
        JSON.stringify(Array.from(this.blockedUserIds))
      );
      throw error;
    }
  }

  /**
   * Submit an objectionable content report
   */
  async reportContent(
    contentType: 'POST' | 'COMMENT' | 'MESSAGE' | 'LISTING',
    targetId: string,
    reason: string,
    notes?: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to report content.');

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      content_type: contentType,
      target_id: targetId,
      reason,
      notes: notes || '',
    });

    if (error) throw error;
  }

  /**
   * Synchronously check if a user is blocked
   */
  isUserBlockedSync(userId: string): boolean {
    return this.blockedUserIds.has(userId);
  }

  /**
   * Synchronously retrieve all blocked user IDs
   */
  getBlockedUserIdsSync(): string[] {
    return Array.from(this.blockedUserIds);
  }

  /**
   * Clear the local blocklist (on logout)
   */
  async clear() {
    this.blockedUserIds.clear();
    await AsyncStorage.removeItem(BLOCKLIST_STORAGE_KEY);
  }
}

export const ModerationService = new ModerationServiceClass();
