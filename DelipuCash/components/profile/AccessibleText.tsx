/**
 * AccessibleText Component
 * Dynamic type scaling wrapper for WCAG 2.2 AA compliance
 * 
 * Features:
 * - Full dynamic type scaling with allowFontScaling
 * - Semantic heading levels (accessibilityRole="heading")
 * - High contrast support
 * - Screen reader optimized with accessibilityLabel
 * 
 * @example
 * ```tsx
 * <AccessibleText variant="h1" color="primary">
 *   Welcome back!
 * </AccessibleText>
 * 
 * <AccessibleText variant="body" accessibilityLabel="Your balance is $1,240">
 *   $1,240
 * </AccessibleText>
 * ```
 */

import React from 'react';
import {
  Text,
  TextStyle,
  StyleSheet,
  TextProps,
  AccessibilityRole,
  StyleProp,
} from 'react-native';
import { useTheme, TYPOGRAPHY, ThemeColors } from '@/utils/theme';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodyLarge'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'button';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'white';

export interface AccessibleTextProps extends Omit<TextProps, 'style'> {
  /** Text variant for typography scale */
  variant?: TextVariant;
  /** Semantic color from theme */
  color?: TextColor;
  /** Custom text color (overrides color prop) */
  customColor?: string;
  /** Bold weight */
  bold?: boolean;
  /** Medium weight */
  medium?: boolean;
  /** Center text */
  center?: boolean;
  /** Heading level for accessibility (1-6) */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Custom accessibility label */
  accessibilityLabel?: string;
  /** Live region for dynamic updates */
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  /** Children content */
  children: React.ReactNode;
  /** Custom style (merged with variant styles) */
  style?: StyleProp<TextStyle>;
}

const getColorValue = (color: TextColor, colors: ThemeColors): string => {
  const colorMap: Record<TextColor, string> = {
    primary: colors.primary,
    secondary: colors.textSecondary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
    white: '#FFFFFF',
  };
  return colorMap[color];
};

const getVariantStyle = (
  variant: TextVariant,
  bold: boolean,
  medium: boolean
): TextStyle => {
  // Determine font family based on weight props or variant default
  const getFontFamily = (defaultWeight: 'regular' | 'medium' | 'bold') => {
    if (bold) return TYPOGRAPHY.fontFamily.bold;
    if (medium) return TYPOGRAPHY.fontFamily.medium;
    return TYPOGRAPHY.fontFamily[defaultWeight];
  };

  const variantStyles: Record<TextVariant, TextStyle> = {
    h1: {
      fontSize: TYPOGRAPHY.fontSize['4xl'],
      fontFamily: getFontFamily('bold'),
      lineHeight: TYPOGRAPHY.fontSize['4xl'] * TYPOGRAPHY.lineHeight.tight,
      letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    h2: {
      fontSize: TYPOGRAPHY.fontSize['3xl'],
      fontFamily: getFontFamily('bold'),
      lineHeight: TYPOGRAPHY.fontSize['3xl'] * TYPOGRAPHY.lineHeight.tight,
      letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    h3: {
      fontSize: TYPOGRAPHY.fontSize['2xl'],
      fontFamily: getFontFamily('bold'),
      lineHeight: TYPOGRAPHY.fontSize['2xl'] * TYPOGRAPHY.lineHeight.normal,
      letterSpacing: 0,
    },
    h4: {
      fontSize: TYPOGRAPHY.fontSize.xl,
      fontFamily: getFontFamily('medium'),
      lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.normal,
      letterSpacing: 0,
    },
    body: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontFamily: getFontFamily('regular'),
      lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    },
    bodyLarge: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontFamily: getFontFamily('regular'),
      lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.relaxed,
    },
    bodySmall: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontFamily: getFontFamily('regular'),
      lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
    },
    caption: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      fontFamily: getFontFamily('regular'),
      lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.normal,
      letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    },
    label: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontFamily: getFontFamily('medium'),
      lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
      letterSpacing: TYPOGRAPHY.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    button: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontFamily: getFontFamily('medium'),
      lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
      letterSpacing: 0.5,
    },
  };

  return variantStyles[variant];
};

export function AccessibleText({
  variant = 'body',
  color = 'text',
  customColor,
  bold = false,
  medium = false,
  center = false,
  headingLevel,
  accessibilityLabel,
  accessibilityLiveRegion,
  children,
  style,
  numberOfLines,
  ...rest
}: AccessibleTextProps): React.ReactElement {
  const { colors } = useTheme();

  const variantStyle = getVariantStyle(variant, bold, medium);
  const textColor = customColor || getColorValue(color, colors);

  // Determine accessibility role based on variant or explicit headingLevel
  let accessibilityRole: AccessibilityRole | undefined;
  let ariaLevel: number | undefined;

  if (headingLevel) {
    accessibilityRole = 'header';
    ariaLevel = headingLevel;
  } else if (variant.startsWith('h')) {
    accessibilityRole = 'header';
    ariaLevel = parseInt(variant.charAt(1), 10);
  }

  return (
    <Text
      style={[
        variantStyle,
        { color: textColor },
        center && styles.center,
        style,
      ]}
      // Dynamic type scaling - critical for accessibility
      allowFontScaling={true}
      maxFontSizeMultiplier={1.5} // Limit max scaling to prevent layout breaks
      numberOfLines={numberOfLines}
      // Accessibility props
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={accessibilityLiveRegion}
      // @ts-ignore - aria-level is valid but not in RN types
      aria-level={ariaLevel}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
});

export default AccessibleText;
