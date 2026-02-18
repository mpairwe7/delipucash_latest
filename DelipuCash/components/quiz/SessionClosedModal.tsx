/**
 * Session Closed Modal - Enhanced UX for when rewards are no longer available
 * 
 * Features:
 * - Shows when question expires or all winner spots are filled
 * - Displays session summary with earnings
 * - Redemption options visible
 * - Option to continue to more questions or exit
 * - Animated entrance with celebration confetti
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  Zap,
  Trophy,
  AlertCircle,
  Clock,
  Users,
} from 'lucide-react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  withAlpha,
  BORDER_WIDTH,
} from '@/utils/theme';
import { formatCurrency } from '@/services';
import { triggerHaptic } from '@/utils/quiz-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionClosedModalProps {
  visible: boolean;
  reason: 'EXPIRED' | 'SLOTS_FULL' | 'COMPLETED';
  questionsAnswered: number;
  correctAnswers: number;
  totalEarned: number;
  totalBalance: number;
  canRedeem: boolean;
  onContinue?: () => void;
  onExit?: () => void;
  onRedeem?: () => void;
  lastQuestionReward?: number;
  remainingQuestions?: number;
}

// ─── Session Closed Modal Component ──────────────────────────────────────────

export const SessionClosedModal: React.FC<SessionClosedModalProps> = ({
  visible,
  reason,
  questionsAnswered,
  correctAnswers,
  totalEarned,
  totalBalance,
  canRedeem,
  onContinue,
  onExit,
  onRedeem,
  lastQuestionReward = 0,
  remainingQuestions = 0,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Haptic feedback on open
  React.useEffect(() => {
    if (visible) {
      triggerHaptic('success');
    }
  }, [visible]);

  // Get header info based on reason
  const headerInfo = useMemo(() => {
    switch (reason) {
      case 'EXPIRED':
        return {
          icon: Clock,
          title: 'Time\'s Up!',
          subtitle: 'This question has expired.',
          color: colors.warning,
          bgColor: withAlpha(colors.warning, 0.12),
        };
      case 'SLOTS_FULL':
        return {
          icon: Users,
          title: 'All Spots Filled',
          subtitle: 'No more winner slots available.',
          color: colors.error,
          bgColor: withAlpha(colors.error, 0.12),
        };
      case 'COMPLETED':
        return {
          icon: Trophy,
          title: 'Great Job!',
          subtitle: 'Session ended.',
          color: colors.success,
          bgColor: withAlpha(colors.success, 0.12),
        };
    }
  }, [reason, colors]);

  const Icon = headerInfo.icon;

  const accuracy = useMemo(() => {
    if (questionsAnswered === 0) return 0;
    return Math.round((correctAnswers / questionsAnswered) * 100);
  }, [correctAnswers, questionsAnswered]);

  const handleContinue = useCallback(() => {
    triggerHaptic('light');
    onContinue?.();
  }, [onContinue]);

  const handleExit = useCallback(() => {
    triggerHaptic('light');
    onExit?.();
  }, [onExit]);

  const handleRedeem = useCallback(() => {
    triggerHaptic('medium');
    onRedeem?.();
  }, [onRedeem]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={70} style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.backdrop,
            {
              backgroundColor: withAlpha(colors.background, 0.4),
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <Animated.View
            entering={SlideInDown.duration(400)}
            style={StyleSheet.absoluteFill}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end',
              }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                entering={FadeInDown.duration(500).delay(100)}
                style={[
                  styles.modal,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    maxHeight: height * 0.85,
                  },
                ]}
              >
                {/* Draggable handle */}
                <View style={styles.handle}>
                  <View
                    style={[
                      styles.handleBar,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>

                {/* Header with Icon */}
                <Animated.View
                  entering={FadeIn.duration(400).delay(200)}
                  style={[
                    styles.header,
                    { backgroundColor: headerInfo.bgColor },
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: withAlpha(headerInfo.color, 0.15) },
                    ]}
                  >
                    <Icon
                      size={ICON_SIZE.lg}
                      color={headerInfo.color}
                      strokeWidth={1.5}
                    />
                  </View>

                  <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {headerInfo.title}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                    {headerInfo.subtitle}
                  </Text>
                </Animated.View>

                {/* Session Stats */}
                <Animated.View
                  entering={FadeIn.duration(400).delay(300)}
                  style={styles.statsContainer}
                >
                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: withAlpha(colors.primary, 0.08),
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                        Questions Answered
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {questionsAnswered}
                      </Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                        Correct Answers
                      </Text>
                      <View style={styles.accuracyBadge}>
                        <Text style={[styles.statValue, { color: colors.success }]}>
                          {correctAnswers}
                        </Text>
                        <Text style={[styles.accuracyPercent, { color: colors.success }]}>
                          {accuracy}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Earnings Card */}
                  <View
                    style={[
                      styles.earningsCard,
                      {
                        backgroundColor: withAlpha(colors.primary, 0.08),
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <View style={styles.earningsHeader}>
                      <View
                        style={[
                          styles.earnIcon,
                          { backgroundColor: withAlpha(colors.primary, 0.15) },
                        ]}
                      >
                        <Zap
                          size={ICON_SIZE.md}
                          color={colors.primary}
                          strokeWidth={1.5}
                        />
                      </View>
                      <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                        Session Earnings
                      </Text>
                    </View>

                    <Text
                      style={[styles.earningsAmount, { color: colors.primary }]}
                      accessibilityRole="header"
                      accessibilityLabel={`Earned ${formatCurrency(totalEarned)}`}
                    >
                      {formatCurrency(totalEarned)}
                    </Text>

                    <View
                      style={[
                        styles.balancePill,
                        { backgroundColor: withAlpha(colors.primary, 0.08) },
                      ]}
                    >
                      <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                        Wallet Balance
                      </Text>
                      <Text style={[styles.balanceAmount, { color: colors.primary }]}>
                        {formatCurrency(totalBalance)}
                      </Text>
                    </View>
                  </View>

                  {/* Remaining Questions Info */}
                  {remainingQuestions > 0 && (
                    <View
                      style={[
                        styles.infoCard,
                        {
                          backgroundColor: withAlpha(colors.info, 0.08),
                          borderColor: colors.info,
                        },
                      ]}
                    >
                      <AlertCircle
                        size={ICON_SIZE.sm}
                        color={colors.info}
                        strokeWidth={1.5}
                      />
                      <Text style={[styles.infoText, { color: colors.info }]}>
                        {remainingQuestions} more question{remainingQuestions > 1 ? 's' : ''} available
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Actions */}
                <Animated.View
                  entering={FadeIn.duration(400).delay(400)}
                  style={[
                    styles.actions,
                    {
                      paddingBottom: insets.bottom + SPACING.lg,
                    },
                  ]}
                >
                  {canRedeem && totalBalance > 0 && (
                    <PrimaryButton
                      title={`Redeem ${formatCurrency(totalBalance)}`}
                      onPress={handleRedeem}
                    />
                  )}

                  {remainingQuestions > 0 && (
                    <PrimaryButton
                      title={`Continue (${remainingQuestions} more)`}
                      onPress={handleContinue}
                      variant="secondary"
                    />
                  )}

                  <PrimaryButton
                    title="Exit"
                    onPress={handleExit}
                    variant="ghost"
                  />
                </Animated.View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modal: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    overflow: 'hidden',
  },

  handle: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },

  handleBar: {
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
  },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  iconCircle: {
    width: ICON_SIZE['2xl'] + SPACING.md,
    height: ICON_SIZE['2xl'] + SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },

  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },

  statsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },

  statCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  statValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },

  statDivider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },

  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  accuracyPercent: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: '600',
  },

  earningsCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  earnIcon: {
    width: ICON_SIZE.lg,
    height: ICON_SIZE.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  earningsLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },

  earningsAmount: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },

  balancePill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },

  balanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },

  balanceAmount: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '600',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },

  actions: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
});

export default SessionClosedModal;
