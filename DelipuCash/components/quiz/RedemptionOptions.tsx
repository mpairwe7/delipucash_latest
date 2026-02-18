/**
 * Enhanced Redemption Options - Visual Card-based Redemption Selection
 * 
 * Features:
 * - Two redemption paths: Cash & Airtime
 * - Visual cards with icons and value displays
 * - Quick redeem shortcut for repeat redeemers
 * - Balance display
 * - Accessibility support
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Banknote,
  Smartphone,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
  withAlpha,
} from '@/utils/theme';
import { formatCurrency } from '@/services';
import { triggerHaptic } from '@/utils/quiz-utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RedemptionType = 'CASH' | 'AIRTIME';

export interface RedemptionOption {
  type: RedemptionType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export interface RedemptionOptionsProps {
  availableBalance: number;
  canRedeem: boolean;
  onSelectCash?: () => void;
  onSelectAirtime?: () => void;
  lastRedemption?: {
    provider: 'MTN' | 'AIRTEL';
    phoneNumber: string;
  } | null;
  onQuickRedeem?: (provider: 'MTN' | 'AIRTEL', phoneNumber: string) => void;
}

// ─── Redemption Option Card ──────────────────────────────────────────────────

interface RedemptionOptionCardProps {
  type: RedemptionType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  isEnabled: boolean;
  onPress?: () => void;
}

const RedemptionOptionCard: React.FC<RedemptionOptionCardProps> = ({
  type,
  title,
  description,
  icon,
  color,
  isEnabled,
  onPress,
}) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    if (!isEnabled) return;
    triggerHaptic('medium');
    onPress?.();
  }, [isEnabled, onPress]);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Pressable
        onPress={handlePress}
        disabled={!isEnabled}
        style={({ pressed }) => [
          styles.optionCard,
          {
            backgroundColor: isEnabled
              ? withAlpha(color, 0.08)
              : withAlpha(colors.textMuted, 0.05),
            borderColor: isEnabled ? color : colors.border,
            opacity: pressed && isEnabled ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={description}
        accessibilityState={{ disabled: !isEnabled }}
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: withAlpha(color, 0.12),
              },
            ]}
          >
            {icon}
          </View>

          <View style={styles.textContent}>
            <Text
              style={[
                styles.cardTitle,
                {
                  color: isEnabled ? colors.text : colors.textMuted,
                },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.cardDescription,
                {
                  color: colors.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {description}
            </Text>
          </View>

          <ChevronRight
            size={ICON_SIZE.md}
            color={isEnabled ? color : colors.border}
            strokeWidth={1.5}
            style={{ opacity: isEnabled ? 1 : 0.5 }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Main Redemption Options Component ───────────────────────────────────────

export const RedemptionOptions: React.FC<RedemptionOptionsProps> = ({
  availableBalance,
  canRedeem,
  onSelectCash,
  onSelectAirtime,
  lastRedemption,
  onQuickRedeem,
}) => {
  const { colors } = useTheme();

  const options: RedemptionOption[] = useMemo(
    () => [
      {
        type: 'CASH',
        title: 'Cash Transfer',
        description: 'Direct to your mobile wallet',
        icon: (
          <Banknote
            size={ICON_SIZE.lg}
            color={colors.success}
            strokeWidth={1.5}
          />
        ),
        color: colors.success,
      },
      {
        type: 'AIRTIME',
        title: 'Airtime',
        description: 'Mobile credit for MTN or Airtel',
        icon: (
          <Smartphone
            size={ICON_SIZE.lg}
            color={colors.primary}
            strokeWidth={1.5}
          />
        ),
        color: colors.primary,
      },
    ],
    [colors]
  );

  const handleCashPress = useCallback(() => {
    triggerHaptic('medium');
    onSelectCash?.();
  }, [onSelectCash]);

  const handleAirtimePress = useCallback(() => {
    triggerHaptic('medium');
    onSelectAirtime?.();
  }, [onSelectAirtime]);

  const handleQuickRedeem = useCallback(() => {
    if (!lastRedemption) return;
    triggerHaptic('medium');
    onQuickRedeem?.(lastRedemption.provider, lastRedemption.phoneNumber);
  }, [lastRedemption, onQuickRedeem]);

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.balanceCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.balanceRow}>
          <Text
            style={[styles.balanceLabel, { color: colors.textMuted }]}
            accessibilityRole="header"
          >
            Available Balance
          </Text>
          <Text
            style={[styles.balanceAmount, { color: colors.primary }]}
            accessibilityLabel={`Balance: ${formatCurrency(availableBalance)}`}
          >
            {formatCurrency(availableBalance)}
          </Text>
        </View>

        {!canRedeem && availableBalance > 0 && (
          <View
            style={[
              styles.minRedemptionWarning,
              {
                backgroundColor: withAlpha(colors.warning, 0.08),
                borderColor: colors.warning,
              },
            ]}
          >
            <AlertCircle
              size={ICON_SIZE.sm}
              color={colors.warning}
              strokeWidth={1.5}
            />
            <Text
              style={[
                styles.minRedemptionText,
                { color: colors.warning },
              ]}
            >
              Minimum balance required for redemption
            </Text>
          </View>
        )}

        {availableBalance <= 0 && (
          <View
            style={[
              styles.noBalanceAlert,
              {
                backgroundColor: withAlpha(colors.error, 0.08),
                borderColor: colors.error,
              },
            ]}
          >
            <AlertCircle
              size={ICON_SIZE.sm}
              color={colors.error}
              strokeWidth={1.5}
            />
            <Text
              style={[
                styles.noBalanceText,
                { color: colors.error },
              ]}
            >
              No balance available for redemption
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Redemption Options */}
      <View style={styles.optionsSection}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          How would you like to redeem?
        </Text>

        {options.map((option, index) => (
          <RedemptionOptionCard
            key={option.type}
            type={option.type}
            title={option.title}
            description={option.description}
            icon={option.icon}
            color={option.color}
            isEnabled={canRedeem}
            onPress={
              option.type === 'CASH'
                ? handleCashPress
                : handleAirtimePress
            }
          />
        ))}
      </View>

      {/* Quick Redeem Shortcut */}
      {canRedeem && lastRedemption && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={[
            styles.quickRedeemCard,
            {
              backgroundColor: withAlpha(colors.success, 0.1),
              borderColor: colors.success,
            },
          ]}
        >
          <Pressable
            onPress={handleQuickRedeem}
            style={({ pressed }) => [
              styles.quickRedeemContent,
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Quick redeem"
            accessibilityHint={`Send ${formatCurrency(availableBalance)} to ${lastRedemption.provider} ${lastRedemption.phoneNumber}`}
          >
            <View
              style={[
                styles.quickRedeemIcon,
                { backgroundColor: withAlpha(colors.success, 0.15) },
              ]}
            >
              <CheckCircle2
                size={ICON_SIZE.md}
                color={colors.success}
                strokeWidth={1.5}
              />
            </View>

            <View style={styles.quickRedeemText}>
              <Text
                style={[styles.quickRedeemTitle, { color: colors.success }]}
              >
                Quick Redeem
              </Text>
              <Text
                style={[styles.quickRedeemSubtitle, { color: colors.textMuted }]}
              >
                {lastRedemption.provider} • {lastRedemption.phoneNumber}
              </Text>
            </View>

            <ChevronRight
              size={ICON_SIZE.md}
              color={colors.success}
              strokeWidth={1.5}
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },

  balanceCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  balanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  balanceAmount: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },

  minRedemptionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },

  minRedemptionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  noBalanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },

  noBalanceText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  optionsSection: {
    gap: SPACING.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },

  optionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  iconContainer: {
    width: ICON_SIZE.lg + SPACING.md,
    height: ICON_SIZE.lg + SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },

  cardDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },

  quickRedeemCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    overflow: 'hidden',
  },

  quickRedeemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },

  quickRedeemIcon: {
    width: ICON_SIZE.lg + SPACING.md,
    height: ICON_SIZE.lg + SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickRedeemText: {
    flex: 1,
  },

  quickRedeemTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },

  quickRedeemSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});

export default RedemptionOptions;
