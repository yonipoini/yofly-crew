import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ProfileState } from '../context/ProfileContext';
import { supabase } from '../lib/supabase';
import { UserScopedStorage } from './UserScopedStorage';

const STORAGE_KEY = 'yofly.ops.push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;

const buildSubscriptionPayload = (userId: string, profile: ProfileState, expoPushToken: string) => ({
  user_id: userId,
  expo_push_token: expoPushToken,
  platform: Platform.OS,
  active_airport: profile.preferences.activeOpsAirport || profile.baseAirport,
  saved_airports: profile.preferences.favoriteAirports,
  preferred_airlines: profile.preferences.preferredAirlines,
  role_label: profile.roleLabel,
  verified_crew: profile.verifiedCrew,
  intel_push: profile.preferences.intelPush,
  ops_push: profile.preferences.opsPush,
  daily_digest: profile.preferences.dailyDigest,
  updated_at: new Date().toISOString(),
});

export const NotificationService = {
  async syncBadgeCount(unreadCount: number) {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
    } catch (error) {
      console.warn('Failed to sync app badge count:', error);
    }
  },

  async registerForOpsPush(userId: string, profile: ProfileState): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('Push registration skipped: missing EAS projectId in app config.');
      return null;
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let permission = existingPermission;

    if (!existingPermission.granted && existingPermission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }

    if (!permission.granted) {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ops-alerts', {
        name: 'Ops Alerts',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await UserScopedStorage.setItem(STORAGE_KEY, pushToken, { userId });
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert(buildSubscriptionPayload(userId, profile, pushToken), {
        onConflict: 'expo_push_token',
      });

    if (error) {
      throw error;
    }

    return pushToken;
  },

  async syncExistingSubscription(userId: string, profile: ProfileState) {
    const existingToken = await UserScopedStorage.getItem(STORAGE_KEY, { userId });
    if (!existingToken) {
      return;
    }

    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert(buildSubscriptionPayload(userId, profile, existingToken), {
        onConflict: 'expo_push_token',
      });

    if (error) {
      throw error;
    }
  },
};
