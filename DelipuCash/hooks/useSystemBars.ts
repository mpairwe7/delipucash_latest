/**
 * useSystemBars Hook - Industry-Standard System Bars Management
 * 
 * Provides intelligent control over StatusBar and NavigationBar for
 * immersive video experiences following iOS HIG and Material Design 3.
 * 
 * Features:
 * - Automatic dark/light mode handling
 * - Immersive mode for full-screen video content
 * - Edge-to-edge mode for translucent overlays
 * - Safe area integration
 * - Platform-specific optimizations
 * - Lifecycle-aware (auto-restore on unmount)
 * 
 * @example
 * ```tsx
 * // For video screens (immersive)
 * const { containerStyle } = useSystemBars({ mode: 'immersive' });
 * 
 * // For standard screens with dark header
 * const { containerStyle } = useSystemBars({ mode: 'standard', statusBarStyle: 'light' });
 * ```
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle, setStatusBarHidden } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import type { StatusBarStyle } from 'expo-status-bar';
import { SYSTEM_BARS, type SystemBarsMode, useThemeStore } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSystemBarsOptions {
  /**
   * System bars display mode
   * - 'standard': Normal visible system bars
   * - 'immersive': Hidden system bars for full-screen content (TikTok/Reels)
   * - 'edge-to-edge': Translucent bars overlaying content
   * @default 'edge-to-edge'
   */
  mode?: SystemBarsMode;

  /**
   * Status bar content style
   * - 'light': White icons/text (for dark backgrounds)
   * - 'dark': Black icons/text (for light backgrounds)
   * - 'auto': Automatic based on theme
   * @default 'light'
   */
  statusBarStyle?: StatusBarStyle | 'auto';

  /**
   * Whether status bar background should be translucent (Android)
   * @default true
   */
  translucent?: boolean;

  /**
   * Custom background color for status bar area (for gradient overlays)
   */
  statusBarBackground?: string;

  /**
   * Whether to animate status bar transitions
   * @default true
   */
  animated?: boolean;

  /**
   * Whether to restore previous state on unmount
   * @default true
   */
  restoreOnUnmount?: boolean;

  /**
   * Callback when system bars visibility changes
   */
  onVisibilityChange?: (visible: boolean) => void;
}

export interface SystemBarsState {
  /** Whether system bars are currently visible */
  isVisible: boolean;
  /** Current status bar style */
  statusBarStyle: StatusBarStyle;
  /** Safe area insets from the device */
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  /** Combined safe area offset for header content */
  headerOffset: number;
  /** Combined safe area offset for bottom content */
  bottomOffset: number;
}

export interface UseSystemBarsReturn extends SystemBarsState {
  /** Show system bars */
  showSystemBars: () => void;
  /** Hide system bars (immersive mode) */
  hideSystemBars: () => void;
  /** Toggle system bars visibility */
  toggleSystemBars: () => void;
  /** Set status bar style dynamically */
  setBarStyle: (style: StatusBarStyle) => void;
  /** Container style with proper safe area padding */
  containerStyle: ViewStyle;
  /** Header style with status bar offset */
  headerStyle: ViewStyle;
  /** Footer style with bottom safe area offset */
  footerStyle: ViewStyle;
  /** Overlay gradient style for status bar area */
  statusBarOverlayStyle: ViewStyle;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSystemBars(options: UseSystemBarsOptions = {}): UseSystemBarsReturn {
  const {
    mode = 'edge-to-edge',
    statusBarStyle: initialStyle = 'light',
    translucent = true,
    statusBarBackground,
    animated = true,
    restoreOnUnmount = true,
    onVisibilityChange,
  } = options;

  // Safe area insets from device
  const insets = useSafeAreaInsets();

  // Track previous state for restoration
  const previousStateRef = useRef<{
    style: StatusBarStyle;
    hidden: boolean;
  } | null>(null);

  // Current visibility state
  const isVisibleRef = useRef(mode !== 'immersive');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isDark = useThemeStore((s) => s.isDark);
  const isVisible = mode !== 'immersive';
  const currentStyle: StatusBarStyle = initialStyle === 'auto'
    ? (isDark ? 'light' : 'dark')
    : initialStyle;

  // Header offset accounting for status bar
  const headerOffset = useMemo(() => {
    if (mode === 'immersive') {
      return 0; // Full screen, no offset needed
    }
    return insets.top;
  }, [insets.top, mode]);

  // Bottom offset accounting for home indicator
  const bottomOffset = useMemo(() => {
    return insets.bottom;
  }, [insets.bottom]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const showSystemBars = useCallback(() => {
    isVisibleRef.current = true;
    setStatusBarHidden(false, animated ? 'fade' : 'none');
    onVisibilityChange?.(true);

    if (Platform.OS === 'android') {
      RNStatusBar.setHidden(false);
    }
  }, [animated, onVisibilityChange]);

  const hideSystemBars = useCallback(() => {
    isVisibleRef.current = false;
    setStatusBarHidden(true, animated ? 'fade' : 'none');
    onVisibilityChange?.(false);

    if (Platform.OS === 'android') {
      RNStatusBar.setHidden(true);
    }
  }, [animated, onVisibilityChange]);

  const toggleSystemBars = useCallback(() => {
    if (isVisibleRef.current) {
      hideSystemBars();
    } else {
      showSystemBars();
    }
  }, [hideSystemBars, showSystemBars]);

  const setBarStyle = useCallback((style: StatusBarStyle) => {
    setStatusBarStyle(style, animated);
  }, [animated]);

  // ============================================================================
  // STYLES
  // ============================================================================

  const containerStyle = useMemo((): ViewStyle => {
    const baseStyle: ViewStyle = {
      flex: 1,
    };

    switch (mode) {
      case 'immersive':
        // Full screen, content goes edge-to-edge
        return {
          ...baseStyle,
          paddingTop: 0,
          paddingBottom: 0,
        };
      case 'edge-to-edge':
        // Translucent bars, content fills but UI respects safe areas
        return {
          ...baseStyle,
          paddingTop: 0, // Content goes under status bar
          paddingBottom: 0, // Content goes under home indicator
        };
      case 'standard':
      default:
        // Traditional layout with safe area padding
        return {
          ...baseStyle,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        };
    }
  }, [mode, insets.top, insets.bottom]);

  const headerStyle = useMemo((): ViewStyle => ({
    paddingTop: mode === 'standard' ? 0 : insets.top,
    paddingHorizontal: insets.left || insets.right ? Math.max(insets.left, insets.right) : 0,
  }), [mode, insets.top, insets.left, insets.right]);

  const footerStyle = useMemo((): ViewStyle => ({
    paddingBottom: mode === 'standard' ? 0 : insets.bottom,
    paddingHorizontal: insets.left || insets.right ? Math.max(insets.left, insets.right) : 0,
  }), [mode, insets.bottom, insets.left, insets.right]);

  const statusBarOverlayStyle = useMemo((): ViewStyle => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: insets.top + SYSTEM_BARS.statusBar.height.ios,
    backgroundColor: statusBarBackground || 'transparent',
    zIndex: 1,
  }), [insets.top, statusBarBackground]);

  // ============================================================================
  // LIFECYCLE EFFECTS
  // ============================================================================

  // Apply initial configuration
  useEffect(() => {
    // Save previous state for restoration (capture actual theme-aware style)
    if (restoreOnUnmount && !previousStateRef.current) {
      previousStateRef.current = {
        style: currentStyle,
        hidden: false,
      };
    }

    // Configure status bar style + Android nav bar button style.
    // SDK 54 edge-to-edge: translucency and background color are system-managed.
    setStatusBarStyle(currentStyle, animated);

    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
    }

    // Apply mode-specific settings
    if (mode === 'immersive') {
      hideSystemBars();
      // Also hide Android navigation bar in immersive mode
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
    } else {
      showSystemBars();
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    }

    // Cleanup: restore previous state
    return () => {
      if (restoreOnUnmount && previousStateRef.current) {
        setStatusBarStyle(previousStateRef.current.style, false);
        setStatusBarHidden(previousStateRef.current.hidden, 'none');
      }
      // Restore Android navigation bar visibility on unmount
      if (restoreOnUnmount && Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, [mode, currentStyle, animated, restoreOnUnmount, hideSystemBars, showSystemBars, isDark]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    // State
    isVisible,
    statusBarStyle: currentStyle,
    insets: {
      top: insets.top,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    },
    headerOffset,
    bottomOffset,

    // Actions
    showSystemBars,
    hideSystemBars,
    toggleSystemBars,
    setBarStyle,

    // Styles
    containerStyle,
    headerStyle,
    footerStyle,
    statusBarOverlayStyle,
  };
}

// ============================================================================
// UTILITY COMPONENTS (Optional exports for direct use)
// ============================================================================

/**
 * Default styles for system bar overlays
 */
export const systemBarStyles = StyleSheet.create({
  /** Gradient overlay for status bar area on video content */
  statusBarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    // Note: Use LinearGradient component with this style
  },

  /** Bottom safe area overlay for home indicator */
  bottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SYSTEM_BARS.navigationBar.homeIndicator,
  },

  /** Full-screen container for immersive content */
  immersiveContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

/**
 * Preset configurations for common use cases
 */
export const SYSTEM_BARS_PRESETS = {
  /** TikTok/Reels style video feed */
  videoFeed: {
    mode: 'edge-to-edge' as SystemBarsMode,
    statusBarStyle: 'auto' as 'auto',
    translucent: true,
    animated: true,
  },

  /** Full-screen video player */
  videoPlayer: {
    mode: 'immersive' as SystemBarsMode,
    statusBarStyle: 'light' as StatusBarStyle,
    translucent: true,
    animated: true,
  },

  /** Standard screen with dark header */
  darkHeader: {
    mode: 'edge-to-edge' as SystemBarsMode,
    statusBarStyle: 'auto' as 'auto',
    translucent: true,
    animated: true,
  },

  /** Standard screen with light header */
  lightHeader: {
    mode: 'edge-to-edge' as SystemBarsMode,
    statusBarStyle: 'dark' as StatusBarStyle,
    translucent: true,
    animated: true,
  },

  /** Modal overlay */
  modal: {
    mode: 'standard' as SystemBarsMode,
    statusBarStyle: 'light' as StatusBarStyle,
    translucent: true,
    animated: true,
    restoreOnUnmount: true,
  },
} as const;

export default useSystemBars;
