/**
 * useResponsiveLayout — Central responsive layout hook (2026 best practice)
 *
 * Single source of truth for screen-size-dependent values.
 * Uses useWindowDimensions() which re-renders automatically on:
 *   - Device rotation
 *   - Foldable unfold/fold
 *   - Split-screen resize
 *   - Window resize (web)
 *
 * Replaces all static Dimensions.get('window') patterns and
 * the duplicated getResponsiveSize/isTablet/isSmallScreen constants
 * scattered across 15+ files.
 *
 * @example
 * ```tsx
 * const { isTablet, gridColumns, select, responsiveValue } = useResponsiveLayout();
 *
 * const padding = select({ phone: 16, largePhone: 20, tablet: 24 });
 * const iconSize = responsiveValue(20, 24, 28);
 *
 * <FlatList
 *   key={`grid-${gridColumns}`}
 *   numColumns={gridColumns}
 *   contentContainerStyle={{
 *     ...(isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }),
 *   }}
 * />
 * ```
 *
 * @module hooks/useResponsiveLayout
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

// ============================================================================
// BREAKPOINTS — unified, replaces theme.ts BREAKPOINTS + video-utils SCREEN_BREAKPOINTS
// ============================================================================

export const BREAKPOINTS = {
  /** 320px — Small phone (iPhone SE class) */
  sm: 320,
  /** 375px — Standard phone (iPhone X/11/12/13/14 base) */
  md: 375,
  /** 414px — Large phone (iPhone Plus/Max) */
  lg: 414,
  /** 768px — Tablet (iPad Mini, iPad portrait) */
  tablet: 768,
  /** 1024px — Large tablet (iPad Pro portrait, iPad landscape) */
  largeTablet: 1024,
} as const;

// ============================================================================
// FONT SCALE CONSTANTS — centralized maxFontSizeMultiplier values
// ============================================================================

/** Centralized font scale multipliers for maxFontSizeMultiplier prop */
export const FONT_SCALE = {
  /** Body text, labels, subtitles — WCAG AA */
  body: 1.2,
  /** Headings, titles — WCAG AA */
  heading: 1.3,
  /** Accessibility-critical text (screen reader content) — WCAG AAA */
  a11y: 1.5,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface ResponsiveLayout {
  /** Current window width in dp */
  width: number;
  /** Current window height in dp */
  height: number;

  /** width < 768 */
  isPhone: boolean;
  /** width >= 414 && width < 768 (iPhone Plus/Max class) */
  isLargePhone: boolean;
  /** width >= 768 */
  isTablet: boolean;
  /** width >= 1024 */
  isLargeTablet: boolean;
  /** width < 375 (iPhone SE class) */
  isSmallPhone: boolean;

  /** width <= height */
  isPortrait: boolean;
  /** width > height */
  isLandscape: boolean;

  /** Optimal FlatList columns: 1 phone, 2 tablet portrait, 3 large tablet landscape */
  gridColumns: number;
  /** Max content width to maintain readability: 600 phone, 900 tablet */
  contentMaxWidth: number;
  /** System font scale clamped to 1.5 max for layout stability */
  fontScale: number;

  /** Pick a value by device class. Resolution: largeTablet → tablet → largePhone → phone */
  select: <T>(opts: { phone: T; largePhone?: T; tablet?: T; largeTablet?: T }) => T;
  /** Scale a spacing value: 1x phone, 1.1x largePhone, 1.25x tablet, 1.5x largeTablet */
  scaledSpacing: (base: number) => number;
  /** Drop-in replacement for all duplicated getResponsiveSize functions */
  responsiveValue: (small: number, medium: number, large: number) => number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height, fontScale: rawFontScale } = useWindowDimensions();

  return useMemo((): ResponsiveLayout => {
    const isSmallPhone = width < BREAKPOINTS.md;
    const isLargePhone = width >= BREAKPOINTS.lg && width < BREAKPOINTS.tablet;
    const isPhone = width < BREAKPOINTS.tablet;
    const isTablet = width >= BREAKPOINTS.tablet;
    const isLargeTablet = width >= BREAKPOINTS.largeTablet;
    const isLandscape = width > height;
    const isPortrait = !isLandscape;
    const fontScale = Math.min(rawFontScale, 1.5);

    // Grid columns: phone=1, tablet portrait=2, tablet landscape or large tablet=3
    const gridColumns = isLargeTablet && isLandscape ? 3 : isTablet ? 2 : 1;

    // Content max width: caps readability on wide screens
    const contentMaxWidth = isTablet ? 900 : 600;

    function select<T>(opts: { phone: T; largePhone?: T; tablet?: T; largeTablet?: T }): T {
      if (isLargeTablet && opts.largeTablet !== undefined) return opts.largeTablet;
      if (isTablet && opts.tablet !== undefined) return opts.tablet;
      if (isLargePhone && opts.largePhone !== undefined) return opts.largePhone;
      return opts.phone;
    }

    function scaledSpacing(base: number): number {
      if (isLargeTablet) return Math.round(base * 1.5);
      if (isTablet) return Math.round(base * 1.25);
      if (isLargePhone) return Math.round(base * 1.1);
      return base;
    }

    // Matches existing card component behavior: isTablet → large, isSmallPhone → small, else → medium
    function responsiveValue(small: number, medium: number, large: number): number {
      if (isTablet) return large;
      if (isSmallPhone) return small;
      return medium;
    }

    return {
      width,
      height,
      isPhone,
      isLargePhone,
      isTablet,
      isLargeTablet,
      isSmallPhone,
      isLandscape,
      isPortrait,
      gridColumns,
      contentMaxWidth,
      fontScale,
      select,
      scaledSpacing,
      responsiveValue,
    };
  }, [width, height, rawFontScale]);
}

export default useResponsiveLayout;
