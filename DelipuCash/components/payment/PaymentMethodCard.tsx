/**
 * Payment Method Card Component
 *
 * A selectable card for choosing between Google Play, MTN MoMo, or Airtel Money.
 * Supports brand colors, badges, and accessible radio-selection semantics.
 *
 * @module components/payment/PaymentMethodCard
 */

import React, { memo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
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

export type PaymentMethodType = 'GOOGLE_PLAY' | 'MTN_MOMO' | 'AIRTEL_MONEY';

export interface PaymentMethodCardProps {
  method: PaymentMethodType;
  name: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: (method: PaymentMethodType) => void;
  badge?: 'recommended' | 'popular' | null;
  brandColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const PaymentMethodCard = memo<PaymentMethodCardProps>(({
  method,
  name,
  description,
  icon,
  isSelected,
  onSelect,
  badge,
  brandColor,
  disabled = false,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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
    if (!disabled) onSelect(method);
  }, [disabled, onSelect, method]);

  const accentColor = isSelected ? (brandColor ?? colors.primary) : colors.border;

  const badgeColors = {
    recommended: colors.primary,
    popular: colors.warning,
  };

  const badgeLabels = {
    recommended: 'Recommended',
    popular: 'Popular',
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: isSelected
              ? withAlpha(accentColor, 0.08)
              : colors.card,
            borderColor: accentColor,
            borderWidth: isSelected ? BORDER_WIDTH.thick : BORDER_WIDTH.thin,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        testID={testID}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected, disabled }}
        accessibilityLabel={`${name} payment method`}
        accessibilityHint={isSelected ? 'Currently selected' : 'Double tap to select'}
      >
        {/* Left accent strip */}
        <View
          style={[
            styles.accentStrip,
            { backgroundColor: isSelected ? accentColor : 'transparent' },
          ]}
        />

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: withAlpha(accentColor, 0.12) }]}>
          {icon}
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <Text
            style={[
              styles.name,
              { color: isSelected ? accentColor : colors.text },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={[styles.description, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>

        {/* Badge */}
        {badge && (
          <View
            style={[
              styles.badge,
              { backgroundColor: withAlpha(badgeColors[badge], 0.15) },
            ]}
          >
            <Text style={[styles.badgeText, { color: badgeColors[badge] }]}>
              {badgeLabels[badge]}
            </Text>
          </View>
        )}

        {/* Check indicator */}
        {isSelected && (
          <View style={[styles.checkContainer, { backgroundColor: accentColor }]}>
            <Check size={ICON_SIZE.sm} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

PaymentMethodCard.displayName = 'PaymentMethodCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    minHeight: 72,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.base,
  },
  textContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: 2,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.4,
  },
  badge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkContainer: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
});

export default PaymentMethodCard;
