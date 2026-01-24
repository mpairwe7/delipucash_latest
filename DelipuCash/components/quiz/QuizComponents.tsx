/**
 * Quiz Session Components
 * Reusable components for the quiz session experience
 * 
 * Design System:
 * - Uses theme tokens from @/utils/theme
 * - Consistent spacing, typography, and colors
 * - Accessibility-first approach
 * - Haptic feedback integration
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import {
  Check,
  X,
  CheckCircle2,
  XCircle,
  Circle,
  Square,
  CheckSquare,
  Flame,
  Star,
  Clock,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  withAlpha,
} from '@/utils/theme';
import { triggerHaptic, formatTime, getTimerColor } from '@/utils/quiz-utils';
import type { AnswerOption } from '@/store/QuizStore';

// ===========================================
// Progress Bar
// ===========================================

interface QuizProgressBarProps {
  current: number;
  total: number;
  animationDuration?: number;
}

export const QuizProgressBar: React.FC<QuizProgressBarProps> = ({
  current,
  total,
  animationDuration = 300,
}) => {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const progress = total > 0 ? current / total : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: animationDuration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [current, total, progressAnim, animationDuration]);

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: widthInterpolate,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressText, { color: colors.textMuted }]}>
        {current}/{total}
      </Text>
    </View>
  );
};

// ===========================================
// Circular Timer
// ===========================================

interface CircularTimerProps {
  timeRemaining: number;
  totalTime: number;
  size?: number;
  strokeWidth?: number;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({
  timeRemaining,
  totalTime,
  size = 64,
  strokeWidth = 4,
}) => {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timeRemaining / totalTime;
  const strokeDashoffset = circumference * (1 - progress);
  
  const timerColor = getTimerColor(timeRemaining, totalTime, {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  });

  return (
    <View style={[styles.timerContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={timerColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.timerTextContainer}>
        <Clock size={12} color={timerColor} strokeWidth={2} />
        <Text style={[styles.timerText, { color: timerColor }]}>
          {formatTime(timeRemaining)}
        </Text>
      </View>
    </View>
  );
};

// ===========================================
// Score Badge
// ===========================================

interface ScoreBadgeProps {
  points: number;
  streak?: number;
  animate?: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  points,
  streak = 0,
  animate = true,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animate && points > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [points, animate, scaleAnim]);

  return (
    <View style={styles.scoreBadgeContainer}>
      <Animated.View
        style={[
          styles.scoreBadge,
          { 
            backgroundColor: withAlpha(colors.primary, 0.15),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Star size={14} color={colors.primary} fill={colors.primary} strokeWidth={0} />
        <Text style={[styles.scoreBadgeText, { color: colors.primary }]}>
          {points}
        </Text>
      </Animated.View>

      {streak > 0 && (
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: withAlpha(colors.warning, 0.15) },
          ]}
        >
          <Flame size={14} color={colors.warning} fill={colors.warning} strokeWidth={0} />
          <Text style={[styles.streakBadgeText, { color: colors.warning }]}>
            {streak}
          </Text>
        </View>
      )}
    </View>
  );
};

// ===========================================
// Option Button (Single/Multi Choice)
// ===========================================

interface OptionButtonProps {
  option: AnswerOption;
  index: number;
  isSelected: boolean;
  isCorrect?: boolean | null;
  isRevealed?: boolean;
  isMultiSelect?: boolean;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  option,
  index,
  isSelected,
  isCorrect,
  isRevealed = false,
  isMultiSelect = false,
  onSelect,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const optionKey = optionKeys[index] || String(index + 1);

  // Determine styling based on state
  const getOptionStyle = useCallback(() => {
    if (isRevealed) {
      if (isCorrect === true) {
        return {
          backgroundColor: withAlpha(colors.success, 0.1),
          borderColor: colors.success,
        };
      }
      if (isCorrect === false && isSelected) {
        return {
          backgroundColor: withAlpha(colors.error, 0.1),
          borderColor: colors.error,
        };
      }
    }

    if (isSelected) {
      return {
        backgroundColor: withAlpha(colors.primary, 0.1),
        borderColor: colors.primary,
      };
    }

    return {
      backgroundColor: colors.card,
      borderColor: colors.border,
    };
  }, [isRevealed, isCorrect, isSelected, colors]);

  const handlePress = () => {
    if (disabled) return;

    // Haptic feedback
    triggerHaptic('selection');

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    onSelect(option.id);
  };

  const optionStyle = getOptionStyle();

  // Icon for multi-select
  const SelectIcon = isMultiSelect
    ? isSelected
      ? CheckSquare
      : Square
    : isSelected
    ? CheckCircle2
    : Circle;

  // Result icon
  const ResultIcon = isCorrect === true ? Check : isCorrect === false ? X : null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.optionButton,
          {
            backgroundColor: optionStyle.backgroundColor,
            borderColor: optionStyle.borderColor,
          },
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessibilityLabel={`Option ${optionKey}: ${option.text}`}
        accessibilityRole="button"
        accessibilityState={{
          selected: isSelected,
          disabled,
        }}
      >
        {/* Option Key */}
        <View
          style={[
            styles.optionKey,
            {
              backgroundColor: isSelected
                ? colors.primary
                : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.optionKeyText,
              {
                color: isSelected ? colors.background : colors.textMuted,
              },
            ]}
          >
            {optionKey}
          </Text>
        </View>

        {/* Option Text */}
        <Text
          style={[
            styles.optionText,
            {
              color: colors.text,
              flex: 1,
            },
          ]}
        >
          {option.text}
        </Text>

        {/* Selection/Result Icon */}
        {isRevealed && ResultIcon ? (
          <ResultIcon
            size={20}
            color={isCorrect ? colors.success : colors.error}
            strokeWidth={2.5}
          />
        ) : (
          <SelectIcon
            size={20}
            color={isSelected ? colors.primary : colors.textMuted}
            strokeWidth={1.5}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ===========================================
// Text Input Answer
// ===========================================

interface TextInputAnswerProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isRevealed?: boolean;
  isCorrect?: boolean | null;
  disabled?: boolean;
  multiline?: boolean;
}

export const TextInputAnswer: React.FC<TextInputAnswerProps> = ({
  value,
  onChangeText,
  placeholder = 'Type your answer...',
  isRevealed = false,
  isCorrect,
  disabled = false,
  multiline = false,
}) => {
  const { colors } = useTheme();

  const getBorderColor = () => {
    if (isRevealed) {
      if (isCorrect === true) return colors.success;
      if (isCorrect === false) return colors.error;
    }
    return value ? colors.primary : colors.border;
  };

  return (
    <View style={styles.textInputContainer}>
      <TextInput
        style={[
          styles.textInput,
          {
            borderColor: getBorderColor(),
            backgroundColor: colors.card,
            color: colors.text,
          },
          multiline && styles.textInputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={!disabled}
        multiline={multiline}
        accessibilityLabel="Answer input"
        accessibilityHint="Type your answer here"
      />
      {isRevealed && (
        <View style={styles.textInputIcon}>
          {isCorrect === true ? (
            <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
          ) : isCorrect === false ? (
            <XCircle size={20} color={colors.error} strokeWidth={2} />
          ) : null}
        </View>
      )}
    </View>
  );
};

// ===========================================
// Answer Feedback
// ===========================================

interface AnswerFeedbackProps {
  isCorrect: boolean;
  feedback: string;
  correctAnswer?: string;
  pointsEarned?: number;
  visible?: boolean;
}

export const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  isCorrect,
  feedback,
  correctAnswer,
  pointsEarned = 0,
  visible = true,
}) => {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.feedbackContainer,
        {
          backgroundColor: isCorrect
            ? withAlpha(colors.success, 0.15)
            : withAlpha(colors.error, 0.15),
          borderColor: isCorrect ? colors.success : colors.error,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.feedbackHeader}>
        {isCorrect ? (
          <CheckCircle2 size={24} color={colors.success} strokeWidth={2} />
        ) : (
          <XCircle size={24} color={colors.error} strokeWidth={2} />
        )}
        <Text
          style={[
            styles.feedbackTitle,
            { color: isCorrect ? colors.success : colors.error },
          ]}
        >
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </Text>
        {isCorrect && pointsEarned > 0 && (
          <View style={[styles.pointsBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.pointsBadgeText}>+{pointsEarned}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.feedbackText, { color: colors.text }]}>
        {feedback}
      </Text>
      {!isCorrect && correctAnswer && (
        <Text style={[styles.correctAnswerText, { color: colors.textMuted }]}>
          Correct answer: {correctAnswer}
        </Text>
      )}
    </Animated.View>
  );
};

// ===========================================
// Session Summary Card
// ===========================================

interface SessionSummaryCardProps {
  score: number;
  streak: number;
  accuracy: number;
  previousPoints: number;
  totalPoints: number;
  onEndSession: () => void;
  onRedeemCash: () => void;
  onRedeemAirtime: () => void;
  canRedeem: boolean;
  minRedeemPoints?: number;
}

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  score,
  streak,
  accuracy,
  previousPoints,
  totalPoints,
  onEndSession,
  onRedeemCash,
  onRedeemAirtime,
  canRedeem,
  minRedeemPoints = 50,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statItem, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <Star size={24} color={colors.primary} fill={colors.primary} strokeWidth={0} />
          <Text style={[styles.statValue, { color: colors.text }]}>{score}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Score</Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
          <Flame size={24} color={colors.warning} fill={colors.warning} strokeWidth={0} />
          <Text style={[styles.statValue, { color: colors.text }]}>{streak} 🔥</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
        </View>

        <View style={[styles.statItem, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
          <CheckCircle2 size={24} color={colors.success} strokeWidth={2} />
          <Text style={[styles.statValue, { color: colors.text }]}>{accuracy}%</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
        </View>
      </View>

      {/* Points Summary */}
      <View style={[styles.pointsSummary, { backgroundColor: colors.background }]}>
        <View style={styles.pointsRow}>
          <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>
            Previous Points:
          </Text>
          <Text style={[styles.pointsValue, { color: colors.text }]}>
            {previousPoints}
          </Text>
        </View>
        <View style={styles.pointsRow}>
          <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>
            Session Points:
          </Text>
          <Text style={[styles.pointsValue, { color: colors.primary }]}>
            +{score}
          </Text>
        </View>
        <View style={[styles.pointsDivider, { backgroundColor: colors.border }]} />
        <View style={styles.pointsRow}>
          <Text style={[styles.pointsTotalLabel, { color: colors.text }]}>
            Total Points:
          </Text>
          <Text style={[styles.pointsTotalValue, { color: colors.primary }]}>
            {totalPoints}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.border }]}
          onPress={onEndSession}
        >
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            End Session
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: canRedeem ? colors.success : colors.border,
              opacity: canRedeem ? 1 : 0.5,
            },
          ]}
          onPress={onRedeemCash}
          disabled={!canRedeem}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: canRedeem ? colors.background : colors.textMuted },
            ]}
          >
            Get Cash
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: canRedeem ? colors.primary : colors.border,
              opacity: canRedeem ? 1 : 0.5,
            },
          ]}
          onPress={onRedeemAirtime}
          disabled={!canRedeem}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: canRedeem ? colors.background : colors.textMuted },
            ]}
          >
            Get Airtime
          </Text>
        </TouchableOpacity>
      </View>

      {!canRedeem && (
        <Text style={[styles.minPointsNote, { color: colors.textMuted }]}>
          Minimum {minRedeemPoints} points required to redeem rewards
        </Text>
      )}
    </View>
  );
};

// ===========================================
// Styles
// ===========================================

const styles = StyleSheet.create({
  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 40,
    textAlign: 'right',
  },

  // Timer
  timerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerTextContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Score Badge
  scoreBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  scoreBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  streakBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Option Button
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.base,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  optionKey: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeyText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.base,
  },

  // Text Input
  textInputContainer: {
    position: 'relative',
  },
  textInput: {
    borderWidth: BORDER_WIDTH.base,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 48,
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textInputIcon: {
    position: 'absolute',
    right: SPACING.md,
    top: '50%',
    marginTop: -10,
  },

  // Feedback
  feedbackContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    marginTop: SPACING.md,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  feedbackTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
  },
  feedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  correctAnswerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  pointsBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pointsBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFFFFF',
  },

  // Summary Card
  summaryCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  pointsSummary: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  pointsValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  pointsDivider: {
    height: 1,
    marginVertical: SPACING.xs,
  },
  pointsTotalLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  pointsTotalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  minPointsNote: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
});

export default {
  QuizProgressBar,
  CircularTimer,
  ScoreBadge,
  OptionButton,
  TextInputAnswer,
  AnswerFeedback,
  SessionSummaryCard,
};
