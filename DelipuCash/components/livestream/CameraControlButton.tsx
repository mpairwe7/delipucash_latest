/**
 * CameraControlButton Component
 * Reusable camera control button with consistent styling
 * Design System Compliant - Uses theme tokens
 */

import React, { memo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SHADOWS } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface CameraControlButtonProps {
  /** Button icon component */
  icon: React.ReactNode;
  /** Press handler */
  onPress: () => void;
  /** Button size variant */
  size?: 'small' | 'medium' | 'large';
  /** Button style variant */
  variant?: 'default' | 'primary' | 'danger';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Custom style overrides */
  style?: ViewStyle;
  /** Accessibility label */
  accessibilityLabel: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIZES = {
  small: { button: 36, radius: 18 },
  medium: { button: 44, radius: 22 },
  large: { button: 52, radius: 26 },
} as const;

const VARIANTS = {
  default: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  danger: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderColor: 'transparent',
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const CameraControlButton = memo<CameraControlButtonProps>(({
  icon,
  onPress,
  size = 'medium',
  variant = 'default',
  disabled = false,
  hapticFeedback = true,
  style,
  accessibilityLabel,
}) => {
  const sizeConfig = SIZES[size];
  const variantConfig = VARIANTS[variant];

  const handlePress = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[
        styles.button,
        {
          width: sizeConfig.button,
          height: sizeConfig.button,
          borderRadius: sizeConfig.radius,
          backgroundColor: variantConfig.backgroundColor,
          borderColor: variantConfig.borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
});

CameraControlButton.displayName = 'CameraControlButton';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...SHADOWS.sm,
  },
});

export default CameraControlButton;
