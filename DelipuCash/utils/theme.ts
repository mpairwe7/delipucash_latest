import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StatusBarStyle } from 'expo-status-bar';
import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// DESIGN TOKENS - Single source of truth for all design decisions
// ============================================================================

/**
 * Spacing scale following 4px base unit (industry standard)
 * Use these values for margins, paddings, and gaps
 */
export const SPACING = {
  /** 0px */
  none: 0,
  /** 2px - Micro spacing for tight elements */
  xxs: 2,
  /** 4px - Extra small spacing */
  xs: 4,
  /** 8px - Small spacing */
  sm: 8,
  /** 12px - Medium-small spacing */
  md: 12,
  /** 16px - Base spacing unit */
  base: 16,
  /** 20px - Medium-large spacing */
  lg: 20,
  /** 24px - Large spacing */
  xl: 24,
  /** 32px - Extra large spacing */
  '2xl': 32,
  /** 40px - 2x Extra large spacing */
  '3xl': 40,
  /** 48px - 3x Extra large spacing */
  '4xl': 48,
  /** 64px - 4x Extra large spacing */
  '5xl': 64,
  /** 80px - 5x Extra large spacing */
  '6xl': 80,
} as const;

/**
 * Typography scale with font families, sizes, and line heights
 * Based on modular scale (1.25 ratio)
 */
export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'Roboto_400Regular',
    medium: 'Roboto_500Medium',
    bold: 'Roboto_700Bold',
  },
  fontSize: {
    /** 10px - Caption/micro text */
    xs: 10,
    /** 12px - Small labels */
    sm: 12,
    /** 13px - Secondary text */
    md: 13,
    /** 14px - Body small */
    base: 14,
    /** 15px - Body default */
    body: 15,
    /** 16px - Body large / Button text */
    lg: 16,
    /** 18px - Heading 4 / Subheadings */
    xl: 18,
    /** 20px - Heading 3 */
    '2xl': 20,
    /** 24px - Heading 2 */
    '3xl': 24,
    /** 28px - Heading 1 */
    '4xl': 28,
    /** 32px - Display small */
    '5xl': 32,
    /** 40px - Display medium */
    '6xl': 40,
    /** 48px - Display large */
    '7xl': 48,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.5,
    loose: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
} as const;

/**
 * Border radius scale for consistent rounding
 */
export const RADIUS = {
  /** 0px - No rounding */
  none: 0,
  /** 4px - Subtle rounding */
  xs: 4,
  /** 6px - Small rounding */
  sm: 6,
  /** 8px - Medium-small rounding */
  md: 8,
  /** 12px - Default rounding for cards/buttons */
  base: 12,
  /** 16px - Large rounding */
  lg: 16,
  /** 20px - Extra large rounding */
  xl: 20,
  /** 24px - 2x Extra large rounding */
  '2xl': 24,
  /** 9999px - Full/pill rounding */
  full: 9999,
} as const;

/**
 * Icon sizes for consistent iconography
 */
export const ICON_SIZE = {
  /** 12px - Micro icons */
  xs: 12,
  /** 14px - Small icons */
  sm: 14,
  /** 16px - Default inline icons */
  md: 16,
  /** 18px - Medium icons */
  base: 18,
  /** 20px - Standard icons */
  lg: 20,
  /** 24px - Large icons */
  xl: 24,
  /** 28px - Extra large icons */
  '2xl': 28,
  /** 32px - 2x Extra large icons */
  '3xl': 32,
  /** 40px - Feature icons */
  '4xl': 40,
  /** 48px - Hero icons */
  '5xl': 48,
} as const;

/**
 * Component-specific size tokens
 */
export const COMPONENT_SIZE = {
  /** Button heights */
  button: {
    small: 40,
    medium: 48,
    large: 56,
  },
  /** Input field heights */
  input: {
    small: 44,
    medium: 52,
    large: 60,
  },
  /** Avatar sizes */
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 80,
  },
  /** Touch target minimum (accessibility standard) */
  touchTarget: 44,
  /** Header heights */
  header: {
    compact: 44,
    standard: 56,
    large: 96,
  },
  /** Tab bar height */
  tabBar: 80,
  /** Card minimum height */
  card: {
    compact: 60,
    standard: 80,
    large: 120,
  },
} as const;

/**
 * System bars configuration for immersive experiences
 * Following iOS Human Interface Guidelines and Material Design 3 specs
 */
export const SYSTEM_BARS = {
  /** Status bar configurations */
  statusBar: {
    /** Height estimates (actual values come from SafeAreaInsets) */
    height: {
      ios: 44,
      iosNotch: 47,
      android: 24,
    },
    /** Default translucent background for overlay mode */
    translucentBackground: 'transparent',
    /** Dark overlay for light content on videos/images */
    darkOverlay: 'rgba(0, 0, 0, 0.3)',
    /** Light overlay for dark content */
    lightOverlay: 'rgba(255, 255, 255, 0.1)',
  },
  /** Navigation bar configurations (Android) */
  navigationBar: {
    /** Standard navigation bar height */
    height: 48,
    /** Gesture navigation bar height (Android 10+) */
    gestureHeight: 32,
    /** Home indicator height (iOS) */
    homeIndicator: 34,
  },
  /** Transition animations */
  animation: {
    /** Duration for show/hide transitions */
    duration: 200,
    /** Easing for smooth transitions */
    easing: 'ease-in-out',
  },
  /** Content modes for immersive experiences */
  mode: {
    /** Standard mode - visible system bars */
    standard: 'standard',
    /** Immersive mode - hide system bars (TikTok/Reels style) */
    immersive: 'immersive',
    /** Edge-to-edge - visible but translucent bars */
    edgeToEdge: 'edge-to-edge',
  },
} as const;

/** System bars mode type */
export type SystemBarsMode = keyof typeof SYSTEM_BARS.mode;

/**
 * Shadow/elevation tokens for depth hierarchy
 */
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/**
 * Animation duration tokens
 */
export const ANIMATION = {
  duration: {
    /** 100ms - Micro interactions */
    instant: 100,
    /** 150ms - Quick feedback */
    fast: 150,
    /** 200ms - Default transitions */
    normal: 200,
    /** 300ms - Smooth transitions */
    slow: 300,
    /** 500ms - Elaborate animations */
    slower: 500,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

/**
 * Z-index scale for layering
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
} as const;

/**
 * Opacity tokens for consistent transparency
 */
export const OPACITY = {
  transparent: 0,
  disabled: 0.4,
  muted: 0.6,
  subtle: 0.8,
  opaque: 1,
  /** Background overlays */
  overlay: {
    light: 0.15,
    medium: 0.4,
    heavy: 0.7,
  },
} as const;

/**
 * Border width tokens
 */
export const BORDER_WIDTH = {
  none: 0,
  hairline: 0.5,
  thin: 1,
  base: 1.5,
  thick: 2,
} as const;

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  sm: 320,
  md: 375,
  lg: 414,
  xl: 768,
} as const;

/**
 * Check if screen is small
 */
export const isSmallScreen = SCREEN_WIDTH < BREAKPOINTS.md;

// ============================================================================
// COLOR SYSTEM
// ============================================================================

/**
 * Theme color palette interface
 */
export interface ThemeColors {
  background: string;
  elevated: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  tabBackground: string;
  tabActive: string;
  tabInactive: string;
}

/**
 * Theme store state interface
 */
interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

/**
 * Theme hook return type
 */
export interface ThemeContextValue {
  colors: ThemeColors;
  statusBarStyle: StatusBarStyle;
  isDark: boolean;
}

/**
 * Dark theme color palette
 */
const DARK_COLORS: ThemeColors = {
  background: '#000000',
  elevated: '#0A0A0A',
  card: '#1A1A1A',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  textDisabled: '#505050',
  primary: '#4D4DFF',
  primaryText: '#FFFFFF',
  secondary: '#2A2A2A',
  secondaryText: '#FFFFFF',
  success: '#00C853',
  error: '#FF3B30',
  warning: '#FFAB00',
  info: '#2196F3',
  tabBackground: '#000000',
  tabActive: '#FFFFFF',
  tabInactive: '#6B6B6B',
};

/**
 * Light theme color palette
 */
const LIGHT_COLORS: ThemeColors = {
  background: '#FFFFFF',
  elevated: '#F5F5F5',
  card: '#FFFFFF',
  border: '#E0E0E0',
  text: '#000000',
  textSecondary: '#666666',
  textMuted: '#999999',
  textDisabled: '#CCCCCC',
  primary: '#4D4DFF',
  primaryText: '#FFFFFF',
  secondary: '#F0F0F0',
  secondaryText: '#000000',
  success: '#00C853',
  error: '#FF3B30',
  warning: '#FFAB00',
  info: '#2196F3',
  tabBackground: '#FFFFFF',
  tabActive: '#000000',
  tabInactive: '#999999',
};

// ============================================================================
// THEME STORE & HOOKS
// ============================================================================

/**
 * Theme store for global theme management with persistence
 * Theme preference is saved to AsyncStorage and restored on app launch
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true, // Default to dark mode for fintech aesthetic
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
    }),
    {
      name: 'theme-storage', // Unique key for AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isDark: state.isDark }), // Only persist isDark, not the function
    }
  )
);

/**
 * Hook to get current theme colors and status bar style
 *
 * @returns Theme colors, status bar style, and dark mode state
 *
 * @example
 * ```tsx
 * const { colors, statusBarStyle, isDark } = useTheme();
 * return <View style={{ backgroundColor: colors.background }} />;
 * ```
 */
export const useTheme = (): ThemeContextValue => {
  const isDark = useThemeStore((state) => state.isDark);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const statusBarStyle: StatusBarStyle = isDark ? 'light' : 'dark';

  return { colors, statusBarStyle, isDark };
};

// ============================================================================
// STYLE HELPER UTILITIES
// ============================================================================

/**
 * Create a color with alpha transparency
 * Handles hex colors (3 or 6 digit), rgb/rgba, and fallback for invalid colors
 */
export const withAlpha = (hexColor: string | undefined, alpha: number): string => {
  // Handle undefined/null/empty color
  if (!hexColor || typeof hexColor !== 'string') {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  // If it's already an rgba color, just return with new alpha
  if (hexColor.startsWith('rgba')) {
    return hexColor.replace(/[\d.]+\)$/g, `${alpha})`);
  }

  // If it's an rgb color, convert to rgba
  if (hexColor.startsWith('rgb(')) {
    return hexColor.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  // Handle hex colors
  const hex = hexColor.replace('#', '');

  // Handle 3-digit hex
  let r: number, g: number, b: number;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    // Invalid hex, return fallback
    return `rgba(0, 0, 0, ${alpha})`;
  }

  // Handle NaN values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Get platform-specific shadow styles
 */
export const getShadow = (level: keyof typeof SHADOWS) => {
  if (Platform.OS === 'android') {
    return { elevation: SHADOWS[level].elevation };
  }
  return SHADOWS[level];
};

/**
 * Common text styles factory
 */
export const createTextStyle = (
  size: keyof typeof TYPOGRAPHY.fontSize,
  weight: keyof typeof TYPOGRAPHY.fontFamily = 'regular',
  lineHeightRatio: keyof typeof TYPOGRAPHY.lineHeight = 'normal'
) => ({
  fontFamily: TYPOGRAPHY.fontFamily[weight],
  fontSize: TYPOGRAPHY.fontSize[size],
  lineHeight: TYPOGRAPHY.fontSize[size] * TYPOGRAPHY.lineHeight[lineHeightRatio],
});

export default useTheme;
