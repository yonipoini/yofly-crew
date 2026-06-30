import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

type ScopedOptions = {
  userId?: string | null;
  migrateLegacy?: boolean;
};

const buildScopedKey = (baseKey: string, userId?: string | null) =>
  userId ? `${baseKey}:${userId}` : baseKey;

const getWebStorage = () => {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  return globalThis.localStorage;
};

const resolveUserId = async (userId?: string | null) => {
  if (userId !== undefined) {
    return userId;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (_error) {
    return null;
  }
};

export const UserScopedStorage = {
  async getItem(baseKey: string, options: ScopedOptions = {}) {
    const userId = await resolveUserId(options.userId);
    const scopedKey = buildScopedKey(baseKey, userId);
    const webStorage = getWebStorage();
    const webScopedValue = webStorage?.getItem(scopedKey);

    if (webScopedValue) {
      return webScopedValue;
    }

    const webBaseValue = webStorage?.getItem(baseKey);

    if (webBaseValue) {
      return webBaseValue;
    }

    const scopedValue = await AsyncStorage.getItem(scopedKey);

    if (scopedValue || !userId || options.migrateLegacy === false) {
      return scopedValue;
    }

    const legacyValue = await AsyncStorage.getItem(baseKey);
    if (legacyValue) {
      await AsyncStorage.setItem(scopedKey, legacyValue);
    }
    return legacyValue;
  },

  async setItem(baseKey: string, value: string, options: ScopedOptions = {}) {
    const userId = await resolveUserId(options.userId);
    const scopedKey = buildScopedKey(baseKey, userId);
    const webStorage = getWebStorage();

    webStorage?.setItem(scopedKey, value);
    webStorage?.setItem(baseKey, value);

    const storageKeys = await AsyncStorage.getAllKeys();
    const existingProfileKeys = storageKeys.filter((key) => key === baseKey || key.startsWith(`${baseKey}:`));

    if (existingProfileKeys.length > 0) {
      await AsyncStorage.multiSet(existingProfileKeys.map((key) => [key, value]));
    }

    await AsyncStorage.setItem(scopedKey, value);
    await AsyncStorage.setItem(baseKey, value);
  },

  async removeItem(baseKey: string, options: ScopedOptions = {}) {
    const userId = await resolveUserId(options.userId);
    const scopedKey = buildScopedKey(baseKey, userId);
    const webStorage = getWebStorage();

    webStorage?.removeItem(scopedKey);
    webStorage?.removeItem(baseKey);

    await AsyncStorage.removeItem(scopedKey);
  },
};
