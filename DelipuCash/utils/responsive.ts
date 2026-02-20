/**
 * Responsive utilities — non-hook helpers for use outside the React tree
 *
 * For module-level StyleSheet.create(), utility functions, etc.
 * These read Dimensions.get('window') at call-time — NOT reactive.
 *
 * Inside React components, prefer useResponsiveLayout() which is reactive
 * to rotation, foldable unfold, and split-screen resize.
 *
 * @module utils/responsive
 */

import { Dimensions } from 'react-native';

// Re-export breakpoints from the hook for single source of truth
export { BREAKPOINTS } from '@/hooks/useResponsiveLayout';

// ============================================================================
// STATIC DEVICE DETECTION (snapshot at import-time)
// Backward-compatible exports — matches existing video-utils.ts & theme.ts API
// ============================================================================

const { width: _initWidth } = Dimensions.get('window');

/** @deprecated Prefer useResponsiveLayout().isSmallPhone inside components */
export const isSmallScreen = _initWidth < 375;

/** @deprecated Prefer useResponsiveLayout().isTablet inside components */
export const isTablet = _initWidth >= 768;

/** @deprecated Prefer useResponsiveLayout().isLargeTablet inside components */
export const isLargeScreen = _initWidth >= 1024;

// ============================================================================
// RESPONSIVE SIZE HELPERS (call-time snapshot, not reactive)
// ============================================================================

/**
 * Get responsive value based on current screen width.
 * Reads Dimensions at call-time so it picks up rotation if already happened.
 *
 * Drop-in replacement for the duplicated functions in ExploreCard, ExploreModal,
 * RecentQuestionCard, Section, and video-utils.
 *
 * @deprecated Inside React components, prefer useResponsiveLayout().responsiveValue()
 */
export function getResponsiveSize(small: number, medium: number, large: number): number {
  const { width } = Dimensions.get('window');
  if (width >= 768) return large;
  if (width < 375) return small;
  return medium;
}

/**
 * Get responsive padding based on current screen width.
 *
 * @deprecated Inside React components, prefer useResponsiveLayout().select()
 */
export function getResponsivePadding(): number {
  const { width } = Dimensions.get('window');
  if (width >= 1024) return 32;
  if (width >= 768) return 24;
  if (width < 375) return 16;
  return 20;
}
