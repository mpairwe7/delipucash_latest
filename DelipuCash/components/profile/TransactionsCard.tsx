/**
 * TransactionsCard Component
 * Interactive card linking to Transactions screen with earnings & streak context
 * 
 * Design: Cash App + Robinhood activity cards (2025-2026 style)
 * Features:
 * - Prominent earned amount display
 * - Streak indicator with fire animation
 * - Recent transactions preview
 * - Smooth navigation with haptic feedback
 * - Gradient accent for premium feel
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * - Screen reader optimized
 * - 44x44dp touch targets
 * - High contrast text
 * 
 * @example
 * ```tsx
 * <TransactionsCard
 *   totalEarned={24880}
 *   currentStreak={7}
 *   recentTransactions={transactions}
 *   onPress={() => router.push('/(tabs)/transactions')}
 * />
 * ```
 */

import React, { memo, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Flame,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Zap,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
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
import { ProgressRing } from './ProgressRing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export interface RecentTransaction {
  id: string;
  type: 'reward' | 'withdrawal' | 'deposit' | 'payment';
  amount: number;
  title: string;
  createdAt: Date;
  status: 'completed' | 'pending' | 'failed';
}

export interface TransactionsCardProps {
  /** Total earnings amount */
  totalEarned: number;
  /** Current streak in days */
  currentStreak: number;
  /** Maximum streak for progress */
  maxStreak?: number;
  /** Recent transactions preview (max 3) */
  recentTransactions?: RecentTransaction[];
  /** Press handler for navigation */
  onPress?: () => void;
  /** Streak press handler */
  onStreakPress?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Test ID */
  testID?: string;
}

/**
 * Format currency with proper locale
 */
function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format relative time
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Transaction item component
 */
const TransactionItem = memo(function TransactionItem({
  transaction,
  colors,
}: {
  transaction: RecentTransaction;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const isPositive = transaction.type === 'reward' || transaction.type === 'deposit';
  const Icon = isPositive ? ArrowDownLeft : ArrowUpRight;
  const amountColor = isPositive ? colors.success : colors.error;

  return (
    <View style={styles.transactionItem}>
      <View
        style={[
          styles.transactionIcon,
          { backgroundColor: withAlpha(amountColor, 0.1) },
        ]}
      >
        <Icon size={14} color={amountColor} strokeWidth={2} />
      </View>
      <View style={styles.transactionContent}>
        <AccessibleText variant="bodySmall" numberOfLines={1} style={styles.transactionTitle}>
          {transaction.title}
        </AccessibleText>
        <AccessibleText variant="caption" color="textMuted">
          {formatTimeAgo(transaction.createdAt)}
        </AccessibleText>
      </View>
      <AccessibleText
        variant="bodySmall"
        bold
        customColor={amountColor}
      >
        {isPositive ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
      </AccessibleText>
    </View>
  );
});

export const TransactionsCard = memo(function TransactionsCard({
  totalEarned,
  currentStreak,
  maxStreak = 30,
  recentTransactions = [],
  onPress,
  onStreakPress,
  isLoading = false,
  testID,
}: TransactionsCardProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values
  const cardScale = useSharedValue(1);
  const flamePulse = useSharedValue(1);

  // Flame pulse animation for active streaks
  React.useEffect(() => {
    if (currentStreak > 0) {
      flamePulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStreak]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const flameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flamePulse.value }],
  }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handleStreakPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStreakPress?.();
  };

  // Calculate streak progress
  const streakProgress = Math.min(currentStreak / maxStreak, 1);

  // Display only first 3 transactions
  const displayTransactions = useMemo(() => {
    return recentTransactions.slice(0, 3);
  }, [recentTransactions]);

  return (
    <Animated.View
      entering={FadeInDown.delay(150).duration(400).springify()}
      testID={testID}
    >
      <Animated.View style={[cardAnimatedStyle]}>
        <AnimatedTouchable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          activeOpacity={0.95}
          style={[styles.container, { backgroundColor: colors.card }, SHADOWS.md]}
          accessibilityRole="button"
          accessibilityLabel={`View transactions. Total earned ${formatCurrency(totalEarned)}. Current streak ${currentStreak} days.`}
          accessibilityHint="Opens transaction history"
        >
          {/* Header with Title and Arrow */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                <TrendingUp size={ICON_SIZE.lg} color={colors.success} strokeWidth={2} />
              </View>
              <View>
                <AccessibleText variant="h4" headingLevel={3}>
                  Activity & Earnings
                </AccessibleText>
                <AccessibleText variant="caption" color="textMuted">
                  Your transaction history
                </AccessibleText>
              </View>
            </View>
            <ChevronRight size={ICON_SIZE.lg} color={colors.textMuted} />
          </View>

          {/* Stats Row - Earned and Streak */}
          <View style={styles.statsRow}>
            {/* Total Earned */}
            <View style={[styles.statCard, { backgroundColor: withAlpha(colors.success, 0.08) }]}>
              <LinearGradient
                colors={[withAlpha(colors.success, 0.15), 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statGradient}
              />
              <View style={styles.statHeader}>
                <Zap size={16} color={colors.success} strokeWidth={2} />
                <AccessibleText variant="caption" color="textMuted">
                  Total Earned
                </AccessibleText>
              </View>
              <AccessibleText
                variant="h2"
                bold
                color="success"
                style={styles.statValue}
                accessibilityLabel={`Total earned: ${formatCurrency(totalEarned)}`}
              >
                {formatCurrency(totalEarned, isSmallScreen)}
              </AccessibleText>
              <AccessibleText variant="caption" color="success" style={styles.statSubtext}>
                Lifetime earnings
              </AccessibleText>
            </View>

            {/* Current Streak */}
            <TouchableOpacity
              onPress={handleStreakPress}
              activeOpacity={0.8}
              style={[styles.statCard, { backgroundColor: withAlpha(colors.warning, 0.08) }]}
              accessibilityRole="button"
              accessibilityLabel={`Current streak: ${currentStreak} days. Progress toward ${maxStreak} day goal.`}
              accessibilityHint="View streak details"
            >
              <LinearGradient
                colors={[withAlpha(colors.warning, 0.15), 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statGradient}
              />
              <View style={styles.streakHeader}>
                <Animated.View style={flameAnimatedStyle}>
                  <ProgressRing
                    progress={streakProgress}
                    size={48}
                    strokeWidth={4}
                    color={colors.warning}
                    gradientEndColor={colors.error}
                  >
                    <Flame size={18} color={colors.warning} strokeWidth={2} />
                  </ProgressRing>
                </Animated.View>
                <View style={styles.streakContent}>
                  <AccessibleText variant="h2" bold color="warning">
                    {currentStreak}
                  </AccessibleText>
                  <AccessibleText variant="caption" color="textMuted">
                    day streak
                  </AccessibleText>
                </View>
              </View>
              <View style={styles.streakProgress}>
                <View style={[styles.progressBar, { backgroundColor: withAlpha(colors.warning, 0.2) }]}>
                  <Animated.View
                    entering={FadeIn.delay(300).duration(500)}
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.warning,
                        width: `${streakProgress * 100}%`,
                      },
                    ]}
                  />
                </View>
                <AccessibleText variant="caption" color="textMuted">
                  {maxStreak - currentStreak} days to goal
                </AccessibleText>
              </View>
            </TouchableOpacity>
          </View>

          {/* Recent Transactions */}
          {displayTransactions.length > 0 && (
            <View style={styles.transactionsSection}>
              <View style={styles.transactionsHeader}>
                <AccessibleText variant="label" color="textMuted">
                  Recent Activity
                </AccessibleText>
                <Clock size={14} color={colors.textMuted} />
              </View>
              <View style={styles.transactionsList}>
                {displayTransactions.map((transaction) => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          )}

          {/* View All Link */}
          <View style={[styles.viewAllContainer, { borderTopColor: colors.border }]}>
            <AccessibleText variant="button" color="primary">
              View All Transactions
            </AccessibleText>
            <ChevronRight size={16} color={colors.primary} />
          </View>
        </AnimatedTouchable>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  statGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize['2xl'] : TYPOGRAPHY.fontSize['3xl'],
    letterSpacing: -0.5,
  },
  statSubtext: {
    marginTop: 2,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  streakContent: {
    alignItems: 'flex-start',
  },
  streakProgress: {
    gap: SPACING.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  transactionsSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  transactionsList: {
    gap: SPACING.sm,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  transactionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionTitle: {
    marginBottom: 2,
  },
  viewAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    marginHorizontal: SPACING.lg,
  },
});

export default TransactionsCard;
