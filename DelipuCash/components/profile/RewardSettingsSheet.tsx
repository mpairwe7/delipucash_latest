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
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  X,
  Settings2,
  Check,
  AlertCircle,
  Coins,
  ArrowRightLeft,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

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
  pointsToUgx,
  type RewardConfig,
} from '@/services/configHooks';

// ============================================================================
// TYPES
// ============================================================================

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
  const [error, setError] = useState<string | null>(null);

  // Sync form from server config when sheet opens
  useEffect(() => {
    if (visible && config) {
      setPointsPerSurvey(String(config.surveyCompletionPoints));
      setCashNumerator(String(config.pointsToCashNumerator));
      setCashDenominator(String(config.pointsToCashDenominator));
      setMinWithdrawal(String(config.minWithdrawalPoints));
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

  // Withdrawal preview
  const withdrawalPreview = useMemo(() => {
    const min = Number(minWithdrawal);
    const num = Number(cashNumerator);
    const den = Number(cashDenominator);
    if (!min || min <= 0 || !num || !den || den <= 0) return null;
    const ugx = Math.floor((min * num) / den);
    return `${min} points = ${ugx.toLocaleString()} UGX minimum`;
  }, [minWithdrawal, cashNumerator, cashDenominator]);

  const validate = useCallback((): boolean => {
    const pps = Number(pointsPerSurvey);
    const cn = Number(cashNumerator);
    const cd = Number(cashDenominator);
    const mw = Number(minWithdrawal);

    if (!Number.isInteger(pps) || pps < 1) {
      setError('Points per survey must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(cn) || cn < 1) {
      setError('Cash amount (UGX) must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(cd) || cd < 1) {
      setError('Points count must be a positive whole number.');
      return false;
    }
    if (!Number.isInteger(mw) || mw < 1) {
      setError('Minimum withdrawal must be a positive whole number.');
      return false;
    }
    setError(null);
    return true;
  }, [pointsPerSurvey, cashNumerator, cashDenominator, minWithdrawal]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateConfig.mutateAsync({
        surveyCompletionPoints: Number(pointsPerSurvey),
        pointsToCashNumerator: Number(cashNumerator),
        pointsToCashDenominator: Number(cashDenominator),
        minWithdrawalPoints: Number(minWithdrawal),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Reward settings saved successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [validate, pointsPerSurvey, cashNumerator, cashDenominator, minWithdrawal, updateConfig, onClose]);

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
                Configure survey points and withdrawal rates
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

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
