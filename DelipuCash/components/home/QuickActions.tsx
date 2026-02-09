/**
 * QuickActions Component
 * Large, icon-based action buttons for primary earning activities
 * 
 * Design: TikTok + Cash App + Duolingo inspired quick action row
 * Accessibility: WCAG 2.2 AA compliant with 44x44dp touch targets
 * 
 * @example
 * ```tsx
 * <QuickActions
 *   onAnswerQuestion={() => router.push('/questions')}
 *   onWatchVideo={() => router.push('/videos')}
 *   onTakeSurvey={() => router.push('/surveys')}
 *   onClaimReward={() => claimDailyReward()}
 *   dailyRewardAvailable={true}
 * />
 * ```
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircleQuestion,
  Play,
  ClipboardList,
  Gift,
  Sparkles,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { triggerHaptic } from '@/utils/quiz-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Responsive sizing
const ACTION_SIZE = isSmallScreen ? 56 : 64;
const ICON_SIZE = isSmallScreen ? 24 : 28;

export interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  colors: readonly [string, string];
  onPress: () => void;
  badge?: string | number;
  isHighlighted?: boolean;
  accessibilityHint?: string;
}

export interface QuickActionsProps {
  /** Handler for Answer Question action */
  onAnswerQuestion?: () => void;
  /** Handler for Watch Video action */
  onWatchVideo?: () => void;
  /** Handler for Take Survey action */
  onTakeSurvey?: () => void;
  /** Handler for Claim Reward action */
  onClaimReward?: () => void;
  /** Whether daily reward is available */
  dailyRewardAvailable?: boolean;
  /** Number of available questions */
  availableQuestions?: number;
  /** Number of running surveys */
  runningSurveys?: number;
  /** Custom actions (overrides defaults) */
  actions?: QuickAction[];
  /** Test ID prefix */
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function QuickActionButton({
  action,
  index,
  testID,
}: {
  action: QuickAction;
  index: number;
  testID?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    triggerHaptic('medium');
    action.onPress();
  }, [action]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 50).duration(400).springify()}
      style={styles.actionWrapper}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.actionButton, animatedStyle]}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.accessibilityHint || `Tap to ${action.label.toLowerCase()}`}
        testID={testID ? `${testID}-${action.id}` : undefined}
      >
        <LinearGradient
          colors={action.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.actionGradient,
            action.isHighlighted && styles.actionHighlighted,
          ]}
        >
          {action.icon}
          
          {/* Badge */}
          {action.badge !== undefined && action.badge !== 0 && (
            <Animated.View
              entering={ZoomIn.delay(300 + index * 50)}
              style={[styles.badge, { backgroundColor: colors.error }]}
            >
              <Text
                style={styles.badgeText}
                accessibilityLabel={`${action.badge} new`}
              >
                {typeof action.badge === 'number' && action.badge > 99
                  ? '99+'
                  : action.badge}
              </Text>
            </Animated.View>
          )}
          
          {/* Sparkle indicator for highlighted */}
          {action.isHighlighted && (
            <Animated.View
              entering={ZoomIn.delay(200)}
              style={styles.sparkle}
            >
              <Sparkles size={14} color="#FFD700" fill="#FFD700" />
            </Animated.View>
          )}
        </LinearGradient>
      </AnimatedPressable>
      
      {/* Label */}
      <Text
        style={[styles.actionLabel, { color: colors.text }]}
        numberOfLines={1}
        allowFontScaling
        maxFontSizeMultiplier={1.3}
      >
        {action.label}
      </Text>
      
      {/* Sublabel */}
      {action.sublabel && (
        <Text
          style={[styles.actionSublabel, { color: colors.textMuted }]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          {action.sublabel}
        </Text>
      )}
    </Animated.View>
  );
}

export function QuickActions({
  onAnswerQuestion,
  onWatchVideo,
  onTakeSurvey,
  onClaimReward,
  dailyRewardAvailable = false,
  availableQuestions = 0,
  runningSurveys = 0,
  actions: customActions,
  testID = 'quick-actions',
}: QuickActionsProps): React.ReactElement {
  const { colors } = useTheme();

  // Default actions if not provided
  const defaultActions: QuickAction[] = [
    {
      id: 'answer',
      icon: <MessageCircleQuestion size={ICON_SIZE} color="#FFFFFF" strokeWidth={1.5} />,
      label: 'Answer',
      sublabel: availableQuestions > 0 ? `${availableQuestions} new` : undefined,
      colors: ['#667eea', '#764ba2'] as const,
      onPress: onAnswerQuestion || (() => {}),
      badge: availableQuestions > 0 ? availableQuestions : undefined,
      accessibilityHint: 'Answer questions to earn rewards',
    },
    {
      id: 'watch',
      icon: <Play size={ICON_SIZE} color="#FFFFFF" strokeWidth={1.5} fill="#FFFFFF" />,
      label: 'Watch',
      sublabel: 'Earn points',
      colors: ['#FF6B6B', '#FF8E53'] as const,
      onPress: onWatchVideo || (() => {}),
      accessibilityHint: 'Watch videos to earn rewards',
    },
    {
      id: 'survey',
      icon: <ClipboardList size={ICON_SIZE} color="#FFFFFF" strokeWidth={1.5} />,
      label: 'Survey',
      sublabel: runningSurveys > 0 ? `${runningSurveys} live` : undefined,
      colors: ['#4ECDC4', '#44A08D'] as const,
      onPress: onTakeSurvey || (() => {}),
      badge: runningSurveys > 0 ? runningSurveys : undefined,
      accessibilityHint: 'Take surveys to earn rewards',
    },
    {
      id: 'reward',
      icon: <Gift size={ICON_SIZE} color="#FFFFFF" strokeWidth={1.5} />,
      label: 'Reward',
      sublabel: dailyRewardAvailable ? 'Claim now!' : 'Claimed',
      colors: dailyRewardAvailable
        ? (['#f093fb', '#f5576c'] as const)
        : ([withAlpha(colors.textMuted, 0.5), withAlpha(colors.textMuted, 0.3)] as const),
      onPress: onClaimReward || (() => {}),
      isHighlighted: dailyRewardAvailable,
      accessibilityHint: dailyRewardAvailable
        ? 'Claim your daily reward now'
        : 'Daily reward already claimed, come back tomorrow',
    },
  ];

  const actionsToRender = customActions || defaultActions;

  return (
    <View
      style={styles.container}
      accessibilityRole="toolbar"
      accessibilityLabel="Quick actions"
    >
      <Animated.View
        entering={FadeInDown.delay(50).duration(300)}
        style={styles.header}
      >
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          Start Earning
        </Text>
      </Animated.View>

      <View style={styles.actionsRow}>
        {actionsToRender.map((action, index) => (
          <QuickActionButton
            key={action.id}
            action={action}
            index={index}
            testID={testID}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  actionWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: ACTION_SIZE + 24,
  },
  actionButton: {
    marginBottom: SPACING.sm,
  },
  actionGradient: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  actionHighlighted: {
    ...SHADOWS.lg,
  },
  actionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize.xs : TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  actionSublabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.xxs,
  },
  badge: {
    position: 'absolute',
    top: -SPACING.xs,
    right: -SPACING.xs,
    minWidth: 18,
    height: 18,
    borderRadius: RADIUS.md + 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
  },
  sparkle: {
    position: 'absolute',
    top: -2,
    left: -2,
  },
});

export default QuickActions;
