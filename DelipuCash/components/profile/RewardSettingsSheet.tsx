/**
 * RewardSettingsSheet — Admin bottom sheet for configuring reward rates
 *
 * Allows admin/moderator users to update:
 * - Points awarded per completed survey
 * - Points-to-cash conversion rate (UGX per N points)
 * - Minimum withdrawal threshold (points)
 *
 * Design: Follows the RedemptionModal bottom-sheet pattern with BlurView
 * backdrop, SlideInDown animation, and WCAG 2.2 AA accessibility.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AccessibilityInfo,
  Pressable,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
  interpolateColor,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  X,
  Settings2,
  AlertCircle,
  Coins,
  ArrowRightLeft,
  Wallet,
  Sparkles,
  Users,
  Gift,
} from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';

import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  useRewardConfig,
  useUpdateRewardConfig,
} from '@/services/configHooks';

// ============================================================================
// TYPES
// ============================================================================

type RewardTab = 'points' | 'rewards';

export interface RewardSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RewardSettingsSheet({ visible, onClose }: RewardSettingsSheetProps) {
  const { colors, isDark } = useTheme();
  const { data: config, isLoading } = useRewardConfig();
  const updateConfig = useUpdateRewardConfig();

  // Local form state
  const [pointsPerSurvey, setPointsPerSurvey] = useState('');
  const [cashNumerator, setCashNumerator] = useState('');
  const [cashDenominator, setCashDenominator] = useState('');
  const [minWithdrawal, setMinWithdrawal] = useState('');
  const [defaultRegularReward, setDefaultRegularReward] = useState('');
  const [defaultInstantReward, setDefaultInstantReward] = useState('');
  const [referralBonus, setReferralBonus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RewardTab>('points');

  // Sync form from server config when sheet opens
  useEffect(() => {
    if (visible && config) {
      setPointsPerSurvey(String(config.surveyCompletionPoints));
      setCashNumerator(String(config.pointsToCashNumerator));
      setCashDenominator(String(config.pointsToCashDenominator));
      setMinWithdrawal(String(config.minWithdrawalPoints));
      setDefaultRegularReward(String(config.defaultRegularRewardAmount));
      setDefaultInstantReward(String(config.defaultInstantRewardAmount));
      setReferralBonus(String(config.referralBonusPoints));
      setError(null);
    }
  }, [visible, config]);

  // Live preview of the rate
  const previewText = useMemo(() => {
    const num = Number(cashNumerator);
    const den = Number(cashDenominator);
    if (!den || den <= 0 || !num || num <= 0) return null;
    const perPoint = num / den;
    return `${den} points = ${num.toLocaleString()} UGX (${perPoint.toLocaleString()} UGX/point)`;
  }, [cashNumerator, cashDenominator]);

  // Reward default previews
  const regularRewardPreview = useMemo(() => {
    const ugx = Number(defaultRegularReward);
    const den = Number(cashDenominator);
    const num = Number(cashNumerator);
    if (!ugx || ugx <= 0 || !den || !num) return null;
    const pts = Math.ceil((ugx * den) / num);
    return `${ugx.toLocaleString()} UGX = ${pts} points per regular question`;
  }, [defaultRegularReward, cashNumerator, cashDenominator]);

  const instantRewardPreview = useMemo(() => {
    const ugx = Number(defaultInstantReward);
    const den = Number(cashDenominator);
    const num = Number(cashNumerator);
    if (!ugx || ugx <= 0 || !den || !num) return null;
    const pts = Math.ceil((ugx * den) / num);
    return `${ugx.toLocaleString()} UGX = ${pts} points per instant question`;
  }, [defaultInstantReward, cashNumerator, cashDenominator]);

  // Referral bonus preview
  const referralBonusPreview = useMemo(() => {
    const pts = Number(referralBonus);
    const num = Number(cashNumerator);
    const den = Number(cashDenominator);
    if (!pts || pts <= 0 || !num || !den || den <= 0) return null;
    const ugx = Math.floor((pts * num) / den);
    return `${pts} points = ${ugx.toLocaleString()} UGX per referral (each party)`;
  }, [referralBonus, cashNumerator, cashDenominator]);

  // Withdrawal preview
  const withdrawalPreview = useMemo(() => {
    const min = Number(minWithdrawal);
    const num = Number(cashNumerator);
    const den = Number(cashDenominator);
    if (!min || min <= 0 || !num || !den || den <= 0) return null;
    const ugx = Math.floor((min * num) / den);
    return `${min} points = ${ugx.toLocaleString()} UGX minimum`;
  }, [minWithdrawal, cashNumerator, cashDenominator]);

  const handleTabChange = useCallback((tab: RewardTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  const validate = useCallback((): boolean => {
    const pps = Number(pointsPerSurvey);
    const cn = Number(cashNumerator);
    const cd = Number(cashDenominator);
    const mw = Number(minWithdrawal);
    const drr = Number(defaultRegularReward);
    const dir = Number(defaultInstantReward);
    const rb = Number(referralBonus);

    // Points & Rates tab validations
    if (!Number.isInteger(pps) || pps < 1) {
      setActiveTab('points');
      setError('Points per survey must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(cn) || cn < 1) {
      setActiveTab('points');
      setError('Cash amount (UGX) must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(cd) || cd < 1) {
      setActiveTab('points');
      setError('Points count must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(mw) || mw < 1) {
      setActiveTab('points');
      setError('Minimum withdrawal must be a positive whole number.');
      return false;
    }

    // Rewards & Referrals tab validations
    if (!Number.isInteger(drr) || drr < 1 || drr > 1000000) {
      setActiveTab('rewards');
      setError('Default regular reward must be between 1 and 1,000,000 UGX.');
      return false;
    }
    if (!Number.isInteger(dir) || dir < 1 || dir > 1000000) {
      setActiveTab('rewards');
      setError('Default instant reward must be between 1 and 1,000,000 UGX.');
      return false;
    }
    if (!Number.isInteger(rb) || rb < 1 || rb > 10000) {
      setActiveTab('rewards');
      setError('Referral bonus must be between 1 and 10,000 points.');
      return false;
    }
    setError(null);
    return true;
  }, [pointsPerSurvey, cashNumerator, cashDenominator, minWithdrawal, defaultRegularReward, defaultInstantReward, referralBonus]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateConfig.mutateAsync({
        surveyCompletionPoints: Number(pointsPerSurvey),
        pointsToCashNumerator: Number(cashNumerator),
        pointsToCashDenominator: Number(cashDenominator),
        minWithdrawalPoints: Number(minWithdrawal),
        defaultRegularRewardAmount: Number(defaultRegularReward),
        defaultInstantRewardAmount: Number(defaultInstantReward),
        referralBonusPoints: Number(referralBonus),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Reward settings saved successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [validate, pointsPerSurvey, cashNumerator, cashDenominator, minWithdrawal, defaultRegularReward, defaultInstantReward, referralBonus, updateConfig, onClose]);

  const handleClose = useCallback(() => {
    if (!updateConfig.isPending) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  }, [updateConfig.isPending, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={isDark ? 40 : 25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          </Pressable>
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { backgroundColor: colors.card }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: withAlpha(colors.border, 0.3) }]}>
            <View style={[styles.iconBg, { backgroundColor: withAlpha('#FF9800', 0.12) }]}>
              <Settings2 size={22} color="#FF9800" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>Reward Settings</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Configure points, reward defaults and rates
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: withAlpha(colors.text, 0.08) }]}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              hitSlop={8}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabSwitcherContainer}>
            <RewardTabSwitcher
              activeTab={activeTab}
              onTabChange={handleTabChange}
              colors={colors}
              isDark={isDark}
            />
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'points' ? (
              <>
                {/* Points per survey */}
                <SettingField
                  icon={<Coins size={18} color={colors.primary} />}
                  label="Points per completed survey"
                  hint="How many points a user earns for each survey"
                  value={pointsPerSurvey}
                  onChangeText={setPointsPerSurvey}
                  colors={colors}
                />

                {/* Conversion rate */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldHeader}>
                    <ArrowRightLeft size={18} color={colors.primary} />
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                      Cash conversion rate
                    </Text>
                  </View>
                  <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                    How much UGX users get per N points
                  </Text>
                  <View style={styles.rateRow}>
                    <View style={styles.rateInput}>
                      <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>UGX</Text>
                      <TextInput
                        style={[styles.input, {
                          color: colors.text,
                          backgroundColor: withAlpha(colors.text, 0.04),
                          borderColor: withAlpha(colors.border, 0.3),
                        }]}
                        value={cashNumerator}
                        onChangeText={setCashNumerator}
                        keyboardType="number-pad"
                        accessibilityLabel="UGX amount"
                        accessibilityHint="Cash amount users receive"
                      />
                    </View>
                    <Text style={[styles.rateSeparator, { color: colors.textMuted }]}>per</Text>
                    <View style={styles.rateInput}>
                      <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Points</Text>
                      <TextInput
                        style={[styles.input, {
                          color: colors.text,
                          backgroundColor: withAlpha(colors.text, 0.04),
                          borderColor: withAlpha(colors.border, 0.3),
                        }]}
                        value={cashDenominator}
                        onChangeText={setCashDenominator}
                        keyboardType="number-pad"
                        accessibilityLabel="Points count"
                        accessibilityHint="Number of points for the cash amount"
                      />
                    </View>
                  </View>
                  {previewText && (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <Text style={[styles.previewText, { color: colors.success }]}>
                        {previewText}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Minimum withdrawal */}
                <SettingField
                  icon={<Wallet size={18} color={colors.primary} />}
                  label="Minimum withdrawal (points)"
                  hint="Users must reach this many points before withdrawing"
                  value={minWithdrawal}
                  onChangeText={setMinWithdrawal}
                  colors={colors}
                />

                {withdrawalPreview && (
                  <View style={[styles.previewCard, { backgroundColor: withAlpha(colors.primary, 0.06) }]}>
                    <Text style={[styles.previewCardText, { color: colors.primary }]}>
                      {withdrawalPreview}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Default regular reward */}
                <SettingField
                  icon={<Coins size={18} color="#4CAF50" />}
                  label="Default regular reward (UGX)"
                  hint="Auto-filled when creating regular reward questions"
                  value={defaultRegularReward}
                  onChangeText={setDefaultRegularReward}
                  colors={colors}
                />
                {regularRewardPreview && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: -SPACING.sm }}>
                    <Text style={[styles.previewText, { color: colors.success }]}>
                      {regularRewardPreview}
                    </Text>
                  </Animated.View>
                )}

                {/* Default instant reward */}
                <SettingField
                  icon={<Sparkles size={18} color="#FF9800" />}
                  label="Default instant reward (UGX)"
                  hint="Auto-filled when creating instant reward questions"
                  value={defaultInstantReward}
                  onChangeText={setDefaultInstantReward}
                  colors={colors}
                />
                {instantRewardPreview && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: -SPACING.sm }}>
                    <Text style={[styles.previewText, { color: colors.success }]}>
                      {instantRewardPreview}
                    </Text>
                  </Animated.View>
                )}

                {/* Referral bonus */}
                <SettingField
                  icon={<Users size={18} color="#9C27B0" />}
                  label="Referral bonus (points)"
                  hint="Points awarded to both referrer and new user on signup"
                  value={referralBonus}
                  onChangeText={setReferralBonus}
                  colors={colors}
                />
                {referralBonusPreview && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: -SPACING.sm }}>
                    <Text style={[styles.previewText, { color: colors.success }]}>
                      {referralBonusPreview}
                    </Text>
                  </Animated.View>
                )}
              </>
            )}

            {/* Error */}
            {error && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.errorBanner, { backgroundColor: withAlpha(colors.error, 0.08) }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <AlertCircle size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </Animated.View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: withAlpha(colors.border, 0.3) }]}>
            <PrimaryButton
              title={updateConfig.isPending ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              disabled={updateConfig.isPending || isLoading}
              loading={updateConfig.isPending}
              style={styles.saveButton}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// REWARD TAB SWITCHER SUB-COMPONENT
// ============================================================================

const TAB_SPRING_CONFIG = { damping: 20, stiffness: 300 };
const MIN_TOUCH_TARGET = 48;

interface RewardTabSwitcherProps {
  activeTab: RewardTab;
  onTabChange: (tab: RewardTab) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const RewardTabSwitcher = React.memo<RewardTabSwitcherProps>(({
  activeTab,
  onTabChange,
  colors,
  isDark,
}) => {
  const reduceMotion = useReducedMotion();
  const indicatorPos = useSharedValue(activeTab === 'rewards' ? 1 : 0);

  useEffect(() => {
    const target = activeTab === 'rewards' ? 1 : 0;
    indicatorPos.value = reduceMotion
      ? target
      : withSpring(target, TAB_SPRING_CONFIG);
  }, [activeTab, indicatorPos, reduceMotion]);

  const handleTabPress = useCallback((tab: RewardTab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(
      tab === 'points' ? 'Showing points and rates settings' : 'Showing rewards and referrals settings'
    );
    onTabChange(tab);
  }, [activeTab, onTabChange]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorPos.value * 50}%` as any,
  }));

  const pointsTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indicatorPos.value,
      [0, 1],
      [isDark ? '#FFFFFF' : '#000000', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)']
    ),
  }));

  const rewardsTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indicatorPos.value,
      [0, 1],
      [isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', isDark ? '#FFFFFF' : '#000000']
    ),
  }));

  const containerBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const pillBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)';

  return (
    <View
      role="tablist"
      accessibilityLabel="Reward settings category tabs"
      style={[tabStyles.container, { backgroundColor: containerBg, borderColor: withAlpha(colors.border, 0.3) }]}
    >
      <Animated.View style={[tabStyles.indicator, { backgroundColor: pillBg }, indicatorStyle]} />

      <Pressable
        style={tabStyles.tab}
        onPress={() => handleTabPress('points')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'points' }}
        accessibilityLabel="Points and Rates"
        accessibilityHint="Show points and conversion rate settings"
      >
        <Coins
          size={16}
          color={activeTab === 'points' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[tabStyles.tabText, pointsTextStyle]}>
          Points & Rates
        </Animated.Text>
      </Pressable>

      <Pressable
        style={tabStyles.tab}
        onPress={() => handleTabPress('rewards')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'rewards' }}
        accessibilityLabel="Rewards and Referrals"
        accessibilityHint="Show reward defaults and referral bonus settings"
      >
        <Gift
          size={16}
          color={activeTab === 'rewards' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[tabStyles.tabText, rewardsTextStyle]}>
          Rewards & Referrals
        </Animated.Text>
      </Pressable>
    </View>
  );
});

RewardTabSwitcher.displayName = 'RewardTabSwitcher';

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    borderRadius: RADIUS.lg - 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    minHeight: MIN_TOUCH_TARGET,
    zIndex: 1,
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// ============================================================================
// SETTING FIELD SUB-COMPONENT
// ============================================================================

interface SettingFieldProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  onChangeText: (text: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function SettingField({ icon, label, hint, value, onChangeText, colors }: SettingFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldHeader}>
        {icon}
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{hint}</Text>
      <TextInput
        style={[styles.input, {
          color: colors.text,
          backgroundColor: withAlpha(colors.text, 0.04),
          borderColor: withAlpha(colors.border, 0.3),
        }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderBottomWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSwitcherContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.base,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  fieldHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.sm + 18, // align with label text
  },
  input: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm + 2,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  rateInput: {
    flex: 1,
    gap: SPACING.xxs,
  },
  rateLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rateSeparator: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingBottom: SPACING.sm + 4,
  },
  previewText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },
  previewCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    alignItems: 'center',
  },
  previewCardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: BORDER_WIDTH.thin,
  },
  saveButton: {
    width: '100%',
  },
});
