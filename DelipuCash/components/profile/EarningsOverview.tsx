/**
 * EarningsOverview Component
 * Hero card showcasing wallet balance, earnings, and quick withdrawal action
 * 
 * Design: Cash App + Robinhood + Duolingo earnings card (2025-2026 style)
 * Features:
 * - Gradient background with decorative elements
 * - Large prominent balance display
 * - Quick action buttons (Withdraw, History)
 * - Animated value updates
 * - Motivational progress indicators
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * - High contrast text on gradient
 * - Screen reader optimized currency announcements
 * - 44x44dp touch targets
 * 
 * @example
 * ```tsx
 * <EarningsOverview
 *   walletBalance={12404.44}
 *   totalEarnings={24880.00}
 *   totalRewards={1240.00}
 *   userName="John"
 *   onWithdraw={() => navigateToWithdraw()}
 *   onViewHistory={() => navigateToHistory()}
 * />
 * ```
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  ArrowUpRight,
  History,
  Gift,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export interface EarningsOverviewProps {
  /** Current wallet balance */
  walletBalance: number;
  /** Total earnings amount */
  totalEarnings: number;
  /** Total rewards earned */
  totalRewards?: number;
  /** User's first name for personalization */
  userName?: string;
  /** Whether account is verified */
  isVerified?: boolean;
  /** Withdraw handler */
  onWithdraw?: () => void;
  /** View history handler */
  onViewHistory?: () => void;
  /** View rewards handler */
  onViewRewards?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Gradient colors override */
  gradientColors?: readonly [string, string, ...string[]];
  /** Test ID */
  testID?: string;
}

/**
 * Format currency with proper locale and animation-friendly output
 */
function formatCurrency(amount: number, showCents = true): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

export function EarningsOverview({
  walletBalance,
  totalEarnings,
  totalRewards = 0,
  userName,
  isVerified = false,
  onWithdraw,
  onViewHistory,
  onViewRewards,
  isLoading = false,
  gradientColors,
  testID,
}: EarningsOverviewProps): React.ReactElement {
  const { colors } = useTheme();

  // Button animation values
  const withdrawScale = useSharedValue(1);
  const historyScale = useSharedValue(1);

  const defaultGradient: readonly [string, string] = [colors.primary, withAlpha(colors.primary, 0.85)];
  const bgGradient = gradientColors || defaultGradient;

  const withdrawAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withdrawScale.value }],
  }));

  const historyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: historyScale.value }],
  }));

  const handleWithdrawPressIn = () => {
    withdrawScale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handleWithdrawPressOut = () => {
    withdrawScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handleWithdrawPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onWithdraw?.();
  };

  const handleHistoryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewHistory?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(500).springify()}
      style={[styles.container, SHADOWS.lg]}
      testID={testID}
    >
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />

        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.welcomeContainer}>
            {userName && (
              <AccessibleText
                variant="bodySmall"
                customColor="rgba(255,255,255,0.8)"
                style={styles.welcomeText}
              >
                Welcome back,
              </AccessibleText>
            )}
            <View style={styles.nameRow}>
              <AccessibleText
                variant="h3"
                customColor="#FFFFFF"
                headingLevel={2}
                accessibilityLabel={`Your wallet balance is ${formatCurrency(walletBalance)}`}
              >
                {userName || 'Your Wallet'}
              </AccessibleText>
              <Sparkles size={18} color="rgba(255,255,255,0.8)" />
            </View>
          </View>

          {isVerified && (
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={14} color="#FFF" strokeWidth={2.5} />
              <AccessibleText variant="caption" customColor="#FFFFFF">
                Verified
              </AccessibleText>
            </View>
          )}
        </View>

        {/* Balance Display */}
        <View style={styles.balanceContainer}>
          <Animated.View entering={FadeIn.delay(200).duration(400)}>
            <AccessibleText
              variant="caption"
              customColor="rgba(255,255,255,0.75)"
              accessibilityLabel="Current balance"
            >
              Available Balance
            </AccessibleText>
            <AccessibleText
              variant="h1"
              customColor="#FFFFFF"
              style={styles.balanceValue}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Balance: ${formatCurrency(walletBalance)}`}
            >
              {formatCurrency(walletBalance)}
            </AccessibleText>
          </Animated.View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Total Earnings */}
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <TrendingUp size={16} color="#FFF" strokeWidth={2} />
            </View>
            <View style={styles.statContent}>
              <AccessibleText variant="caption" customColor="rgba(255,255,255,0.75)">
                Total Earned
              </AccessibleText>
              <AccessibleText variant="h4" bold customColor="#FFFFFF">
                {formatCurrency(totalEarnings, false)}
              </AccessibleText>
            </View>
          </View>

          <View style={styles.statDivider} />

          {/* Total Rewards */}
          <TouchableOpacity
            style={styles.statItem}
            onPress={onViewRewards}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Total rewards: ${formatCurrency(totalRewards)}`}
            accessibilityHint="View your rewards"
          >
            <View style={styles.statIcon}>
              <Gift size={16} color="#FFF" strokeWidth={2} />
            </View>
            <View style={styles.statContent}>
              <AccessibleText variant="caption" customColor="rgba(255,255,255,0.75)">
                Rewards
              </AccessibleText>
              <AccessibleText variant="h4" bold customColor="#FFFFFF">
                {formatCurrency(totalRewards, false)}
              </AccessibleText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Withdraw Button */}
          <AnimatedTouchable
            style={[styles.withdrawButton, withdrawAnimatedStyle]}
            onPressIn={handleWithdrawPressIn}
            onPressOut={handleWithdrawPressOut}
            onPress={handleWithdrawPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Withdraw funds"
            accessibilityHint="Transfer balance to your mobile money"
          >
            <ArrowUpRight size={ICON_SIZE.lg} color={colors.primary} strokeWidth={2} />
            <AccessibleText
              variant="button"
              customColor={colors.primary}
            >
              Withdraw
            </AccessibleText>
          </AnimatedTouchable>

          {/* History Button */}
          <AnimatedTouchable
            style={[styles.historyButton, historyAnimatedStyle]}
            onPress={handleHistoryPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View transaction history"
          >
            <History size={ICON_SIZE.lg} color="#FFF" strokeWidth={2} />
            <AccessibleText variant="button" customColor="#FFFFFF">
              History
            </AccessibleText>
          </AnimatedTouchable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
  },
  gradient: {
    padding: SPACING.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  // Decorative elements
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorCircle3: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    marginBottom: SPACING.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  balanceContainer: {
    marginBottom: SPACING.lg,
  },
  balanceValue: {
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize['4xl'] : TYPOGRAPHY.fontSize['5xl'],
    letterSpacing: -1,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: SPACING.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    minHeight: 48,
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    minHeight: 48,
  },
});

export default EarningsOverview;
