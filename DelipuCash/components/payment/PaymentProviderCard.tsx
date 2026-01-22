/**
 * Payment Provider Card Component
 * 
 * A reusable card component for selecting mobile money payment providers.
 * Follows design system patterns with proper accessibility and animations.
 * 
 * @module components/payment/PaymentProviderCard
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Check } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  ICON_SIZE,
  withAlpha,
} from '@/utils/theme';

/**
 * Payment provider types supported
 */
export type PaymentProvider = 'MTN' | 'AIRTEL';

/**
 * Props for the PaymentProviderCard component
 */
export interface PaymentProviderCardProps {
  /** Provider identifier */
  provider: PaymentProvider;
  /** Display name for the provider */
  name: string;
  /** Logo image source */
  logo: ImageSourcePropType;
  /** Whether this provider is currently selected */
  isSelected: boolean;
  /** Callback when provider is selected */
  onSelect: (provider: PaymentProvider) => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Payment Provider Card Component
 * 
 * Displays a selectable payment provider option with logo and name.
 * Includes selection state animations and accessibility support.
 * 
 * @example
 * ```tsx
 * <PaymentProviderCard
 *   provider="MTN"
 *   name="MTN Mobile Money"
 *   logo={require('@/assets/images/mtnlogo.png')}
 *   isSelected={selectedProvider === 'MTN'}
 *   onSelect={setSelectedProvider}
 * />
 * ```
 */
export const PaymentProviderCard = memo<PaymentProviderCardProps>(({
  provider,
  name,
  logo,
  isSelected,
  onSelect,
  disabled = false,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      onSelect(provider);
    }
  }, [disabled, onSelect, provider]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isSelected 
        ? withAlpha(colors.primary, 0.1) 
        : colors.card,
      borderRadius: RADIUS.base,
      borderWidth: isSelected ? BORDER_WIDTH.thick : BORDER_WIDTH.thin,
      borderColor: isSelected ? colors.primary : colors.border,
      padding: SPACING.base,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 100,
      opacity: disabled ? 0.5 : 1,
      ...SHADOWS.sm,
    },
    logoContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    name: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: isSelected ? colors.primary : colors.text,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    checkContainer: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      width: 20,
      height: 20,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        testID={testID}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected, disabled }}
        accessibilityLabel={`${name} payment provider`}
        accessibilityHint={isSelected ? 'Currently selected' : 'Double tap to select'}
      >
        {isSelected && (
          <View style={styles.checkContainer}>
            <Check size={ICON_SIZE.sm} color={colors.primaryText} />
          </View>
        )}
        <View style={styles.logoContainer}>
          <Image source={logo} style={styles.logo} />
        </View>
        <Text style={styles.name}>{name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

PaymentProviderCard.displayName = 'PaymentProviderCard';

export default PaymentProviderCard;
