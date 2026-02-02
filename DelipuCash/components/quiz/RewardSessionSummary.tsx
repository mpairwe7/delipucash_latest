/**
 * Reward Session Summary Component
 * 
 * Displays a comprehensive summary after completing instant reward questions.
 * Features:
 * - Session statistics (correct/incorrect, accuracy, total earned)
 * - Animated entry for engagement
 * - Redemption options (Cash/Airtime)
 * - Industry-standard design patterns
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Star,
  Zap,
  Gift,
  ChevronRight,
  Banknote,
  Smartphone,
  TrendingUp,
  Target,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import { formatCurrency } from '@/services';
import { PrimaryButton } from '@/components/PrimaryButton';
import { REWARD_CONSTANTS } from '@/store/InstantRewardStore';
import { triggerHaptic } from '@/utils/quiz-utils';

// ===========================================
// Types
// ===========================================

export interface RewardSessionSummaryProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Total number of questions in session */
  totalQuestions: number;
  /** Number of correct answers */
  correctAnswers: number;
  /** Number of incorrect answers */
  incorrectAnswers: number;
  /** Total amount earned in session (UGX) */
  totalEarned: number;
  /** Session-specific earnings breakdown (UGX) */
  sessionEarnings: number;
  /** Total wallet balance (UGX) */
  totalBalance: number;
  /** Whether user can redeem rewards */
  canRedeemRewards: boolean;
  /** Callback when user wants to redeem cash */
  onRedeemCash?: () => void;
  /** Callback when user wants to redeem airtime */
  onRedeemAirtime?: () => void;
  /** Callback when user wants to continue answering */
  onContinue?: () => void;
  /** Callback when user wants to close */
  onClose?: () => void;
}

// ===========================================
// Sub-Components
// ===========================================

interface StatItemProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, color }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.statItem, { backgroundColor: colors.card }]}>
      <View style={[styles.statIcon, { backgroundColor: withAlpha(color || colors.primary, 0.12) }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
};

// ===========================================
// Main Component
// ===========================================

export const RewardSessionSummary: React.FC<RewardSessionSummaryProps> = ({
  visible,
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  totalEarned,
  sessionEarnings,
  totalBalance,
  canRedeemRewards,
  onRedeemCash,
  onRedeemAirtime,
  onContinue,
  onClose,
}) => {
  const { colors } = useTheme();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Calculate accuracy
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  
  useEffect(() => {
    if (visible) {
      // Trigger success haptic on mount
      triggerHaptic('success');
      
      // Animate entry
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animation values when hidden
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      slideAnim.setValue(30);
    }
  }, [visible, fadeAnim, scaleAnim, slideAnim]);
  
  const getPerformanceMessage = () => {
    if (accuracy >= 80) return { message: "Outstanding! 🌟", color: colors.success };
    if (accuracy >= 60) return { message: "Great job! 👏", color: colors.primary };
    if (accuracy >= 40) return { message: "Good effort! 💪", color: colors.warning };
    return { message: "Keep practicing! 📚", color: colors.info };
  };
  
  const performance = getPerformanceMessage();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
          ],
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Trophy Section */}
        <LinearGradient
          colors={[withAlpha(colors.warning, 0.2), withAlpha(colors.primary, 0.1)]}
          style={[styles.trophySection, { borderColor: colors.border }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.trophyCircle, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
            <Trophy size={56} color={colors.warning} strokeWidth={1.5} />
          </View>
          <Text style={[styles.congratsText, { color: colors.text }]}>
            Session Complete!
          </Text>
          <Text style={[styles.performanceText, { color: performance.color }]}>
            {performance.message}
          </Text>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatItem
            icon={<CheckCircle2 size={ICON_SIZE.md} color={colors.success} strokeWidth={1.5} />}
            value={correctAnswers}
            label="Correct"
            color={colors.success}
          />
          <StatItem
            icon={<XCircle size={ICON_SIZE.md} color={colors.error} strokeWidth={1.5} />}
            value={incorrectAnswers}
            label="Incorrect"
            color={colors.error}
          />
          <StatItem
            icon={<Target size={ICON_SIZE.md} color={colors.info} strokeWidth={1.5} />}
            value={`${accuracy}%`}
            label="Accuracy"
            color={colors.info}
          />
          <StatItem
            icon={<Star size={ICON_SIZE.md} color={colors.warning} strokeWidth={1.5} />}
            value={formatCurrency(totalEarned)}
            label="Earned"
            color={colors.warning}
          />
        </View>

        {/* Earnings Summary Card */}
        <View style={[styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.earningsHeader}>
            <Zap size={ICON_SIZE.md} color={colors.primary} strokeWidth={1.5} />
            <Text style={[styles.earningsTitle, { color: colors.text }]}>
              Earnings Summary
            </Text>
          </View>
          
          <View style={styles.earningsRows}>
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                Questions Answered
              </Text>
              <Text style={[styles.earningsValue, { color: colors.text }]}>
                {correctAnswers + incorrectAnswers} / {totalQuestions}
              </Text>
            </View>
            
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsLabel, { color: colors.textMuted }]}>
                Session Earnings
              </Text>
              <Text style={[styles.earningsValue, { color: colors.success }]}>
                +{formatCurrency(sessionEarnings)}
              </Text>
            </View>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <View style={styles.earningsRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>
                Total Available
              </Text>
              <View style={styles.totalValueContainer}>
                <Text style={[styles.totalValue, { color: colors.primary }]}>
                  {formatCurrency(totalBalance)}
                </Text>
                <Text style={[styles.pointsEquivalent, { color: colors.textMuted }]}>
                  ≈ {Math.floor(totalBalance / REWARD_CONSTANTS.POINTS_TO_UGX_RATE)} pts
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Redemption Options */}
        {canRedeemRewards && (
          <View style={[styles.redemptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.redemptionHeader}>
              <Gift size={ICON_SIZE.md} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.redemptionTitle, { color: colors.text }]}>
                Redeem Your Rewards
              </Text>
            </View>
            
            <Text style={[styles.redemptionSubtitle, { color: colors.textMuted }]}>
              Convert your earnings to cash or airtime
            </Text>
            
            <View style={styles.redemptionOptions}>
              <TouchableOpacity
                style={[styles.redemptionOption, { backgroundColor: withAlpha(colors.success, 0.1), borderColor: colors.success }]}
                onPress={() => {
                  triggerHaptic('selection');
                  onRedeemCash?.();
                }}
                activeOpacity={0.7}
              >
                <Banknote size={ICON_SIZE.lg} color={colors.success} strokeWidth={1.5} />
                <Text style={[styles.redemptionOptionLabel, { color: colors.success }]}>
                  Cash
                </Text>
                <ChevronRight size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.redemptionOption, { backgroundColor: withAlpha(colors.info, 0.1), borderColor: colors.info }]}
                onPress={() => {
                  triggerHaptic('selection');
                  onRedeemAirtime?.();
                }}
                activeOpacity={0.7}
              >
                <Smartphone size={ICON_SIZE.lg} color={colors.info} strokeWidth={1.5} />
                <Text style={[styles.redemptionOptionLabel, { color: colors.info }]}>
                  Airtime
                </Text>
                <ChevronRight size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Not enough points message */}
        {!canRedeemRewards && (
          <View style={[styles.notEnoughCard, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: colors.warning }]}>
            <TrendingUp size={ICON_SIZE.md} color={colors.warning} strokeWidth={1.5} />
            <View style={styles.notEnoughContent}>
              <Text style={[styles.notEnoughTitle, { color: colors.warning }]}>
                Keep Earning!
              </Text>
              <Text style={[styles.notEnoughText, { color: colors.textMuted }]}>
                You need at least {formatCurrency(REWARD_CONSTANTS.MIN_REDEMPTION_POINTS * REWARD_CONSTANTS.POINTS_TO_UGX_RATE)} to redeem rewards.
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <PrimaryButton
            title="Continue Answering"
            onPress={onContinue}
            variant="primary"
          />
          
          <PrimaryButton
            title="Close"
            onPress={onClose}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
};

// ===========================================
// Styles
// ===========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  trophySection: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  trophyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  congratsText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  performanceText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  earningsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  earningsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  earningsRows: {
    gap: SPACING.sm,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  earningsValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.xs,
  },
  totalLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  totalValueContainer: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  pointsEquivalent: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  redemptionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  redemptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  redemptionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  redemptionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  redemptionOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  redemptionOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  redemptionOptionLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginLeft: SPACING.sm,
  },
  notEnoughCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  notEnoughContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  notEnoughTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  notEnoughText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  actions: {
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
});

export default RewardSessionSummary;
