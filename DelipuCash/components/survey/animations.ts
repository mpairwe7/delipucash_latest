/**
 * Survey Shared Animation Configs
 *
 * Centralized animation presets for consistent motion across survey components.
 * All animations respect reduced motion preference.
 */

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

// ============================================================================
// SPRING PRESETS
// ============================================================================

/** Quick responsive spring — buttons, toggles */
export const SPRING_QUICK: WithSpringConfig = {
  damping: 18,
  stiffness: 300,
  mass: 0.8,
};

/** Standard spring — cards, panels */
export const SPRING_STANDARD: WithSpringConfig = {
  damping: 16,
  stiffness: 200,
  mass: 1,
};

/** Gentle spring — page transitions, large elements */
export const SPRING_GENTLE: WithSpringConfig = {
  damping: 20,
  stiffness: 120,
  mass: 1.2,
};

/** Bouncy spring — success animations, badges */
export const SPRING_BOUNCY: WithSpringConfig = {
  damping: 10,
  stiffness: 150,
  mass: 0.9,
};

// ============================================================================
// TIMING PRESETS
// ============================================================================

/** Fast fade — tooltips, subtle transitions */
export const TIMING_FAST: WithTimingConfig = {
  duration: 150,
  easing: Easing.out(Easing.cubic),
};

/** Standard fade — modals, overlays */
export const TIMING_STANDARD: WithTimingConfig = {
  duration: 250,
  easing: Easing.out(Easing.cubic),
};

/** Slow fade — page transitions */
export const TIMING_SLOW: WithTimingConfig = {
  duration: 400,
  easing: Easing.out(Easing.cubic),
};

// ============================================================================
// SCALE PRESETS
// ============================================================================

/** Scale down on press (0.97) */
export const SCALE_PRESSED = 0.97;

/** Scale up for emphasis (1.05) */
export const SCALE_EMPHASIS = 1.05;

/** Scale for drag pickup (1.03) */
export const SCALE_DRAG = 1.03;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get duration respecting reduced motion preference.
 * Returns 0 for instant transitions when reduced motion is enabled.
 */
export function getAnimatedDuration(duration: number, isReducedMotion: boolean): number {
  return isReducedMotion ? 0 : duration;
}

/**
 * Get spring config respecting reduced motion.
 * Returns stiff spring for instant snap when reduced motion is enabled.
 */
export function getSpringConfig(
  config: WithSpringConfig,
  isReducedMotion: boolean,
): WithSpringConfig {
  if (isReducedMotion) {
    return { damping: 100, stiffness: 1000, mass: 0.5 };
  }
  return config;
}
