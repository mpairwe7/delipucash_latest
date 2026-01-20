import React, { memo, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type TouchableOpacityProps,
} from 'react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  COMPONENT_SIZE,
  BORDER_WIDTH,
  OPACITY,
} from '@/utils/theme';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

/**
 * Button size types
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Props for the PrimaryButton component
 */
export interface PrimaryButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Button text */
  title: string;
  /** Callback when button is pressed */
  onPress?: () => void;
  /** Shows loading spinner and disables button */
  loading?: boolean;
  /** Disables the button */
  disabled?: boolean;
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to display on the left */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right */
  rightIcon?: React.ReactNode;
  /** Container style */
  style?: ViewStyle;
  /** Text style override */
  textStyle?: TextStyle;
  /** Test ID for testing */
  testID?: string;
}

interface SizeStyle {
  paddingVertical: number;
  paddingHorizontal: number;
  fontSize: number;
  height: number;
}

interface VariantStyle {
  backgroundColor: string;
  borderWidth: number;
  borderColor?: string;
  textColor: string;
}

const SIZE_STYLES: Record<ButtonSize, SizeStyle> = {
  small: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.base,
    fontSize: TYPOGRAPHY.fontSize.base,
    height: COMPONENT_SIZE.button.small,
  },
  medium: {
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.xl,
    fontSize: TYPOGRAPHY.fontSize.lg,
    height: COMPONENT_SIZE.button.medium,
  },
  large: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING['2xl'],
    fontSize: TYPOGRAPHY.fontSize.xl,
    height: COMPONENT_SIZE.button.large,
  },
};

/**
 * Primary button component with loading state, variants, and sizes.
 * Follows React Native accessibility best practices.
 *
 * @example
 * ```tsx
 * <PrimaryButton
 *   title="Submit"
 *   onPress={handleSubmit}
 *   loading={isSubmitting}
 *   variant="primary"
 *   size="medium"
 * />
 * ```
 */
export const PrimaryButton = memo<PrimaryButtonProps>(({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  leftIcon,
  rightIcon,
  style,
  textStyle,
  testID,
  ...props
}) => {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const currentSize = SIZE_STYLES[size];

  const variantStyles = useMemo((): VariantStyle => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          borderWidth: BORDER_WIDTH.none,
          textColor: isDisabled ? colors.textDisabled : colors.secondaryText,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: BORDER_WIDTH.base,
          borderColor: isDisabled ? colors.border : colors.primary,
          textColor: isDisabled ? colors.textDisabled : colors.primary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: BORDER_WIDTH.none,
          textColor: isDisabled ? colors.textDisabled : colors.primary,
        };
      case 'primary':
      default:
        return {
          backgroundColor: isDisabled ? colors.textMuted : colors.primary,
          borderWidth: BORDER_WIDTH.none,
          textColor: colors.primaryText,
        };
    }
  }, [variant, isDisabled, colors]);

  const styles = StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: variantStyles.backgroundColor,
      borderWidth: variantStyles.borderWidth,
      borderColor: variantStyles.borderColor,
      borderRadius: RADIUS.base,
      minHeight: currentSize.height,
      paddingVertical: currentSize.paddingVertical,
      paddingHorizontal: currentSize.paddingHorizontal,
    },
    iconLeft: {
      marginRight: SPACING.sm,
    },
    iconRight: {
      marginLeft: SPACING.sm,
    },
    text: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: currentSize.fontSize,
      color: variantStyles.textColor,
      textAlign: 'center',
    },
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={OPACITY.subtle}
      style={[styles.button, style]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} size="small" />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text style={[styles.text, textStyle]}>{title}</Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
});

PrimaryButton.displayName = 'PrimaryButton';

export default PrimaryButton;
