/**
 * Subscription Package Card Component
 * 
 * Displays RevenueCat subscription packages in a beautiful card format.
 * Works with Google Play Billing / App Store purchases.
 * 
 * @module components/payment/SubscriptionPackageCard
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { Check, Star, Zap, Crown } from 'lucide-react-native';

import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionPackageCardProps {
  /** The RevenueCat package to display */
  package: PurchasesPackage;
  /** Whether this package is selected */
  isSelected: boolean;
  /** Callback when the card is pressed */
  onSelect: () => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Optional label like "Most Popular" or "Best Value" */
  badge?: 'popular' | 'best-value' | 'recommended';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the period label for a package type
 */
const getPeriodLabel = (packageType: string): string => {
  switch (packageType) {
    case 'WEEKLY':
      return 'week';
    case 'MONTHLY':
      return 'month';
    case 'TWO_MONTH':
      return '2 months';
    case 'THREE_MONTH':
      return '3 months';
    case 'SIX_MONTH':
      return '6 months';
    case 'ANNUAL':
      return 'year';
    case 'LIFETIME':
      return 'one-time';
    default:
      return '';
  }
};

/**
 * Get friendly title for package type
 */
const getPackageTitle = (packageType: string): string => {
  switch (packageType) {
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'TWO_MONTH':
      return '2 Months';
    case 'THREE_MONTH':
      return '3 Months';
    case 'SIX_MONTH':
      return '6 Months';
    case 'ANNUAL':
      return 'Yearly';
    case 'LIFETIME':
      return 'Lifetime';
    case 'CUSTOM':
      return 'Custom';
    default:
      return packageType;
  }
};

/**
 * Get badge icon
 */
const getBadgeIcon = (badge: string) => {
  switch (badge) {
    case 'popular':
      return Star;
    case 'best-value':
      return Zap;
    case 'recommended':
      return Crown;
    default:
      return Star;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SubscriptionPackageCard: React.FC<SubscriptionPackageCardProps> = ({
  package: pkg,
  isSelected,
  onSelect,
  disabled = false,
  badge,
}) => {
  const { colors } = useTheme();

  const periodLabel = getPeriodLabel(pkg.packageType);
  const title = getPackageTitle(pkg.packageType);
  const BadgeIcon = badge ? getBadgeIcon(badge) : null;

  const styles = StyleSheet.create({
    container: {
      marginBottom: SPACING.base,
    },
    card: {
      backgroundColor: isSelected ? withAlpha(colors.primary, 0.1) : colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: isSelected ? BORDER_WIDTH.thick : BORDER_WIDTH.thin,
      borderColor: isSelected ? colors.primary : colors.border,
      opacity: disabled ? 0.5 : 1,
      ...SHADOWS.sm,
    },
    badge: {
      position: 'absolute',
      top: -12,
      right: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: badge === 'popular' 
        ? colors.warning 
        : badge === 'best-value' 
          ? colors.success 
          : colors.primary,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      gap: SPACING.xs,
    },
    badgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: '#FFFFFF',
      textTransform: 'uppercase',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    left: {
      flex: 1,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    description: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    right: {
      alignItems: 'flex-end',
    },
    price: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      color: isSelected ? colors.primary : colors.text,
    },
    period: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textMuted,
    },
    checkCircle: {
      position: 'absolute',
      top: SPACING.base,
      left: SPACING.base,
      width: 24,
      height: 24,
      borderRadius: RADIUS.full,
      backgroundColor: isSelected ? colors.primary : 'transparent',
      borderWidth: isSelected ? 0 : BORDER_WIDTH.thick,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const badgeLabel = badge === 'popular' 
    ? 'Most Popular' 
    : badge === 'best-value' 
      ? 'Best Value' 
      : badge === 'recommended' 
        ? 'Recommended' 
        : '';

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && !disabled && { opacity: 0.8 },
        ]}
        onPress={onSelect}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, disabled }}
        accessibilityLabel={`${title} subscription, ${pkg.product.priceString} per ${periodLabel}`}
      >
        {badge && BadgeIcon && (
          <View style={styles.badge}>
            <BadgeIcon size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        )}

        <View style={styles.checkCircle}>
          {isSelected && <Check size={16} color="#FFFFFF" />}
        </View>

        <View style={[styles.content, { marginLeft: 36 }]}>
          <View style={styles.left}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>
              {pkg.product.description || `Access for ${periodLabel}`}
            </Text>
          </View>

          <View style={styles.right}>
            <Text style={styles.price}>{pkg.product.priceString}</Text>
            {periodLabel && periodLabel !== 'one-time' && (
              <Text style={styles.period}>per {periodLabel}</Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

export default SubscriptionPackageCard;
