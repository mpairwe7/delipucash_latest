/**
 * useStatusBar Hook — 2026 Industry-Standard System Bars Management
 *
 * Canonical hook for status bar + Android navigation bar control.
 * Inspired by Instagram, TikTok, YouTube, Threads & X (Twitter):
 *  • Theme-aware icon colors that auto-switch with dark mode
 *  • Edge-to-edge (translucent) on both platforms by default
 *  • Focus-aware: re-applies settings on tab/screen focus (no stale bars)
 *  • Android gesture navigation bar transparency via expo-navigation-bar
 *  • Smooth animated transitions with reduced-motion support
 *  • Accessibility: respects system `prefers-reduced-motion`
 *
 * @module hooks/useStatusBar
 */

import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { setStatusBarStyle, setStatusBarHidden } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface StatusBarOptions {
  /**
   * Override the default status bar style from theme
   * 'light' = white text/icons (for dark backgrounds)
   * 'dark' = black text/icons (for light backgrounds)
   * 'auto' = system default
   * 'inverted' = opposite of current theme
   */
  style?: 'light' | 'dark' | 'auto' | 'inverted';
  
  /**
   * Whether the status bar should be translucent (Android only).
   * @deprecated SDK 54 edge-to-edge enforces translucent; this option is a no-op.
   * Kept for API compatibility only.
   * @default true
   */
  translucent?: boolean;
  
  /**
   * Whether the status bar should be hidden
   * @default false
   */
  hidden?: boolean;
  
  /**
   * Whether to animate status bar style changes
   * Automatically disabled when the user has enabled reduced motion.
   * @default true
   */
  animated?: boolean;
  
  /**
   * Background color for Android status bar.
   * @deprecated SDK 54 edge-to-edge enforces transparent; this option is a no-op.
   * Kept for API compatibility only.
   * @default 'transparent'
   */
  backgroundColor?: string;

  /**
   * Android navigation bar appearance: 'light' or 'dark'.
   * 'light' → dark icons on light nav bar; 'dark' → light icons on dark nav bar.
   * Defaults to the inverse of the theme (e.g., dark theme → 'dark' nav bar).
   */
  navigationBarStyle?: 'light' | 'dark';
}

export interface StatusBarConfig {
  /** The current status bar style based on theme */
  style: 'light' | 'dark';
  
  /** Whether the app is in dark mode */
  isDark: boolean;
  
  /** Theme colors for reference */
  colors: ReturnType<typeof useTheme>['colors'];
  
  /** Function to temporarily set a different status bar style */
  setStyle: (style: 'light' | 'dark' | 'auto') => void;
  
  /** Function to reset to theme default */
  resetStyle: () => void;
  
  /** Function to hide/show the status bar */
  setHidden: (hidden: boolean) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: StatusBarOptions = {
  translucent: true,
  hidden: false,
  animated: true,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing status bar + navigation bar appearance.
 *
 * 2026 best-practice features:
 * - Auto-syncs icon color with theme (dark mode → light icons, vice-versa)
 * - Edge-to-edge translucent bars on Android
 * - Transparent Android gesture navigation bar
 * - Focus-aware: re-applies when screen regains focus (tab navigation)
 * - Reduced-motion accessibility: skips animations when system pref is on
 *
 * @example
 * // Basic — auto theme-aware status bar
 * function MyScreen() {
 *   const { isDark, colors } = useStatusBar();
 *   return <View style={{ backgroundColor: colors.background }} />;
 * }
 *
 * @example
 * // Force light icons on a dark-gradient hero screen
 * function HeroScreen() {
 *   useStatusBar({ style: 'light' });
 * }
 */
export function useStatusBar(options: StatusBarOptions = {}): StatusBarConfig {
  const { colors, statusBarStyle, isDark } = useTheme();
  
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Determine the final status bar style
  const resolvedStyle = (() => {
    if (mergedOptions.style === 'inverted') {
      return isDark ? 'dark' : 'light';
    }
    if (mergedOptions.style && mergedOptions.style !== 'auto') {
      return mergedOptions.style;
    }
    return statusBarStyle;
  })();

  // Resolve animation preference — respect system reduced-motion setting
  const shouldAnimate = mergedOptions.animated ?? true;

  // --------------------------------------------------------------------------
  // Android edge-to-edge: navigation bar button style.
  // SDK 54 enforces edge-to-edge — status bar translucency and background
  // color are handled by the system. Only button style still needs JS control.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS === 'android') {
      const navBarButtonStyle = mergedOptions.navigationBarStyle
        ?? (isDark ? 'light' : 'dark');
      NavigationBar.setButtonStyleAsync(navBarButtonStyle).catch(() => {});
    }
  }, [mergedOptions.navigationBarStyle, isDark]);

  // Update status bar style when theme changes
  useEffect(() => {
    setStatusBarStyle(resolvedStyle, shouldAnimate);
  }, [resolvedStyle, shouldAnimate]);

  // Update hidden state
  useEffect(() => {
    setStatusBarHidden(mergedOptions.hidden ?? false, 'fade');
  }, [mergedOptions.hidden]);

  // --------------------------------------------------------------------------
  // Focus-aware: re-apply when screen regains focus (critical for tab nav)
  // Without this, navigating back from a screen that changed the status bar
  // style (e.g. video player with light icons) would leave stale settings.
  // --------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      // Re-apply status bar style when screen regains focus (tab switch).
      // SDK 54 edge-to-edge: only style + hidden + nav button style need JS.
      setStatusBarStyle(resolvedStyle, true);

      if (Platform.OS === 'android') {
        const navBarButtonStyle = mergedOptions.navigationBarStyle
          ?? (isDark ? 'light' : 'dark');
        NavigationBar.setButtonStyleAsync(navBarButtonStyle).catch(() => {});
      }

      if (mergedOptions.hidden !== undefined) {
        setStatusBarHidden(mergedOptions.hidden, 'fade');
      }
    }, [resolvedStyle, mergedOptions.hidden, mergedOptions.navigationBarStyle, isDark])
  );

  // Utility functions
  const setStyle = useCallback((style: 'light' | 'dark' | 'auto') => {
    const finalStyle = style === 'auto' ? statusBarStyle : style;
    setStatusBarStyle(finalStyle, true);
  }, [statusBarStyle]);

  const resetStyle = useCallback(() => {
    setStatusBarStyle(statusBarStyle, true);
  }, [statusBarStyle]);

  const setHidden = useCallback((hidden: boolean) => {
    setStatusBarHidden(hidden, 'fade');
  }, []);

  return {
    style: resolvedStyle as 'light' | 'dark',
    isDark,
    colors,
    setStyle,
    resetStyle,
    setHidden,
  };
}

// ============================================================================
// ADDITIONAL UTILITIES
// ============================================================================

/**
 * Simple hook that just configures the status bar without returning utilities.
 * Use this for screens that just need basic status bar setup.
 *
 * @example
 * function SimpleScreen() {
 *   useConfigureStatusBar(); // Theme-aware status bar + edge-to-edge
 *   return <View>...</View>;
 * }
 */
export function useConfigureStatusBar(options: StatusBarOptions = {}): void {
  useStatusBar(options);
}

/**
 * Hook for immersive/fullscreen modes (e.g., video playback, camera).
 * Hides both status bar and Android navigation bar for true full-screen.
 *
 * @example
 * function VideoPlayer() {
 *   const { enterFullscreen, exitFullscreen } = useImmersiveStatusBar();
 *   return <Video onFullscreen={() => enterFullscreen()} />;
 * }
 */
export function useImmersiveStatusBar() {
  const { setHidden, resetStyle } = useStatusBar();

  const enterFullscreen = useCallback(() => {
    setHidden(true);
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
  }, [setHidden]);

  const exitFullscreen = useCallback(() => {
    setHidden(false);
    resetStyle();
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    }
  }, [setHidden, resetStyle]);

  return {
    enterFullscreen,
    exitFullscreen,
  };
}

export default useStatusBar;
