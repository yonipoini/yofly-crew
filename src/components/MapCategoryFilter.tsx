import React from 'react';
import { Animated, ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { AppTheme, useTheme } from '../theme/theme';
import { LocationType } from '../types/locations';
import { Ionicons } from '@expo/vector-icons';

interface MapCategoryFilterProps {
  selectedType: LocationType | 'ALL';
  onSelectType: (type: LocationType | 'ALL') => void;
  counts?: Partial<Record<LocationType | 'ALL', number>>;
  title?: string;
  top?: number;
}

const CATEGORIES: Array<{
  type: LocationType | 'ALL';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  { type: 'ALL', icon: 'grid-outline', label: 'All' },
  { type: LocationType.RESTAURANT, icon: 'restaurant-outline', label: 'Dining' },
  { type: LocationType.COFFEE, icon: 'cafe-outline', label: 'Coffee' },
  { type: LocationType.GYM, icon: 'fitness-outline', label: 'Gyms' },
  { type: LocationType.SAFE_AREA, icon: 'shield-outline', label: 'Safe' },
  { type: LocationType.GROCERY, icon: 'cart-outline', label: 'Grocery' },
  { type: LocationType.PHARMACY, icon: 'medkit-outline', label: 'Pharmacy' },
  { type: LocationType.LOUNGE, icon: 'bed-outline', label: 'Rest' },
  { type: LocationType.NIGHTLIFE, icon: 'beer-outline', label: 'Bars' },
];

export const MapCategoryFilter: React.FC<MapCategoryFilterProps> = ({
  selectedType,
  onSelectType,
  counts,
  title = 'Radius Filter',
  top = 68,
}) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [isDark, theme]);
  const activeCategory = CATEGORIES.find((category) => category.type === selectedType)?.label || 'All';
  const panelOpacity = React.useRef(new Animated.Value(0)).current;
  const panelTranslateY = React.useRef(new Animated.Value(-10)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(panelTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelOpacity, panelTranslateY, selectedType]);

  return (
    <View style={[styles.container, { top }]}>
      <Animated.View
        style={[
          styles.panel,
          {
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{title}</Text>
          <Text style={styles.activeLabel}>{activeCategory}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {CATEGORIES.map((cat) => {
            const active = selectedType === cat.type;
            const count = counts?.[cat.type];

            return (
              <TouchableOpacity
                key={cat.type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelectType(cat.type)}
              >
                <Ionicons
                  name={cat.icon}
                  size={16}
                  color={active ? theme.colors.background : theme.colors.text}
                />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {cat.label}
                </Text>
                {typeof count === 'number' ? (
                  <View style={[styles.countPill, active && styles.countPillActive]}>
                    <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: AppTheme, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  panel: {
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.roundness.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: isDark ? 'rgba(14, 14, 14, 0.82)' : 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 10,
    shadowColor: theme.colors.overlay,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeLabel: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: theme.roundness.full,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  chipLabelActive: {
    color: theme.colors.background,
  },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countPillActive: {
    backgroundColor: theme.colors.background + '33',
    borderColor: theme.colors.background + '55',
  },
  countText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  countTextActive: {
    color: theme.colors.background,
  },
});
