import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useTheme } from '../../src/theme/theme';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useUnreadNotificationCount } from '../../src/hooks/useUnreadNotificationCount';

const VENT_RED = '#ff2f3a';
const VENT_RED_ACTIVE = '#ff1f2f';

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useUnreadNotificationCount(user?.id);
  const unreadBadge = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          marginTop: 1,
        },
        tabBarAllowFontScaling: false,
        tabBarLabelPosition: 'below-icon',
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingTop: 5,
          minWidth: 0,
          alignItems: 'center',
        },
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#050505',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 72,
          paddingBottom: 12,
          paddingTop: 4,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Intel',
          tabBarBadge: unreadBadge,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vent"
        options={{
          title: 'Vent',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.ventTabButton, focused && styles.ventTabButtonFocused]}>
              <Ionicons name={focused ? 'flame' : 'flame-outline'} size={23} color="#050505" />
              <Text style={styles.ventTabText}>Vent</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarLabel: ({ focused, color }) => (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              allowFontScaling={false}
              style={[styles.communityTabLabel, { color }, focused && styles.communityTabLabelFocused]}
            >
              Community
            </Text>
          ),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  ventTabButton: {
    width: 62,
    height: 54,
    marginTop: -18,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VENT_RED,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: VENT_RED,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  ventTabButtonFocused: {
    backgroundColor: VENT_RED_ACTIVE,
  },
  ventTabText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '900',
    marginTop: -1,
  },
  communityTabLabel: {
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '800',
    marginTop: -3,
  },
  communityTabLabelFocused: {
    fontWeight: '900',
  },
});
