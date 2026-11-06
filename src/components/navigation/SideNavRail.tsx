import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { AppTheme, useTheme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';

const VENT_RED = '#ff2f3a';

export interface NavTabItem {
  name: string;
  route: '/(tabs)' | '/(tabs)/map' | '/(tabs)/alerts' | '/(tabs)/vent' | '/(tabs)/marketplace' | '/(tabs)/community' | '/(tabs)/profile';
  title: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  isSpecial?: boolean;
}

const TAB_ITEMS: NavTabItem[] = [
  {
    name: 'index',
    route: '/(tabs)',
    title: 'Home',
    iconActive: 'home',
    iconInactive: 'home-outline',
  },
  {
    name: 'map',
    route: '/(tabs)/map',
    title: 'Map',
    iconActive: 'map',
    iconInactive: 'map-outline',
  },
  {
    name: 'alerts',
    route: '/(tabs)/alerts',
    title: 'Intel',
    iconActive: 'radio',
    iconInactive: 'radio-outline',
  },
  {
    name: 'vent',
    route: '/(tabs)/vent',
    title: 'Vent',
    iconActive: 'flame',
    iconInactive: 'flame-outline',
    isSpecial: true,
  },
  {
    name: 'marketplace',
    route: '/(tabs)/marketplace',
    title: 'Market',
    iconActive: 'cart',
    iconInactive: 'cart-outline',
  },
  {
    name: 'community',
    route: '/(tabs)/community',
    title: 'Community',
    iconActive: 'people',
    iconInactive: 'people-outline',
  },
  {
    name: 'profile',
    route: '/(tabs)/profile',
    title: 'Profile',
    iconActive: 'person',
    iconInactive: 'person-outline',
  },
];

interface SideNavRailProps {
  currentTabName?: string;
  onTabPress?: (name: string) => void;
  width?: number;
}

export function SideNavRail({ currentTabName, onTabPress, width = 84 }: SideNavRailProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { unreadCount } = useUnreadNotificationCount(user?.id);
  const router = useRouter();
  const pathname = usePathname();

  const getIsActive = (item: NavTabItem) => {
    if (currentTabName) {
      return currentTabName === item.name;
    }
    if (item.name === 'index') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    return pathname.includes(item.name);
  };

  const handlePress = (item: NavTabItem) => {
    if (onTabPress) {
      onTabPress(item.name);
    } else {
      router.navigate(item.route);
    }
  };

  return (
    <View style={[styles.container, { width, paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050505' }]} />
      )}

      {/* Brand Header */}
      <View style={styles.header}>
        <View style={[styles.brandLogoWrap, { borderColor: theme.colors.accent }]}>
          <Ionicons name="airplane" size={18} color={theme.colors.accent} />
        </View>
        <Text style={[styles.brandTitle, { color: theme.colors.text }]}>YOFLY</Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.tabList}>
        {TAB_ITEMS.map((item) => {
          const active = getIsActive(item);
          const isVent = item.isSpecial;

          if (isVent) {
            return (
              <TouchableOpacity
                key={item.name}
                style={[
                  styles.ventItem,
                  active && styles.ventItemActive,
                ]}
                activeOpacity={0.8}
                onPress={() => handlePress(item)}
              >
                <Ionicons name={active ? item.iconActive : item.iconInactive} size={22} color="#050505" />
                <Text style={styles.ventItemText}>{item.title}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.tabItem,
                active && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
              ]}
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
            >
              {active && <View style={[styles.activeIndicator, { backgroundColor: theme.colors.accent }]} />}
              <View style={styles.iconContainer}>
                <Ionicons
                  name={active ? item.iconActive : item.iconInactive}
                  size={21}
                  color={active ? theme.colors.accent : theme.colors.textMuted}
                />
                {item.name === 'alerts' && unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? theme.colors.text : theme.colors.textMuted },
                  active && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer / Airport Status */}
      <View style={styles.footer}>
        <View style={[styles.airportBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
          <Text style={[styles.airportText, { color: theme.colors.accent }]}>
            {profile.baseAirport || 'CREW'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  brandLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  tabList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 6,
  },
  tabItem: {
    width: '100%',
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 2,
  },
  activeIndicator: {
    position: 'absolute',
    left: 2,
    top: '25%',
    bottom: '25%',
    width: 3,
    borderRadius: 2,
  },
  iconContainer: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  ventItem: {
    width: 58,
    height: 50,
    borderRadius: 16,
    backgroundColor: VENT_RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: VENT_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  ventItemActive: {
    transform: [{ scale: 1.05 }],
    borderColor: '#ffffff',
  },
  ventItemText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#050505',
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  airportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  airportText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

