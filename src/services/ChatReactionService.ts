import { MessageReaction } from '../types/chat';
import { supabase } from '../lib/supabase';
import { getSignedInUserId, shouldFallbackToLocalPersistence } from './RemotePersistenceSupport';
import { UserScopedStorage } from './UserScopedStorage';

const STORAGE_KEY = 'yofly.chat.message-reactions';
const REACTION_EMOJIS = ['👍', '🔥', '🛫'] as const;

type ReactionStore = Record<string, Record<string, string[]>>;

const readStore = async (): Promise<ReactionStore> => {
  try {
    const raw = await UserScopedStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as ReactionStore;
  } catch (error) {
    console.warn('Failed to load chat reactions:', error);
    return {};
  }
};

const writeStore = async (store: ReactionStore) => {
  try {
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Failed to persist chat reactions:', error);
  }
};

const toReactionList = (messageId: string, userId: string, store: ReactionStore): MessageReaction[] =>
  REACTION_EMOJIS.map((emoji) => {
    const users = store[messageId]?.[emoji] || [];
    return {
      emoji,
      count: users.length,
      isMine: users.includes(userId),
    };
  }).filter((reaction) => reaction.count > 0 || reaction.isMine);

const syncLocalUserReactionsToRemote = async (messageId: string, userId: string, store: ReactionStore) => {
  const localEmojis = Object.entries(store[messageId] || {})
    .filter(([, users]) => users.includes(userId))
    .map(([emoji]) => emoji);

  const { data, error } = await supabase
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const remoteEmojis = new Set((data || []).map((row) => String(row.emoji || '')));
  const localEmojiSet = new Set(localEmojis);
  const emojisToInsert = localEmojis.filter((emoji) => !remoteEmojis.has(emoji));
  const emojisToDelete = [...remoteEmojis].filter((emoji) => !localEmojiSet.has(emoji));

  if (emojisToInsert.length > 0) {
    const { error: insertError } = await supabase.from('message_reactions').upsert(
      emojisToInsert.map((emoji) => ({
        message_id: messageId,
        user_id: userId,
        emoji,
      })),
      { onConflict: 'message_id,user_id,emoji' }
    );

    if (insertError) {
      throw insertError;
    }
  }

  if (emojisToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .in('emoji', emojisToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }
};

export const ChatReactionService = {
  async getReactions(messageId: string, userId: string) {
    const localStore = await readStore();

    try {
      await syncLocalUserReactionsToRemote(messageId, userId, localStore);

      const { data, error } = await supabase
        .from('message_reactions')
        .select('emoji, user_id')
        .eq('message_id', messageId);

      if (error) {
        throw error;
      }

      const store: ReactionStore = {
        [messageId]: {},
      };

      (data || []).forEach((row) => {
        const emoji = String(row.emoji || '');
        const reactionUserId = String(row.user_id || '');
        if (!emoji || !reactionUserId) {
          return;
        }

        store[messageId][emoji] = [...(store[messageId][emoji] || []), reactionUserId];
      });

      await writeStore({
        ...localStore,
        ...store,
      });

      return toReactionList(messageId, userId, store);
    } catch (error) {
      if (!shouldFallbackToLocalPersistence(error)) {
        console.warn('Failed to load remote chat reactions:', error);
      }
      return toReactionList(messageId, userId, localStore);
    }
  },

  async toggleReaction(messageId: string, emoji: string, userId: string) {
    const store = await readStore();
    const messageEntry = store[messageId] || {};
    const users = new Set(messageEntry[emoji] || []);

    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }

    store[messageId] = {
      ...messageEntry,
      [emoji]: [...users],
    };

    await writeStore(store);
    const currentUserId = await getSignedInUserId();

    if (currentUserId) {
      try {
        if (users.has(userId)) {
          const { error } = await supabase.from('message_reactions').upsert({
            message_id: messageId,
            user_id: userId,
            emoji,
          }, {
            onConflict: 'message_id,user_id,emoji',
          });

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', userId)
            .eq('emoji', emoji);

          if (error) {
            throw error;
          }
        }
      } catch (error) {
        if (!shouldFallbackToLocalPersistence(error)) {
          console.warn('Failed to persist remote chat reaction:', error);
        }
      }
    }

    return toReactionList(messageId, userId, store);
  },
};
