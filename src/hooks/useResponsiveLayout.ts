import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export type NavigationMode = 'bottom-bar' | 'side-rail';
export type DualScreenMode = 'closed-phone' | 'open-dual-screen' | 'tablet';
export type ContentSplitMode = 'single-pane' | 'stacked' | 'side-by-side';

export interface ResponsiveLayout {
  width: number;
  height: number;
  aspectRatio: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isTablet: boolean;
  isWideScreen: boolean;
  /** True when device is an unfolded dual-screen / foldable phone or tablet */
  isDualScreenOpen: boolean;
  /** True when device is in single-screen closed phone mode */
  isDualScreenClosed: boolean;
  deviceMode: DualScreenMode;
  /** Whether navigation buttons should sit in the left side rail or bottom bar */
  navigationMode: NavigationMode;
  useSideNavigation: boolean;
  /** Recommended layout for heavy content views like Map, Video, or Intel */
  contentSplitMode: ContentSplitMode;
  /** Suggested side rail width */
  sideRailWidth: number;
}

/**
 * Hook to provide responsive measurements and adaptive device mode detection
 * for Tablets, iPhone Duo / Foldable devices (open vs closed), and standard smartphones.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const isPortrait = !isLandscape;
    const aspectRatio = width / (height || 1);
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);

    // iPad / Android tablet detection
    const isTablet =
      Platform.OS === 'ios'
        ? Platform.isPad
        : minDimension >= 600 || width >= 768;

    // Dual-screen / foldable open detection (iPhone Duo / Surface Duo / Foldables):
    // Active when unfolded into dual-screen mode (aspect ratio ~0.70 to ~1.48, or dual-pane landscape).
    // NOT applied to standard iPads / tablets, which have a single unified tablet screen.
    const isDualScreenOpen =
      !isTablet &&
      ((width >= 540 && height >= 500 && aspectRatio >= 0.70 && aspectRatio <= 1.48) ||
        (isLandscape && width >= 640 && width < 1024));

    const isDualScreenClosed = !isDualScreenOpen && !isTablet;

    const isWideScreen = width >= 720;

    // Side navigation is strictly for unfolded iPhone Duo / dual-screen devices.
    // iPads do NOT use a side rail / side menu — they maintain an edge-to-edge tablet canvas
    // with standard/optimized bottom navigation or native tablet bars.
    const useSideNavigation = !isTablet && isDualScreenOpen;
    const navigationMode: NavigationMode = useSideNavigation ? 'side-rail' : 'bottom-bar';

    let deviceMode: DualScreenMode = 'closed-phone';
    if (isTablet) {
      deviceMode = 'tablet';
    } else if (isDualScreenOpen) {
      deviceMode = 'open-dual-screen';
    }

    // Determine content split mode:
    // 'stacked': Top display (e.g. Map/Radar/Status) + Bottom controls (YouTube desktop/Duo style)
    // 'side-by-side': Left pane + Right detail (wide tablet landscape or side-by-side Duo)
    // 'single-pane': Standard phone
    let contentSplitMode: ContentSplitMode = 'single-pane';
    if (isTablet) {
      contentSplitMode = isLandscape ? 'side-by-side' : 'single-pane';
    } else if (isDualScreenOpen) {
      // iPhone Duo unfolded:
      // In upright / portrait dual-screen: Top display + Bottom player ops deck (YouTube style)
      // In landscape open: Left display + Right ops deck
      contentSplitMode = isLandscape && width > height * 1.25 ? 'side-by-side' : 'stacked';
    }

    // Suggested side rail width for iPhone Duo
    const sideRailWidth = 78;

    return {
      width,
      height,
      aspectRatio,
      isLandscape,
      isPortrait,
      isTablet,
      isWideScreen,
      isDualScreenOpen,
      isDualScreenClosed,
      deviceMode,
      navigationMode,
      useSideNavigation,
      contentSplitMode,
      sideRailWidth,
    };
  }, [width, height]);
}

