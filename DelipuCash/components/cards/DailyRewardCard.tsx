/**
 * DailyRewardCard Component
 * Displays daily reward status and claim button
 * 
 * @example
 * ```tsx
 * <DailyRewardCard
 *   isAvailable={true}
 *   currentStreak={7}
 *   todayReward={100}
 *   streakBonus={50}
 *   onClaim={() => claimReward()}
 *   isLoading={false}
 * />
 * ```
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Gift, Flame, Clock, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

export interface DailyRewardCardProps {
  /** Whether reward is available to claim */
  isAvailable: boolean;
  /** Hours until next reward (if not available) */
  nextRewardIn?: number;
  /** Current streak days */
  currentStreak: number;
  /** Today's reward amount (points) */
  todayReward: number;
  /** Bonus for streak */
  streakBonus?: number;
  /** Claim handler */
  onClaim?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Test ID for testing */
  testID?: string;
}

export function DailyRewardCard({
  isAvailable,
  nextRewardIn = 0,
  currentStreak,
  todayReward,
  streakBonus = 0,
  onClaim,
  isLoading = false,
  testID,
}: DailyRewardCardProps): React.ReactElement {
  const { colors } = useTheme();

  const totalReward = todayReward + streakBonus;

  return (
    <LinearGradient
      colors={
        isAvailable
          ? [colors.primary, withAlpha(colors.primary, 0.8)]
          : [colors.card, colors.card]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, !isAvailable && { borderWidth: 1, borderColor: colors.border }]}
    >
      <View style={styles.content}>
        {/* Left Section - Icon & Title */}
        <View style={styles.leftSection}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isAvailable
                  ? 'rgba(255, 255, 255, 0.2)'
                  : withAlpha(colors.primary, 0.15),
              },
            ]}
          >
            <Gift
              size={28}
              color={isAvailable ? '#FFFFFF' : colors.primary}
              strokeWidth={1.5}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.title,
                { color: isAvailable ? '#FFFFFF' : colors.text },
              ]}
            >
              Daily Reward
            </Text>
            <View style={styles.streakRow}>
              <Flame
                size={14}
                color={isAvailable ? '#FFD700' : colors.warning}
                fill={isAvailable ? '#FFD700' : colors.warning}
              />
              <Text
                style={[
                  styles.streakText,
                  {
                    color: isAvailable
                      ? 'rgba(255, 255, 255, 0.9)'
                      : colors.warning,
                  },
                ]}
              >
                {currentStreak} day streak
              </Text>
            </View>
          </View>
        </View>

        {/* Right Section - Reward & Action */}
        <View style={styles.rightSection}>
          {isAvailable ? (
            <>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardAmount}>+{totalReward}</Text>
                <Text style={styles.rewardLabel}>points</Text>
                {streakBonus > 0 && (
                  <Text style={styles.bonusText}>+{streakBonus} bonus!</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClaim}
                disabled={isLoading}
                activeOpacity={0.8}
                style={styles.claimButton}
                accessibilityRole="button"
                accessibilityLabel="Claim daily reward"
                testID={testID}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={[styles.claimText, { color: colors.primary }]}>
                      Claim
                    </Text>
                    <ChevronRight size={16} color={colors.primary} />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.waitingInfo}>
              <Clock size={20} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                Next in {nextRewardIn}h
              </Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xs,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  rewardInfo: {
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  rewardAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: '#FFFFFF',
  },
  rewardLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bonusText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFD700',
    marginTop: 2,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  claimText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  waitingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default DailyRewardCard;
