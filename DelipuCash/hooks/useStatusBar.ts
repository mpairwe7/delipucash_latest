/**
 * useStatusBar Hook
 * 
 * Industry-standard status bar management for React Native/Expo apps.
 * Provides consistent status bar behavior across all screens with:
 * - Theme-aware styling (light/dark mode)
 * - Edge-to-edge design support (translucent)
 * - Smooth animated transitions
 * - Focus-aware status bar updates (for tab navigation)
 * 
 * @module hooks/useStatusBar
 */

import { useCallback, useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { setStatusBarStyle, setStatusBarTranslucent, setStatusBarHidden } from 'expo-status-bar';
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
   * Whether the status bar should be translucent (Android only)
   * Enables edge-to-edge design
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
   * @default true
   */
  animated?: boolean;
  
  /**
   * Background color for Android status bar
   * Only works when translucent is false
   */
  backgroundColor?: string;
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
 * Hook for managing status bar appearance following industry standards.
 * 
 * Features:
 * - Automatically syncs with theme (light/dark mode)
 * - Sets up edge-to-edge design with translucent status bar
 * - Updates status bar when screen gains focus (for tab navigation)
 * - Provides utilities for temporary style overrides
 * 
 * @example
 * // Basic usage - automatically syncs with theme
 * function MyScreen() {
 *   const { style, colors } = useStatusBar();
 *   return <View style={{ paddingTop: insets.top }}>...</View>;
 * }
 * 
 * @example
 * // With custom options
 * function MyScreen() {
 *   useStatusBar({ style: 'light', hidden: false });
 *   return <View>...</View>;
 * }
 * 
 * @example
 * // Inverted style for hero sections with dark backgrounds
 * function HeroSection() {
 *   const { setStyle, resetStyle } = useStatusBar();
 *   useEffect(() => {
 *     setStyle('light');
 *     return () => resetStyle();
 *   }, []);
 *   return <View style={{ backgroundColor: 'black' }}>...</View>;
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

  // Set up Android translucent status bar on mount
  useEffect(() => {
    if (Platform.OS === 'android') {
      setStatusBarTranslucent(mergedOptions.translucent ?? true);
      
      // Set background color for non-translucent mode
      if (!mergedOptions.translucent && mergedOptions.backgroundColor) {
        RNStatusBar.setBackgroundColor(mergedOptions.backgroundColor, mergedOptions.animated);
      }
    }
  }, [mergedOptions.translucent, mergedOptions.backgroundColor, mergedOptions.animated]);

  // Update status bar style when theme changes
  useEffect(() => {
    setStatusBarStyle(resolvedStyle, mergedOptions.animated);
  }, [resolvedStyle, mergedOptions.animated]);

  // Update hidden state
  useEffect(() => {
    setStatusBarHidden(mergedOptions.hidden ?? false, 'fade');
  }, [mergedOptions.hidden]);

  // Focus effect for tab navigation - ensures correct status bar on screen focus
  useFocusEffect(
    useCallback(() => {
      // Re-apply status bar settings when screen gains focus
      setStatusBarStyle(resolvedStyle, true);
      
      if (Platform.OS === 'android') {
        setStatusBarTranslucent(mergedOptions.translucent ?? true);
      }
      
      if (mergedOptions.hidden !== undefined) {
        setStatusBarHidden(mergedOptions.hidden, 'fade');
      }
    }, [resolvedStyle, mergedOptions.translucent, mergedOptions.hidden])
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
 *   useConfigureStatusBar(); // Sets up theme-aware status bar
 *   return <View>...</View>;
 * }
 */
export function useConfigureStatusBar(options: StatusBarOptions = {}): void {
  useStatusBar(options);
}

/**
 * Hook for immersive/fullscreen modes (e.g., video playback)
 * 
 * @example
 * function VideoPlayer() {
 *   const { enterFullscreen, exitFullscreen } = useImmersiveStatusBar();
 *   
 *   const handleFullscreen = () => {
 *     enterFullscreen();
 *     // Enable fullscreen video...
 *   };
 *   
 *   return <Video onFullscreen={handleFullscreen} />;
 * }
 */
export function useImmersiveStatusBar() {
  const { setHidden, resetStyle } = useStatusBar();

  const enterFullscreen = useCallback(() => {
    setHidden(true);
  }, [setHidden]);

  const exitFullscreen = useCallback(() => {
    setHidden(false);
    resetStyle();
  }, [setHidden, resetStyle]);

  return {
    enterFullscreen,
    exitFullscreen,
  };
}

export default useStatusBar;
