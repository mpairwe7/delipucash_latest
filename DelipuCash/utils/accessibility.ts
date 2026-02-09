/**
 * Accessibility Utilities
 * Helper functions and hooks for WCAG 2.2 AA compliance
 * 
 * Features:
 * - Dynamic type scaling helpers
 * - Touch target validation
 * - Contrast ratio utilities
 * - Screen reader announcements
 * - Reduced motion detection
 * - Focus management
 */

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  Platform,
} from 'react-native';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum touch target size per WCAG 2.2 AA (44x44 dp)
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Recommended touch target size for better accessibility
 */
export const RECOMMENDED_TOUCH_TARGET = 48;

/**
 * Minimum contrast ratio for normal text (WCAG 2.2 AA)
 */
export const MIN_CONTRAST_RATIO_NORMAL = 4.5;

/**
 * Minimum contrast ratio for large text (WCAG 2.2 AA)
 */
export const MIN_CONTRAST_RATIO_LARGE = 3;

/**
 * Large text threshold (18px or 14px bold)
 */
export const LARGE_TEXT_SIZE = 18;
export const LARGE_TEXT_BOLD_SIZE = 14;

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to detect if screen reader is enabled
 */
export function useScreenReader(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const checkScreenReader = async () => {
      const enabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsEnabled(enabled);
    };

    checkScreenReader();

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if reduce motion is enabled
 */
export function useReducedMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const checkReducedMotion = async () => {
      const enabled = await AccessibilityInfo.isReduceMotionEnabled();
      setIsEnabled(enabled);
    };

    checkReducedMotion();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if bold text is enabled (iOS)
 */
export function useBoldText(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const checkBoldText = async () => {
      const enabled = await AccessibilityInfo.isBoldTextEnabled();
      setIsEnabled(enabled);
    };

    checkBoldText();

    const subscription = AccessibilityInfo.addEventListener(
      'boldTextChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if grayscale is enabled (iOS)
 */
export function useGrayscale(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const checkGrayscale = async () => {
      const enabled = await AccessibilityInfo.isGrayscaleEnabled();
      setIsEnabled(enabled);
    };

    checkGrayscale();

    const subscription = AccessibilityInfo.addEventListener(
      'grayscaleChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if invert colors is enabled (iOS)
 */
export function useInvertColors(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const checkInvertColors = async () => {
      const enabled = await AccessibilityInfo.isInvertColorsEnabled();
      setIsEnabled(enabled);
    };

    checkInvertColors();

    const subscription = AccessibilityInfo.addEventListener(
      'invertColorsChanged',
      setIsEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return isEnabled;
}

/**
 * Combined accessibility settings hook
 */
export function useAccessibilitySettings() {
  const isScreenReaderEnabled = useScreenReader();
  const isReduceMotionEnabled = useReducedMotion();
  const isBoldTextEnabled = useBoldText();
  const isGrayscaleEnabled = useGrayscale();
  const isInvertColorsEnabled = useInvertColors();

  return {
    isScreenReaderEnabled,
    isReduceMotionEnabled,
    isBoldTextEnabled,
    isGrayscaleEnabled,
    isInvertColorsEnabled,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Announce message to screen readers
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Announce message with polite priority (waits for current speech)
 */
export function announcePolite(message: string): void {
  // On iOS, standard announcement is polite
  // On Android, we can add a delay for similar effect
  if (Platform.OS === 'android') {
    setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
    }, 500);
  } else {
    AccessibilityInfo.announceForAccessibility(message);
  }
}

/**
 * Calculate font size based on pixel ratio for dynamic type
 * @param baseFontSize - The base font size in points
 * @param maxMultiplier - Maximum scale multiplier (default: 1.5)
 */
export function getAccessibleFontSize(
  baseFontSize: number,
  maxMultiplier: number = 1.5
): number {
  const fontScale = PixelRatio.getFontScale();
  const scaledSize = baseFontSize * Math.min(fontScale, maxMultiplier);
  return Math.round(scaledSize);
}

/**
 * Ensure touch target meets minimum size requirements
 * @param size - The current size
 * @param minimum - Minimum size (default: 44dp)
 */
export function ensureMinTouchTarget(
  size: number,
  minimum: number = MIN_TOUCH_TARGET
): number {
  return Math.max(size, minimum);
}

/**
 * Calculate relative luminance for contrast calculations
 * @param rgb - RGB array [r, g, b] with values 0-255
 */
export function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @param color1 - RGB array [r, g, b]
 * @param color2 - RGB array [r, g, b]
 */
export function getContrastRatio(
  color1: [number, number, number],
  color2: [number, number, number]
): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA requirements
 * @param ratio - The contrast ratio
 * @param isLargeText - Whether the text is large (18px+ or 14px+ bold)
 */
export function meetsContrastRequirement(
  ratio: number,
  isLargeText: boolean = false
): boolean {
  const minRatio = isLargeText ? MIN_CONTRAST_RATIO_LARGE : MIN_CONTRAST_RATIO_NORMAL;
  return ratio >= minRatio;
}

/**
 * Parse hex color to RGB
 * @param hex - Hex color string (with or without #)
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

/**
 * Check color contrast between two hex colors
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; passes: boolean } {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return { ratio: 0, passes: false };
  }

  const ratio = getContrastRatio(fgRgb, bgRgb);
  const passes = meetsContrastRequirement(ratio, isLargeText);

  return { ratio: Math.round(ratio * 100) / 100, passes };
}

/**
 * Get appropriate max font size multiplier based on element type
 */
export function getMaxFontSizeMultiplier(
  elementType: 'body' | 'heading' | 'caption' | 'button' | 'label'
): number {
  switch (elementType) {
    case 'heading':
      return 1.3;
    case 'body':
      return 1.5;
    case 'caption':
      return 1.4;
    case 'button':
      return 1.2;
    case 'label':
      return 1.3;
    default:
      return 1.5;
  }
}

/**
 * Generate accessibility label for monetary values
 */
export function formatMoneyForAccessibility(
  amount: number,
  currency: string = 'UGX'
): string {
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  });
  return formatter.format(amount).replace('UGX', 'Ugandan shillings ');
}

/**
 * Generate accessibility label for counts/quantities
 */
export function formatCountForAccessibility(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Generate accessibility label for time durations
 */
export function formatDurationForAccessibility(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  let result = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  if (remainingSeconds > 0) {
    result += ` and ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
  }
  return result;
}

/**
 * Generate accessibility label for percentages
 */
export function formatPercentageForAccessibility(value: number, total: number): string {
  const percentage = Math.round((value / total) * 100);
  return `${percentage} percent complete, ${value} out of ${total}`;
}

// ============================================================================
// COMPONENT HELPERS
// ============================================================================

/**
 * Generate accessibility props for interactive cards
 */
export function getCardAccessibilityProps(options: {
  title: string;
  description?: string;
  action?: string;
  isDisabled?: boolean;
}): {
  accessible: boolean;
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityState: { disabled: boolean };
} {
  const { title, description, action, isDisabled = false } = options;

  let label = title;
  if (description) {
    label += `. ${description}`;
  }

  const hint = action || 'Double tap to open';

  return {
    accessible: true,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: { disabled: isDisabled },
  };
}

/**
 * Generate accessibility props for progress indicators
 */
export function getProgressAccessibilityProps(options: {
  label: string;
  value: number;
  max: number;
}): {
  accessible: boolean;
  accessibilityRole: 'progressbar';
  accessibilityLabel: string;
  accessibilityValue: {
    min: number;
    max: number;
    now: number;
    text: string;
  };
} {
  const { label, value, max } = options;
  const percentage = Math.round((value / max) * 100);

  return {
    accessible: true,
    accessibilityRole: 'progressbar',
    accessibilityLabel: label,
    accessibilityValue: {
      min: 0,
      max: max,
      now: value,
      text: `${percentage}%`,
    },
  };
}

/**
 * Generate accessibility props for section headers
 */
export function getSectionHeaderAccessibilityProps(options: {
  title: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}): {
  accessible: boolean;
  accessibilityRole: 'header';
  accessibilityLabel: string;
} {
  return {
    accessible: true,
    accessibilityRole: 'header',
    accessibilityLabel: options.title,
  };
}

export default {
  // Constants
  MIN_TOUCH_TARGET,
  RECOMMENDED_TOUCH_TARGET,
  MIN_CONTRAST_RATIO_NORMAL,
  MIN_CONTRAST_RATIO_LARGE,
  LARGE_TEXT_SIZE,
  LARGE_TEXT_BOLD_SIZE,
  // Hooks
  useScreenReader,
  useReducedMotion,
  useBoldText,
  useGrayscale,
  useInvertColors,
  useAccessibilitySettings,
  // Functions
  announce,
  announcePolite,
  getAccessibleFontSize,
  ensureMinTouchTarget,
  getContrastRatio,
  meetsContrastRequirement,
  hexToRgb,
  checkColorContrast,
  getMaxFontSizeMultiplier,
  formatMoneyForAccessibility,
  formatCountForAccessibility,
  formatDurationForAccessibility,
  formatPercentageForAccessibility,
  getCardAccessibilityProps,
  getProgressAccessibilityProps,
  getSectionHeaderAccessibilityProps,
};
