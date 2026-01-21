/**
 * IconButton Component
 * A reusable button component for icon-only interactions
 * 
 * @example
 * ```tsx
 * <IconButton
 *   icon={<Heart size={24} />}
 *   onPress={() => handleLike()}
 *   variant="filled"
 *   size="medium"
 * />
 * ```
 */

import React, { memo, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  withAlpha,
} from '@/utils/theme';

/**
 * Icon button size variants
 */
export type IconButtonSize = 'small' | 'medium' | 'large';

/**
 * Icon button visual variants
 */
export type IconButtonVariant = 'ghost' | 'filled' | 'outline' | 'transparent';

/**
 * Props for the IconButton component
 */
export interface IconButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Callback when button is pressed */
  onPress?: () => void;
  /** Button size variant */
  size?: IconButtonSize;
  /** Visual style variant */
  variant?: IconButtonVariant;
  /** Custom background color (overrides variant) */
  backgroundColor?: string;
  /** Disables the button */
  disabled?: boolean;
  /** Enable haptic feedback on press */
  haptic?: boolean;
  /** Haptic feedback style */
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  /** Custom container style */
  style?: ViewStyle;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Test ID for testing */
  testID?: string;
}

const SIZE_CONFIG: Record<IconButtonSize, { size: number; padding: number }> = {
  small: { size: 32, padding: SPACING.xs },
  medium: { size: 40, padding: SPACING.sm },
  large: { size: 56, padding: SPACING.md },
};

function IconButtonComponent({
  icon,
  onPress,
  size = 'medium',
  variant = 'ghost',
  backgroundColor,
  disabled = false,
  haptic = true,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  style,
  accessibilityLabel,
  testID,
  ...props
}: IconButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const sizeConfig = SIZE_CONFIG[size];

  const handlePress = useCallback(() => {
    if (haptic) {
      Haptics.impactAsync(hapticStyle);
    }
    onPress?.();
  }, [haptic, hapticStyle, onPress]);

  const getVariantStyle = (): ViewStyle => {
    if (backgroundColor) {
      return { backgroundColor };
    }

    switch (variant) {
      case 'filled':
        return { backgroundColor: colors.primary };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'transparent':
        return { backgroundColor: 'transparent' };
      case 'ghost':
      default:
        return { backgroundColor: withAlpha(colors.card, 0.8) };
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        styles.container,
        {
          width: sizeConfig.size,
          height: sizeConfig.size,
          borderRadius: sizeConfig.size / 2,
          padding: sizeConfig.padding,
          opacity: disabled ? 0.5 : 1,
        },
        getVariantStyle(),
        style,
      ]}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const IconButton = memo(IconButtonComponent);
