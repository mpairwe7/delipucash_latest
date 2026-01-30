/**
 * AchievementBadge Component
 * Visual badge for achievements and milestones
 * 
 * Design: Duolingo achievements + gamification (2025-2026 style)
 * Features:
 * - Animated reveal on unlock
 * - Multiple badge types/tiers
 * - Progress indicators for locked badges
 * 
 * @example
 * ```tsx
 * <AchievementBadge
 *   type="streak"
 *   title="7-Day Streak"
 *   isUnlocked={true}
 *   progress={1}
 *   onPress={() => showBadgeDetails()}
 * />
 * ```
 */

import React, { useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Flame,
  Trophy,
  Star,
  Target,
  Zap,
  Award,
  Crown,
  Medal,
  Lock,
  LucideIcon,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

// Responsive breakpoints for future use
// const { width: SCREEN_WIDTH } = Dimensions.get('window');
// const isSmallScreen = SCREEN_WIDTH < 375;

export type BadgeType =
  | 'streak'
  | 'earnings'
  | 'firstWithdraw'
  | 'surveyStar'
  | 'questionMaster'
  | 'videoWatcher'
  | 'topEarner'
  | 'loyalty'
  | 'referral';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

const BADGE_ICONS: Record<BadgeType, LucideIcon> = {
  streak: Flame,
  earnings: Trophy,
  firstWithdraw: Zap,
  surveyStar: Star,
  questionMaster: Target,
  videoWatcher: Award,
  topEarner: Crown,
  loyalty: Medal,
  referral: Star,
};

const TIER_COLORS: Record<BadgeTier, { primary: string; secondary: string }> = {
  bronze: { primary: '#CD7F32', secondary: '#A0522D' },
  silver: { primary: '#C0C0C0', secondary: '#A0A0A0' },
  gold: { primary: '#FFD700', secondary: '#FFA500' },
  platinum: { primary: '#E5E4E2', secondary: '#B0B0B0' },
};

export interface AchievementBadgeProps {
  /** Badge type */
  type: BadgeType;
  /** Badge tier */
  tier?: BadgeTier;
  /** Badge title */
  title: string;
  /** Badge description */
  description?: string;
  /** Whether badge is unlocked */
  isUnlocked?: boolean;
  /** Progress toward unlocking (0-1) */
  progress?: number;
  /** Date unlocked */
  unlockedAt?: Date;
  /** Press handler */
  onPress?: () => void;
  /** Badge size */
  size?: 'small' | 'medium' | 'large';
  /** Show animation on mount */
  animate?: boolean;
  /** Test ID */
  testID?: string;
}

const BADGE_SIZES = {
  small: { container: 60, icon: 24 },
  medium: { container: 80, icon: 32 },
  large: { container: 100, icon: 40 },
};

export function AchievementBadge({
  type,
  tier = 'gold',
  title,
  description,
  isUnlocked = false,
  progress = 0,
  unlockedAt,
  onPress,
  size = 'medium',
  animate = true,
  testID,
}: AchievementBadgeProps): React.ReactElement {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const shine = useSharedValue(0);

  const Icon = BADGE_ICONS[type] || Award;
  const tierColors = TIER_COLORS[tier];
  const dimensions = BADGE_SIZES[size];

  // Unlock animation
  useEffect(() => {
    if (animate && isUnlocked) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 300 })
      );

      // Shine effect
      shine.value = withTiming(1, { duration: 1000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, animate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.9, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
    onPress();
  };

  const content = (
    <View style={styles.badgeContent}>
      {/* Badge Circle */}
      <Animated.View
        style={[
          styles.badgeCircle,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
          },
          animatedStyle,
        ]}
        entering={animate ? ZoomIn.duration(400).springify() : undefined}
      >
        {isUnlocked ? (
          <LinearGradient
            colors={[tierColors.primary, tierColors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.gradientCircle,
              {
                borderRadius: dimensions.container / 2,
              },
            ]}
          >
            <Icon size={dimensions.icon} color="#FFF" strokeWidth={2} />
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.lockedCircle,
              {
                backgroundColor: withAlpha(colors.border, 0.5),
                borderRadius: dimensions.container / 2,
              },
            ]}
          >
            <Lock size={dimensions.icon * 0.75} color={colors.textMuted} strokeWidth={2} />
            
            {/* Progress ring (simplified) */}
            {progress > 0 && (
              <View
                style={[
                  styles.progressOverlay,
                  {
                    borderRadius: dimensions.container / 2,
                    borderColor: colors.primary,
                    borderWidth: 3,
                    opacity: progress,
                  },
                ]}
              />
            )}
          </View>
        )}
      </Animated.View>

      {/* Title */}
      <AccessibleText
        variant="bodySmall"
        medium
        center
        color={isUnlocked ? 'text' : 'textMuted'}
        numberOfLines={2}
        style={styles.title}
      >
        {title}
      </AccessibleText>

      {/* Description or Progress */}
      {description && isUnlocked && (
        <AccessibleText
          variant="caption"
          center
          color="textMuted"
          numberOfLines={1}
        >
          {description}
        </AccessibleText>
      )}

      {!isUnlocked && progress > 0 && (
        <AccessibleText
          variant="caption"
          center
          color="primary"
        >
          {Math.round(progress * 100)}%
        </AccessibleText>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title} badge${isUnlocked ? ', unlocked' : ', locked'}`}
        accessibilityHint={description || (isUnlocked ? 'Tap for details' : `${Math.round(progress * 100)}% progress`)}
        testID={testID}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${title} badge${isUnlocked ? ', unlocked' : ', locked'}`}
      testID={testID}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  badgeContent: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  badgeCircle: {
    ...SHADOWS.md,
  },
  gradientCircle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCircle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  title: {
    maxWidth: 80,
    marginTop: SPACING.xs,
  },
});

export default AchievementBadge;
