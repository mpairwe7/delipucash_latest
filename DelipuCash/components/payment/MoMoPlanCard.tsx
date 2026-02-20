/**
 * MoMo Plan Card Component
 *
 * Displays a Mobile Money subscription plan in a selectable card.
 * Styled consistently with SubscriptionPackageCard but for MoMo plans.
 *
 * @module components/payment/MoMoPlanCard
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, Star, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import type { MoMoPlan } from '@/services/subscriptionPaymentHooks';

// ============================================================================
// TYPES
// ============================================================================

export interface MoMoPlanCardProps {
  plan: MoMoPlan;
  isSelected: boolean;
  onSelect: (planType: string) => void;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MoMoPlanCard = React.memo<MoMoPlanCardProps>(({
  plan,
  isSelected,
  onSelect,
  disabled = false,
}) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(plan.type);
  }, [disabled, onSelect, plan.type]);

  const badge = plan.isPopular ? 'popular' : plan.isBestValue ? 'best-value' : null;

  const badgeConfig = badge === 'popular'
    ? { label: 'Most Popular', color: colors.primary, Icon: Star }
    : badge === 'best-value'
      ? { label: 'Best Value', color: colors.success, Icon: Zap }
      : null;

  const borderColor = isSelected ? colors.primary : withAlpha(colors.border, 0.3);
  const backgroundColor = isSelected ? withAlpha(colors.primary, 0.06) : colors.card;

  const formattedPrice = `UGX ${plan.price.toLocaleString()}`;
  const periodLabel = getPeriodLabel(plan.type, plan.durationDays);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled }}
      accessibilityLabel={`${plan.name} plan, ${formattedPrice} per ${periodLabel}`}
      style={({ pressed }) => [
        styles.container,
        { borderColor, backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      {/* Badge */}
      {badgeConfig && (
        <View style={[styles.badge, { backgroundColor: withAlpha(badgeConfig.color, 0.12) }]}>
          <badgeConfig.Icon size={10} color={badgeConfig.color} />
          <Text style={[styles.badgeText, { color: badgeConfig.color }]}>
            {badgeConfig.label}
          </Text>
        </View>
      )}

      {/* Content row */}
      <View style={styles.row}>
        {/* Selection indicator */}
        <View style={[
          styles.checkCircle,
          {
            borderColor: isSelected ? colors.primary : withAlpha(colors.text, 0.25),
            backgroundColor: isSelected ? colors.primary : 'transparent',
          },
        ]}>
          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>

        {/* Plan info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{plan.name}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {plan.description}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: colors.text }]}>{formattedPrice}</Text>
          <Text style={[styles.period, { color: colors.textMuted }]}>/ {periodLabel}</Text>
          {plan.savings && (
            <Text style={[styles.savings, { color: colors.success }]}>{plan.savings}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

MoMoPlanCard.displayName = 'MoMoPlanCard';

// ============================================================================
// HELPERS
// ============================================================================

function getPeriodLabel(type: string, durationDays: number): string {
  switch (type) {
    case 'ONCE': return 'one-time';
    case 'DAILY': return 'day';
    case 'WEEKLY': return 'week';
    case 'MONTHLY': return 'month';
    case 'QUARTERLY': return '3 months';
    case 'HALF_YEARLY': return '6 months';
    case 'YEARLY': return 'year';
    case 'LIFETIME': return 'lifetime';
    default: return `${durationDays} days`;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.xs,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  info: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  period: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xxs,
  },
  savings: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.xxs,
    marginTop: 2,
  },
});
