import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';

interface DualScreenContainerProps {
  /** The primary display (e.g. Live Radar, Map, or Video/Hero deck) */
  primaryContent: React.ReactNode;
  /** The player controls, directory, list, or secondary interaction panel */
  secondaryContent: React.ReactNode;
  /** Optional custom title or indicator for the top screen */
  topTitle?: string;
  /** Optional custom title or indicator for the bottom screen */
  bottomTitle?: string;
  /** Flex distribution between top and bottom screens in dual-screen mode (default: [1, 1]) */
  flexRatio?: [number, number];
  /** Whether the secondary content should be wrapped in a ScrollView */
  scrollableSecondary?: boolean;
}

/**
 * DualScreenContainer
 *
 * Implements the foldable / dual-screen "YouTube player style" layout:
 * - When OPEN (2 screens active / tablet):
 *   - Top screen displays the primary visual content (Radar / Map / Flight status).
 *   - A subtle crew hinge divider visually demarcates the physical/virtual screen fold.
 *   - Bottom screen hosts the interactive player functions, airport intel, and directory.
 * - When CLOSED (standard single-screen phone):
 *   - Renders standard responsive single-pane layout.
 */
export function DualScreenContainer({
  primaryContent,
  secondaryContent,
  topTitle,
  bottomTitle,
  flexRatio = [1, 1],
  scrollableSecondary = true,
}: DualScreenContainerProps) {
  const { isDualScreenOpen, contentSplitMode, isLandscape, width } = useResponsiveLayout();
  const { theme, isDark } = useTheme();

  // If closed or standard phone portrait, render normal stacked content
  if (!isDualScreenOpen) {
    return (
      <View style={styles.fullContainer}>
        {primaryContent}
        {secondaryContent}
      </View>
    );
  }

  // When Open on an ultra-wide landscape tablet (width >= 960)
  if (contentSplitMode === 'side-by-side' && isLandscape && width >= 960) {
    return (
      <View style={styles.sideBySideContainer}>
        <View style={[styles.pane, { flex: flexRatio[0] }]}>
          {topTitle && (
            <View style={[styles.screenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.accent }]} />
              <Text style={[styles.screenHeaderText, { color: theme.colors.textMuted }]}>{topTitle}</Text>
            </View>
          )}
          <View style={styles.contentFlex}>{primaryContent}</View>
        </View>

        <View style={[styles.verticalHinge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />

        <View style={[styles.pane, { flex: flexRatio[1], backgroundColor: isDark ? '#050505' : '#f8f9fa' }]}>
          {bottomTitle && (
            <View style={[styles.screenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.screenHeaderText, { color: theme.colors.textMuted }]}>{bottomTitle}</Text>
            </View>
          )}
          {scrollableSecondary ? (
            <ScrollView style={styles.contentFlex} contentContainerStyle={styles.secondaryScrollContent}>
              {secondaryContent}
            </ScrollView>
          ) : (
            <View style={styles.contentFlex}>{secondaryContent}</View>
          )}
        </View>
      </View>
    );
  }

  // Standard Foldable / Dual-Screen Open Mode:
  // "Top Screen: Display / Video / Map" + "Bottom Screen: Player & Controls Deck"
  return (
    <View style={styles.dualScreenContainer}>
      {/* Top Screen: Primary Visual Display */}
      <View style={[styles.topScreen, { flex: flexRatio[0] }]}>
        {topTitle && (
          <View style={[styles.screenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.accent }]} />
            <Text style={[styles.screenHeaderText, { color: theme.colors.textMuted }]}>{topTitle}</Text>
          </View>
        )}
        <View style={styles.contentFlex}>{primaryContent}</View>
      </View>

      {/* Dual Screen Hinge Divider */}
      <View style={[styles.horizontalHinge, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}>
        <View style={[styles.hingeGrip, { backgroundColor: theme.colors.accent }]} />
      </View>

      {/* Bottom Screen: Player Functions & Controls */}
      <View style={[styles.bottomScreen, { flex: flexRatio[1], backgroundColor: isDark ? '#080808' : '#f5f5f7' }]}>
        {bottomTitle && (
          <View style={[styles.screenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
            <View style={[styles.statusDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.screenHeaderText, { color: theme.colors.textMuted }]}>{bottomTitle}</Text>
          </View>
        )}
        {scrollableSecondary ? (
          <ScrollView style={styles.contentFlex} contentContainerStyle={styles.secondaryScrollContent}>
            {secondaryContent}
          </ScrollView>
        ) : (
          <View style={styles.contentFlex}>{secondaryContent}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  dualScreenContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  sideBySideContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  pane: {
    height: '100%',
  },
  contentFlex: {
    flex: 1,
  },
  topScreen: {
    overflow: 'hidden',
    position: 'relative',
  },
  bottomScreen: {
    overflow: 'hidden',
    position: 'relative',
  },
  horizontalHinge: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    position: 'relative',
  },
  hingeGrip: {
    width: 48,
    height: 3,
    borderRadius: 2,
    opacity: 0.6,
  },
  verticalHinge: {
    width: 6,
    height: '100%',
    zIndex: 10,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  screenHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryScrollContent: {
    padding: 14,
    paddingBottom: 28,
  },
});

