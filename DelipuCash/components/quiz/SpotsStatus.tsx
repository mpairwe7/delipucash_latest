/**
 * Spots Status Indicator - Visual feedback for winner slot availability
 * 
 * Shows:
 * - Number of spots left vs total
 * - Color-coded availability status
 * - Animated fill animation
 * - Progress bar visualization
 * - Accessibility labels
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Users, Lock, AlertCircle } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  ICON_SIZE,
  withAlpha,
} from '@/utils/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpotsStatusProps {
  spotsLeft: number;
  maxWinners: number;
  winnersCount: number;
  isFull: boolean;
  isExpiringSoon?: boolean;
  isExpired?: boolean;
  isCompleted?: boolean;
  compact?: boolean;
}

// ─── Spots Status Component ──────────────────────────────────────────────────

export const SpotsStatus: React.FC<SpotsStatusProps> = ({
  spotsLeft,
  maxWinners,
  winnersCount,
  isFull,
  isExpiringSoon = false,
  isExpired = false,
  isCompleted = false,
  compact = false,
}) => {
  const { colors } = useTheme();

  // Determine status
  const status = useMemo(() => {
    if (isExpired) return 'expired';
    if (isCompleted) return 'completed';
    if (isFull) return 'full';
    if (isExpiringSoon) return 'expiring';
    return 'available';
  }, [isExpired, isCompleted, isFull, isExpiringSoon]);

  // Get colors and labels based on status
  const statusInfo = useMemo(() => {
    switch (status) {
      case 'expired':
        return {
          color: colors.error,
          backgroundColor: withAlpha(colors.error, 0.08),
          borderColor: colors.error,
          label: 'Expired',
          icon: Lock,
          message: 'Question has expired',
        };
      case 'completed':
        return {
          color: colors.warning,
          backgroundColor: withAlpha(colors.warning, 0.08),
          borderColor: colors.warning,
          label: 'Completed',
          icon: AlertCircle,
          message: 'All spots filled',
        };
      case 'full':
        return {
          color: colors.error,
          backgroundColor: withAlpha(colors.error, 0.1),
          borderColor: colors.error,
          label: 'Full',
          icon: Lock,
          message: 'No spots remaining',
        };
      case 'expiring':
        return {
          color: colors.warning,
          backgroundColor: withAlpha(colors.warning, 0.08),
          borderColor: colors.warning,
          label: 'Expiring Soon',
          icon: AlertCircle,
          message: 'Limited time left',
        };
      default:
        return {
          color: colors.success,
          backgroundColor: withAlpha(colors.success, 0.08),
          borderColor: colors.success,
          label: `${spotsLeft} Spot${spotsLeft !== 1 ? 's' : ''}`,
          icon: Users,
          message: `${spotsLeft} winner spot${spotsLeft !== 1 ? 's' : ''} available`,
        };
    }
  }, [status, colors, spotsLeft]);

  const StatusIcon = statusInfo.icon;

  // Animated fill progress
  const fillProgress = useSharedValue(0);

  React.useEffect(() => {
    const progress = maxWinners > 0 ? winnersCount / maxWinners : 0;
    fillProgress.value = withDelay(
      200,
      withTiming(progress, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [winnersCount, maxWinners, fillProgress]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value * 100}%`,
  }));

  if (compact) {
    // Compact badge version
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          styles.compactBadge,
          {
            backgroundColor: statusInfo.backgroundColor,
            borderColor: statusInfo.borderColor,
          },
        ]}
        accessible
        accessibilityLabel={statusInfo.message}
      >
        <StatusIcon
          size={ICON_SIZE.xs}
          color={statusInfo.color}
          strokeWidth={1.5}
        />
        <Text
          style={[styles.compactBadgeText, { color: statusInfo.color }]}
        >
          {statusInfo.label}
        </Text>
      </Animated.View>
    );
  }

  // Full card version with progress bar
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        styles.card,
        {
          backgroundColor: statusInfo.backgroundColor,
          borderColor: statusInfo.borderColor,
        },
      ]}
      accessible
      accessibilityLabel={statusInfo.message}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: withAlpha(statusInfo.color, 0.15) },
            ]}
          >
            <StatusIcon
              size={ICON_SIZE.md}
              color={statusInfo.color}
              strokeWidth={1.5}
            />
          </View>
          <View>
            <Text
              style={[styles.label, { color: statusInfo.color }]}
              accessibilityRole="header"
            >
              {statusInfo.label}
            </Text>
            <Text style={[styles.message, { color: colors.textMuted }]}>
              {statusInfo.message}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      {spotsLeft >= 0 && !isExpired && !isCompleted && maxWinners > 0 && (
        <>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: withAlpha(statusInfo.color, 0.1),
                borderColor: statusInfo.color,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: statusInfo.color,
                },
                animatedFillStyle,
              ]}
            />
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Winners
              </Text>
              <Text
                style={[styles.statValue, { color: statusInfo.color }]}
                accessibilityLabel={`${winnersCount} winners`}
              >
                {winnersCount}/{maxWinners}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Remaining
              </Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: isFull ? colors.error : colors.success,
                  },
                ]}
                accessibilityLabel={`${spotsLeft} spots remaining`}
              >
                {Math.max(0, spotsLeft)}
              </Text>
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
};

// ─── Inline Badge for Quick Status (for list items) ─────────────────────────

export type SpotsInlineBadgeProps = SpotsStatusProps;

export const SpotsInlineBadge: React.FC<SpotsInlineBadgeProps> = (props) => {
  return <SpotsStatus {...props} compact={true} />;
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },

  iconCircle: {
    width: ICON_SIZE.lg + SPACING.sm,
    height: ICON_SIZE.lg + SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },

  message: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  progressBar: {
    height: 8,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.xs,
  },

  statItem: {
    alignItems: 'center',
    flex: 1,
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
  },

  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },

  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },

  compactBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: '600',
  },
});

export default SpotsStatus;
