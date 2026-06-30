import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  ScrollView,
  SectionList,
  Keyboard,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LEVEL_OPTIONS = [
  { id: 'ALL' as const, label: 'All Levels', icon: 'layers-outline' as const },
  { id: '3' as const, label: 'Level 3', icon: 'chevron-up-circle-outline' as const },
  { id: '2' as const, label: 'Level 2', icon: 'chevron-forward-circle-outline' as const },
  { id: '1' as const, label: 'Level 1', icon: 'chevron-down-circle-outline' as const },
  { id: 'B' as const, label: 'Level B', icon: 'arrow-down-circle-outline' as const },
];

const matchLevel = (levelStr: string, filter: '1' | '2' | '3' | 'B'): boolean => {
  const norm = levelStr.toLowerCase();
  if (filter === '3') {
    return norm.includes('3') || norm.includes('departures') || norm.includes('ticketing') || norm.includes('lobby') || norm.includes('level 3');
  }
  if (filter === '2') {
    return norm.includes('2') || norm.includes('arrivals') || norm.includes('baggage') || norm.includes('level 2');
  }
  if (filter === '1') {
    return norm.includes('1') || norm.includes('ground') || norm.includes('curb') || norm.includes('shuttle') || norm.includes('transit') || norm.includes('level 1');
  }
  if (filter === 'B') {
    return norm.includes('b') || norm.includes('tunnel') || norm.includes('train') || norm.includes('basement') || norm.includes('lower') || norm.includes('level b');
  }
  return false;
};

export interface DirectoryEntry {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  level?: string;
  zone?: string;
  crewNote?: string;
  sourceLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  location?: any;
}

interface MapDirectorySheetProps {
  theme: AppTheme;
  activeAirportCode: string;
  directorySummaryCount: number;
  isDirectoryExpanded: boolean;
  setIsDirectoryExpanded: (expanded: boolean) => void;
  directorySearchQuery: string;
  setDirectorySearchQuery: (query: string) => void;
  selectedDirectoryCategory: any;
  setSelectedDirectoryCategory: (category: any) => void;
  selectedDirectoryEntry: DirectoryEntry | null;
  setSelectedDirectoryEntry: (entry: DirectoryEntry | null) => void;
  isRefreshingDirectoryBusinesses: boolean;
  handleRefreshDirectoryBusinesses: () => void;
  directoryEntries: DirectoryEntry[];
  handleSelectDirectoryEntry: (entry: DirectoryEntry) => void;
  DIRECTORY_CATEGORIES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  bottomInset?: number;
  selectedFloorLevel: string;
  setSelectedFloorLevel: (level: string) => void;
  onReportIntelPress: () => void;
}

const getWayfindingTag = (entry: DirectoryEntry) => {
  const zone = (entry.zone || '').toUpperCase();
  const title = entry.title.toUpperCase();
  const meta = (entry.meta || '').toUpperCase();

  if (title.includes('KCM')) {
    return { text: 'KCM', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)' }; // Neon Yellow
  }
  if (meta.includes('SECURITY') || title.includes('SECURITY') || title.includes('CHECKPOINT')) {
    return { text: 'SEC', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' }; // Red
  }
  if (zone.includes('TERMINAL C') || zone.includes('TERM C') || zone.includes('TC') || zone.includes('T-C')) {
    return { text: 'TERM C', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' }; // Pink
  }
  if (zone.includes('TERMINAL B') || zone.includes('TERM B') || zone.includes('TB') || zone.includes('T-B')) {
    return { text: 'TERM B', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' }; // Green
  }
  if (zone.includes('TERMINAL A') || zone.includes('TERM A') || zone.includes('TA') || zone.includes('T-A')) {
    return { text: 'TERM A', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' }; // Blue
  }
  if (zone.includes('GATE') || zone.includes('CONCOURSE')) {
    return { text: 'GATES', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' }; // Purple
  }
  if (zone.includes('GROUND') || zone.includes('SHUTTLE') || zone.includes('BUS')) {
    return { text: 'TRANSIT', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' }; // Cyan
  }
  if (entry.level) {
    return { text: entry.level.toUpperCase(), color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' };
  }
  return { text: meta || 'SPOT', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' };
};

const getIconTheme = (entry: DirectoryEntry) => {
  const meta = (entry.meta || '').toUpperCase();
  const icon = entry.icon;

  if (icon === 'scan-outline' || meta.includes('SECURITY')) {
    return { bg: '#EAB308', iconColor: '#000000' };
  }
  if (icon === 'cafe-outline' || meta.includes('COFFEE')) {
    return { bg: '#D97706', iconColor: '#FFFFFF' };
  }
  if (icon === 'restaurant-outline' || meta.includes('FOOD') || meta.includes('DINING')) {
    return { bg: '#F97316', iconColor: '#FFFFFF' };
  }
  if (icon === 'bed-outline' || meta.includes('LOUNGE')) {
    return { bg: '#6366F1', iconColor: '#FFFFFF' };
  }
  if (icon === 'bus-outline' || icon === 'car-outline' || meta.includes('TRANSPORT') || meta.includes('GROUND')) {
    return { bg: '#0EA5E9', iconColor: '#FFFFFF' };
  }
  if (icon === 'briefcase-outline' || meta.includes('BAGGAGE')) {
    return { bg: '#4B5563', iconColor: '#FFFFFF' };
  }
  if (icon === 'cart-outline' || meta.includes('SHOPS') || meta.includes('RETAIL')) {
    return { bg: '#EC4899', iconColor: '#FFFFFF' };
  }
  return { bg: '#10B981', iconColor: '#FFFFFF' };
};

export function MapDirectorySheet({
  theme,
  activeAirportCode,
  directorySummaryCount,
  isDirectoryExpanded,
  setIsDirectoryExpanded,
  directorySearchQuery,
  setDirectorySearchQuery,
  selectedDirectoryCategory,
  setSelectedDirectoryCategory,
  selectedDirectoryEntry,
  setSelectedDirectoryEntry,
  isRefreshingDirectoryBusinesses,
  handleRefreshDirectoryBusinesses,
  directoryEntries,
  handleSelectDirectoryEntry,
  DIRECTORY_CATEGORIES,
  bottomInset = 0,
  selectedFloorLevel,
  setSelectedFloorLevel,
  onReportIntelPress,
}: MapDirectorySheetProps) {
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  const selectedLevel = useMemo(() => {
    if (selectedFloorLevel === 'TUNNEL') return 'B';
    if (['1', '2', '3', 'B', 'ALL'].includes(selectedFloorLevel)) return selectedFloorLevel as 'ALL' | '1' | '2' | '3' | 'B';
    return 'ALL';
  }, [selectedFloorLevel]);

  const handleSelectLevel = (lvl: 'ALL' | '1' | '2' | '3' | 'B') => {
    const parentLvl = lvl === 'B' ? 'TUNNEL' : lvl;
    setSelectedFloorLevel(parentLvl);
    setSelectedDirectoryEntry(null);
  };

  // Height of the sheet in different states
  const PEEK_HEIGHT = 110;
  const HALF_HEIGHT = SCREEN_HEIGHT * 0.62;
  const FULL_HEIGHT = SCREEN_HEIGHT - (Platform.OS === 'ios' ? 90 : 70);

  // Animated value for translateY
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT - PEEK_HEIGHT)).current;
  const currentHeight = useRef(PEEK_HEIGHT);

  // Animate to height helper
  const animateTo = (targetHeight: number, callback?: () => void) => {
    currentHeight.current = targetHeight;
    Animated.spring(translateY, {
      toValue: SCREEN_HEIGHT - targetHeight - bottomInset,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start(() => {
      callback?.();
    });
  };

  // Keyboard adjustment
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      if (currentHeight.current === HALF_HEIGHT) {
        animateTo(FULL_HEIGHT - e.endCoordinates.height + 40);
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isDirectoryExpanded) {
        animateTo(HALF_HEIGHT);
      }
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isDirectoryExpanded]);

  // Sync state with animations
  useEffect(() => {
    if (isDirectoryExpanded) {
      if (currentHeight.current !== FULL_HEIGHT && currentHeight.current !== HALF_HEIGHT) {
        animateTo(HALF_HEIGHT);
      }
    } else {
      animateTo(PEEK_HEIGHT);
    }
  }, [isDirectoryExpanded]);

  // PanResponder to handle drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only drag if the movement is vertical
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        translateY.setOffset((translateY as any)._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Drag sheet with limits
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        
        // Detect a tap on the drag handle area
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.vy) < 0.1) {
          setIsDirectoryExpanded(!isDirectoryExpanded);
          return;
        }

        // Calculate where to snap based on drag velocity and position
        const currentTranslation = (translateY as any)._value;
        const currentTargetY = SCREEN_HEIGHT - currentHeight.current - bottomInset;
        const actualY = currentTargetY + gestureState.dy;

        // Snapping thresholds
        const thresholdPeek = SCREEN_HEIGHT - PEEK_HEIGHT - bottomInset;
        const thresholdHalf = SCREEN_HEIGHT - HALF_HEIGHT - bottomInset;
        const thresholdFull = SCREEN_HEIGHT - FULL_HEIGHT - bottomInset;

        let finalHeight = PEEK_HEIGHT;

        if (gestureState.vy < -0.5) {
          // Fast swipe up
          if (currentHeight.current === PEEK_HEIGHT) {
            finalHeight = HALF_HEIGHT;
            setIsDirectoryExpanded(true);
          } else {
            finalHeight = FULL_HEIGHT;
            setIsDirectoryExpanded(true);
          }
        } else if (gestureState.vy > 0.5) {
          // Fast swipe down
          if (currentHeight.current === FULL_HEIGHT) {
            finalHeight = HALF_HEIGHT;
            setIsDirectoryExpanded(true);
          } else {
            finalHeight = PEEK_HEIGHT;
            setIsDirectoryExpanded(false);
          }
        } else {
          // Slow drag - snap to closest point
          const distToPeek = Math.abs(actualY - thresholdPeek);
          const distToHalf = Math.abs(actualY - thresholdHalf);
          const distToFull = Math.abs(actualY - thresholdFull);

          const minDist = Math.min(distToPeek, distToHalf, distToFull);

          if (minDist === distToPeek) {
            finalHeight = PEEK_HEIGHT;
            setIsDirectoryExpanded(false);
          } else if (minDist === distToHalf) {
            finalHeight = HALF_HEIGHT;
            setIsDirectoryExpanded(true);
          } else {
            finalHeight = FULL_HEIGHT;
            setIsDirectoryExpanded(true);
          }
        }

        animateTo(finalHeight);
      },
    })
  ).current;

  const sections = useMemo(() => {
    const levelFiltered = (selectedLevel === 'ALL' || directorySearchQuery.trim())
      ? directoryEntries
      : directoryEntries.filter((entry) => {
          const lvl = entry.level || entry.location?.level || '';
          return matchLevel(lvl, selectedLevel);
        });

    if (levelFiltered.length === 0) return [];
    
    const groups: Record<string, typeof levelFiltered> = {};
    levelFiltered.forEach((entry) => {
      // Group by zone, fallback to 'Directory'
      const sectionName = entry.zone || 'Directory';
      if (!groups[sectionName]) {
        groups[sectionName] = [];
      }
      groups[sectionName].push(entry);
    });

    return Object.keys(groups)
      .sort((a, b) => {
        // 'Directory' always goes last
        if (a === 'Directory') return 1;
        if (b === 'Directory') return -1;
        return a.localeCompare(b);
      })
      .map((key) => ({
        title: key,
        data: groups[key],
      }));
  }, [directoryEntries, selectedLevel]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View
      style={[
        styles.directorySheet,
        {
          transform: [{ translateY }],
          height: FULL_HEIGHT,
        },
      ]}
    >
      {/* Drag handle area */}
      <View {...panResponder.panHandlers} style={styles.directorySheetHandleWrap}>
        <View style={styles.directorySheetHandle} />
      </View>

      <TouchableOpacity
        style={styles.directoryHeader}
        activeOpacity={0.8}
        onPress={() => setIsDirectoryExpanded(!isDirectoryExpanded)}
      >
        <View style={styles.headerTitleWrap}>
          <Text style={styles.directoryTitle}>{activeAirportCode} Wayfinding</Text>
          <Text style={styles.directorySubtitle}>Interactive Airport Directory</Text>
        </View>
        {isDirectoryExpanded ? (
          <TouchableOpacity
            style={styles.directoryCloseButton}
            onPress={(e) => {
              e.stopPropagation();
              setIsDirectoryExpanded(false);
            }}
          >
            <Ionicons name="chevron-down-circle" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
        ) : (
          <View style={styles.directoryCollapseHint}>
            <Text style={styles.directoryCollapseHintText}>{directorySummaryCount} spots</Text>
            <Ionicons name="chevron-up" size={14} color={theme.colors.accent} />
          </View>
        )}
      </TouchableOpacity>

      {isDirectoryExpanded && (
        <View style={styles.contentContainer}>
          <View style={styles.directorySearchBox}>
            <Ionicons name="search-outline" size={22} color={theme.colors.accent} />
            <TextInput
              value={directorySearchQuery}
              onChangeText={(value) => {
                setDirectorySearchQuery(value);
                setSelectedDirectoryEntry(null);
                if (value.trim() && selectedDirectoryCategory !== 'ALL') {
                  setSelectedDirectoryCategory('ALL');
                }
              }}
              placeholder="Search shops, dining, checkpoints..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.directorySearchInput}
            />
            {directorySearchQuery ? (
              <TouchableOpacity
                style={styles.directorySearchClear}
                onPress={() => {
                  setDirectorySearchQuery('');
                  setSelectedDirectoryEntry(null);
                }}
              >
                <Ionicons name="close" size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickFiltersContainer}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {['KCM', 'Shuttle', 'Ops', 'Coffee'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.quickFilterChip,
                  directorySearchQuery.toLowerCase() === filter.toLowerCase() && styles.quickFilterChipActive,
                ]}
                onPress={() => {
                  const isActivating = directorySearchQuery.toLowerCase() !== filter.toLowerCase();
                  setDirectorySearchQuery(isActivating ? filter : '');
                  setSelectedDirectoryEntry(null);
                  if (isActivating) {
                    if (filter === 'Coffee') {
                      setSelectedDirectoryCategory('COFFEE');
                    } else if (filter === 'Shuttle') {
                      setSelectedDirectoryCategory('TRANSPORT');
                    } else if (filter === 'KCM' || filter === 'Ops') {
                      setSelectedDirectoryCategory('SECURITY');
                    }
                  }
                }}
              >
                <Text
                  style={[
                    styles.quickFilterText,
                    directorySearchQuery.toLowerCase() === filter.toLowerCase() && styles.quickFilterTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directoryTabs}>
            {DIRECTORY_CATEGORIES.map((category) => {
              const active = selectedDirectoryCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.directoryTab, active && styles.directoryTabActive]}
                  onPress={() => {
                    setSelectedDirectoryCategory(category.id);
                    setSelectedDirectoryEntry(null);
                  }}
                >
                  <View style={[styles.directoryTabIcon, active && styles.directoryTabIconActive]}>
                    <Ionicons
                      name={category.icon}
                      size={12}
                      color={active ? theme.colors.accent : theme.colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.directoryTabText, active && styles.directoryTabTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.levelFilterScroll}
            contentContainerStyle={styles.levelFilterContent}
          >
            {LEVEL_OPTIONS.map((opt) => {
              const active = selectedLevel === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.levelFilterChip, active && styles.levelFilterChipActive]}
                  onPress={() => {
                    handleSelectLevel(opt.id);
                  }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={12}
                    color={active ? theme.colors.background : theme.colors.textMuted}
                  />
                  <Text style={[styles.levelFilterText, active && styles.levelFilterTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.directorySourceBar}>
            <View style={styles.directorySourceCopy}>
              <Text style={styles.directorySourceLabel}>Interactive Map</Text>
              <Text style={styles.directorySourceText} numberOfLines={1}>
                Tap any map icon to view or add crew intel.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.directoryBusinessButton,
                  { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }
                ]}
                onPress={onReportIntelPress}
              >
                <Ionicons name="radio-outline" size={14} color={theme.colors.text} />
                <Text style={[styles.directoryBusinessButtonText, { color: theme.colors.text }]}>
                  Report Intel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.directoryBusinessButton,
                  isRefreshingDirectoryBusinesses && styles.directoryBusinessButtonDisabled,
                ]}
                onPress={handleRefreshDirectoryBusinesses}
                disabled={isRefreshingDirectoryBusinesses}
              >
                <Ionicons
                  name={isRefreshingDirectoryBusinesses ? 'hourglass-outline' : 'refresh-outline'}
                  size={14}
                  color={theme.colors.background}
                />
                <Text style={styles.directoryBusinessButtonText}>
                  {isRefreshingDirectoryBusinesses ? 'Refreshing' : 'Businesses'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Collapsible Wayfinding Legend */}
          <View style={styles.legendContainer}>
            <TouchableOpacity
              style={styles.legendHeader}
              onPress={() => setIsLegendExpanded(!isLegendExpanded)}
              activeOpacity={0.8}
            >
              <View style={styles.legendHeaderLeft}>
                <Ionicons name="compass-outline" size={16} color={theme.colors.accent} />
                <Text style={styles.legendHeaderTitle}>Airport Signage & Color Guide</Text>
              </View>
              <Ionicons
                name={isLegendExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {isLegendExpanded && (
              <View style={styles.legendContent}>
                {/* Concourse Columns */}
                <View style={styles.legendColumn}>
                  <Text style={styles.legendSectionTitle}>CONCOURSES</Text>
                  
                  <View style={styles.legendItem}>
                    <View style={[styles.legendPill, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: '#3B82F6' }]}>
                      <Text style={[styles.legendPillText, { color: '#3B82F6' }]}>TERM A</Text>
                    </View>
                    <Text style={styles.legendLabel}>Concourse A / Gates</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}>
                      <Text style={[styles.legendPillText, { color: '#10B981' }]}>TERM B</Text>
                    </View>
                    <Text style={styles.legendLabel}>Concourse B / Gates</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendPill, { backgroundColor: 'rgba(236, 72, 153, 0.12)', borderColor: '#EC4899' }]}>
                      <Text style={[styles.legendPillText, { color: '#EC4899' }]}>TERM C</Text>
                    </View>
                    <Text style={styles.legendLabel}>Concourse C / Gates</Text>
                  </View>
                </View>

                {/* Signage Services Column */}
                <View style={styles.legendColumn}>
                  <Text style={styles.legendSectionTitle}>WAYFINDING SIGNAGE</Text>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#EAB308' }]}>
                      <Ionicons name="scan-outline" size={10} color="#000000" />
                    </View>
                    <Text style={styles.legendLabel}>🟨 Security & KCM</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#D97706' }]}>
                      <Ionicons name="cafe-outline" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={styles.legendLabel}>🟫 Coffee Resets</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#F97316' }]}>
                      <Ionicons name="restaurant-outline" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={styles.legendLabel}>🟧 Food & Dining</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#0EA5E9' }]}>
                      <Ionicons name="bus-outline" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={styles.legendLabel}>🟦 Transit & Shuttles</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#6366F1' }]}>
                      <Ionicons name="bed-outline" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={styles.legendLabel}>🟪 Crew Lounges</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, { backgroundColor: '#EC4899' }]}>
                      <Ionicons name="cart-outline" size={10} color="#FFFFFF" />
                    </View>
                    <Text style={styles.legendLabel}>🟥 Shops & Retail</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {selectedDirectoryEntry && (
            <View style={styles.directoryDetailCard}>
              <View style={styles.directoryDetailHeader}>
                <View style={styles.directoryDetailIcon}>
                  <Ionicons name={selectedDirectoryEntry.icon} size={16} color={theme.colors.background} />
                </View>
                <View style={styles.directoryDetailCopy}>
                  <Text style={styles.directoryDetailEyebrow}>
                    {selectedDirectoryEntry.meta} guide
                  </Text>
                  <Text style={styles.directoryDetailTitle} numberOfLines={1}>
                    {selectedDirectoryEntry.title}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.directoryDetailClose}
                  onPress={() => setSelectedDirectoryEntry(null)}
                >
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.directoryDetailText} numberOfLines={2}>
                {selectedDirectoryEntry.subtitle}
              </Text>
              {selectedDirectoryEntry.crewNote ? (
                <Text style={styles.directoryDetailNote} numberOfLines={2}>
                  {selectedDirectoryEntry.crewNote}
                </Text>
              ) : null}
              <View style={styles.directoryDetailChipRail}>
                {[
                  selectedDirectoryEntry.level,
                  selectedDirectoryEntry.zone,
                  selectedDirectoryEntry.sourceLabel,
                ]
                  .filter((label): label is string => Boolean(label))
                  .map((label) => (
                    <View key={`detail-${selectedDirectoryEntry.id}-${label}`} style={styles.directoryRowChip}>
                      <Text style={styles.directoryRowChipText} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  ))}
              </View>

              {selectedDirectoryEntry.location && selectedDirectoryEntry.location.coordinate && (
                <View style={styles.directoryDetailActions}>
                  <TouchableOpacity
                    style={styles.engageButton}
                    onPress={async () => {
                      const { location } = selectedDirectoryEntry;
                      if (!location || !location.coordinate || typeof location.coordinate.latitude !== 'number') {
                        Alert.alert('Directions Unavailable', 'No coordinates found for this directory spot.');
                        return;
                      }
                      const { latitude, longitude } = location.coordinate;
                      const label = encodeURIComponent(selectedDirectoryEntry.title);
                      const url = Platform.OS === 'ios'
                        ? `maps://?daddr=${latitude},${longitude}&q=${label}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
                      try {
                        const supported = await Linking.canOpenURL(url);
                        if (!supported) {
                          Alert.alert('Maps Unavailable', 'No map application is available.');
                          return;
                        }
                        await Linking.openURL(url);
                      } catch (e) {
                        Alert.alert('Error', 'Unable to open maps application.');
                      }
                    }}
                  >
                    <Ionicons name="navigate" size={13} color="#FFFFFF" />
                    <Text style={styles.engageButtonText}>Open Native Maps</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <SectionList
            style={[styles.directoryList, selectedDirectoryEntry && styles.directoryListWithDetail]}
            contentContainerStyle={styles.directoryListContent}
            showsVerticalScrollIndicator={false}
            sections={sections}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              isRefreshingDirectoryBusinesses && directorySearchQuery.length >= 2 ? (
                <View style={styles.directoryLoadingState}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.directoryLoadingText}>Hydrating directory with live businesses...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              !isRefreshingDirectoryBusinesses ? (
                <View style={styles.directoryEmptyState}>
                  <Ionicons name="search-outline" size={24} color={theme.colors.accent} />
                  <Text style={styles.directoryEmptyTitle}>No directory matches</Text>
                  <Text style={styles.directoryEmptyText}>
                    Try a checkpoint, terminal, coffee, baggage, or transport search.
                  </Text>
                </View>
              ) : null
            }
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.directorySectionHeader}>
                <Text style={styles.directorySectionTitle}>{title}</Text>
              </View>
            )}
            renderItem={({ item: entry }) => {
              const hasCrewNote = Boolean(entry.crewNote || entry.sourceLabel === 'Crew');
              return (
                <TouchableOpacity
                  style={[
                    styles.directoryRow,
                    selectedDirectoryEntry?.id === entry.id && styles.directoryRowSelected,
                  ]}
                  onPress={() => handleSelectDirectoryEntry(entry)}
                >
                  <View style={styles.directoryRowIconContainer}>
                    <Ionicons name={entry.icon} size={22} color={theme.colors.textMuted} />
                  </View>
                  <View style={styles.directoryRowCopy}>
                    <View style={styles.directoryRowTitleRow}>
                      <Text style={styles.directoryRowTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      {hasCrewNote && (
                        <View style={styles.directoryNewBadge}>
                          <Text style={styles.directoryNewBadgeText}>Crew</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.directoryRowSubtitle} numberOfLines={1}>
                      {entry.level || entry.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    directorySheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.roundness.lg,
      borderTopRightRadius: theme.roundness.lg,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 20,
      zIndex: 1000,
    },
    directorySheetHandleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
      width: '100%',
    },
    directorySheetHandle: {
      backgroundColor: theme.colors.textMuted + '66',
      width: 42,
      height: 5,
      borderRadius: 2.5,
    },
    directoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    headerTitleWrap: {
      flex: 1,
    },
    directoryTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    directorySubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    directoryCollapseHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    directoryCollapseHintText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    directoryCloseButton: {
      padding: 4,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    directorySearchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      height: 48,
      gap: 10,
      marginBottom: 16,
    },
    directorySearchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '500',
      height: '100%',
    },
    directorySearchClear: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryTabs: {
      paddingBottom: 12,
      gap: 8,
      maxHeight: 50,
    },
    levelFilterScroll: {
      marginTop: 4,
      marginBottom: 16,
      maxHeight: 38,
    },
    levelFilterContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: 16,
    },
    levelFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    levelFilterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    levelFilterText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    levelFilterTextActive: {
      color: theme.colors.background,
      fontWeight: '800',
    },
    directoryTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    directoryTabActive: {
      backgroundColor: theme.colors.accent + '15',
      borderColor: theme.colors.accent + '40',
    },
    directoryTabIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryTabIconActive: {
      backgroundColor: theme.colors.background,
    },
    quickFiltersContainer: {
      marginBottom: 16,
      maxHeight: 38,
    },
    quickFiltersContent: {
      flexDirection: 'row',
      gap: 8,
      paddingRight: 16,
    },
    quickFilterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickFilterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    quickFilterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    quickFilterTextActive: {
      color: theme.colors.background,
    },
    directoryTabText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    directoryTabTextActive: {
      color: theme.colors.accent,
      fontWeight: '900',
    },
    directorySourceBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    directorySourceCopy: {
      flex: 1,
      paddingRight: 12,
    },
    directorySourceLabel: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    directorySourceText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    directoryBusinessButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 4,
    },
    directoryBusinessButtonDisabled: {
      opacity: 0.6,
    },
    directoryBusinessButtonText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: '800',
    },
    directoryDetailCard: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 16,
      shadowColor: theme.colors.overlay,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    directoryDetailHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 8,
    },
    directoryDetailIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryDetailCopy: {
      flex: 1,
    },
    directoryDetailEyebrow: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    directoryDetailTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 2,
    },
    directoryDetailClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryDetailText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    directoryDetailNote: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '600',
      fontStyle: 'italic',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    directoryDetailChipRail: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
    },
    directoryDetailActions: {
      marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      paddingTop: 12,
      alignItems: 'flex-start',
    },
    engageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.roundness.md,
      gap: 6,
    },
    engageButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    directoryList: {
      flex: 1,
    },
    directoryListContent: {
      paddingBottom: 24,
    },
    directoryListWithDetail: {
      opacity: 0.5,
    },
    directorySectionHeader: {
      backgroundColor: theme.colors.surface,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 8,
    },
    directorySectionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    directoryLoadingState: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    directoryLoadingText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    directoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    directoryRowSelected: {
      backgroundColor: theme.colors.accent + '08',
      marginHorizontal: -16,
      paddingHorizontal: 16,
      borderBottomColor: 'transparent',
    },
    directoryRowIconContainer: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directoryRowCopy: {
      flex: 1,
    },
    directoryRowTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    directoryRowChip: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    directoryRowChipText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    directoryNewBadge: {
      backgroundColor: '#E6F4EA',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    directoryNewBadgeText: {
      color: '#137333',
      fontSize: 10,
      fontWeight: '700',
    },
    directoryRowTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    directoryRowSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },

    directoryEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    directoryEmptyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 12,
    },
    directoryEmptyText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 4,
      paddingHorizontal: 32,
    },
    legendContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.roundness.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
      overflow: 'hidden',
    },
    legendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
    },
    legendHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendHeaderTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    legendContent: {
      flexDirection: 'row',
      padding: 14,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      gap: 16,
    },
    legendColumn: {
      flex: 1,
      gap: 10,
    },
    legendSectionTitle: {
      color: theme.colors.accent,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendPill: {
      width: 58,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendPillText: {
      fontSize: 8,
      fontWeight: '900',
    },
    legendCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendLabel: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
  });
