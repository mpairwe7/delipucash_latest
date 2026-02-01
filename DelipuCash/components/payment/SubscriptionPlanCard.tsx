/**
 * Subscription Plan Card Component
 * 
 * A reusable card component for displaying subscription plan options.
 * Supports different plan types with pricing and selection state.
 * 
 * @module components/payment/SubscriptionPlanCard
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
import { Check, Crown, Star, Zap, Clock, Gift } from 'lucide-react-native';
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
import { SurveySubscriptionType } from '@/types';

/**
 * Subscription plan types - alias for SurveySubscriptionType for backwards compatibility
 */
export type SubscriptionPlanType = SurveySubscriptionType;

/**
 * Plan configuration interface
 */
export interface PlanConfig {
  type: SubscriptionPlanType;
  label: string;
  price: number;
  currency: string;
  description?: string;
  savings?: string;
  isBestValue?: boolean;
  isPopular?: boolean;
}

/**
 * Props for the SubscriptionPlanCard component
 */
export interface SubscriptionPlanCardProps {
  /** Plan configuration */
  plan: PlanConfig;
  /** Whether this plan is currently selected */
  isSelected: boolean;
  /** Callback when plan is selected */
  onSelect: (plan: SubscriptionPlanType) => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Get icon for plan type
 */
const getPlanIcon = (type: SubscriptionPlanType, color: string, size: number) => {
  switch (type) {
    case SurveySubscriptionType.LIFETIME:
      return <Crown size={size} color={color} />;
    case SurveySubscriptionType.YEARLY:
      return <Star size={size} color={color} />;
    case SurveySubscriptionType.HALF_YEARLY:
    case SurveySubscriptionType.QUARTERLY:
    case SurveySubscriptionType.MONTHLY:
      return <Zap size={size} color={color} />;
    case SurveySubscriptionType.WEEKLY:
    case SurveySubscriptionType.DAILY:
      return <Clock size={size} color={color} />;
    case SurveySubscriptionType.ONCE:
    default:
      return <Gift size={size} color={color} />;
  }
};

/**
 * Subscription Plan Card Component
 * 
 * Displays a subscription plan option with pricing and selection state.
 * 
 * @example
 * ```tsx
 * <SubscriptionPlanCard
 *   plan={{
 *     type: 'MONTHLY',
 *     label: 'Monthly',
 *     price: 2000,
 *     currency: 'UGX',
 *     isPopular: true,
 *   }}
 *   isSelected={selectedPlan === 'MONTHLY'}
 *   onSelect={setSelectedPlan}
 * />
 * ```
 */
export const SubscriptionPlanCard = memo<SubscriptionPlanCardProps>(({
  plan,
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
    if (!disabled) {
      onSelect(plan.type);
    }
  }, [disabled, onSelect, plan.type]);

  const styles = StyleSheet.create({
    wrapper: {
      width: '48%',
      marginBottom: SPACING.md,
    },
    container: {
      backgroundColor: isSelected 
        ? withAlpha(colors.primary, 0.1) 
        : colors.card,
      borderRadius: RADIUS.base,
      borderWidth: isSelected ? BORDER_WIDTH.thick : BORDER_WIDTH.thin,
      borderColor: isSelected ? colors.primary : colors.border,
      padding: SPACING.base,
      alignItems: 'center',
      opacity: disabled ? 0.5 : 1,
      position: 'relative',
      ...SHADOWS.sm,
    },
    badge: {
      position: 'absolute',
      top: -SPACING.sm,
      right: -SPACING.xs,
      backgroundColor: plan.isBestValue ? colors.success : colors.warning,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xxs,
      borderRadius: RADIUS.sm,
    },
    badgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.primaryText,
      textTransform: 'uppercase',
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: isSelected 
        ? withAlpha(colors.primary, 0.2) 
        : colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: isSelected ? colors.primary : colors.text,
      textAlign: 'center',
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: SPACING.xs,
    },
    price: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.text,
    },
    currency: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginLeft: SPACING.xxs,
    },
    description: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    savings: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.success,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    checkContainer: {
      position: 'absolute',
      top: SPACING.sm,
      left: SPACING.sm,
      width: 18,
      height: 18,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const iconColor = isSelected ? colors.primary : colors.textSecondary;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
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
        accessibilityLabel={`${plan.label} plan, ${plan.price} ${plan.currency}`}
        accessibilityHint={isSelected ? 'Currently selected' : 'Double tap to select'}
      >
        {(plan.isBestValue || plan.isPopular) && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {plan.isBestValue ? 'Best Value' : 'Popular'}
            </Text>
          </View>
        )}

        {isSelected && (
          <View style={styles.checkContainer}>
            <Check size={ICON_SIZE.xs} color={colors.primaryText} />
          </View>
        )}

        <View style={styles.iconContainer}>
          {getPlanIcon(plan.type, iconColor, ICON_SIZE.lg)}
        </View>

        <Text style={styles.label}>{plan.label}</Text>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {plan.price.toLocaleString()}
          </Text>
          <Text style={styles.currency}>{plan.currency}</Text>
        </View>

        {plan.description && (
          <Text style={styles.description}>{plan.description}</Text>
        )}

        {plan.savings && (
          <Text style={styles.savings}>{plan.savings}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

SubscriptionPlanCard.displayName = 'SubscriptionPlanCard';

export default SubscriptionPlanCard;
