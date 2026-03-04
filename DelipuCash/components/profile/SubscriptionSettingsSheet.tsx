/**
 * SubscriptionSettingsSheet — Admin bottom sheet for configuring subscription plan prices
 *
 * Allows admin/moderator users to update UGX prices for all 15 subscription
 * plans (8 survey + 7 video). Follows the RewardSettingsSheet pattern.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  CreditCard,
  AlertCircle,
  ClipboardList,
  Video,
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
  useSubscriptionPriceConfig,
  useUpdateSubscriptionPriceConfig,
  type SubscriptionPriceConfig,
} from '@/services/configHooks';

// ============================================================================
// TYPES
// ============================================================================

type PricingTab = 'survey' | 'video';

export interface SubscriptionSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

interface PriceField {
  key: keyof SubscriptionPriceConfig;
  label: string;
}

const SURVEY_FIELDS: PriceField[] = [
  { key: 'subSurveyOncePrice', label: 'Single Access' },
  { key: 'subSurveyDailyPrice', label: 'Daily' },
  { key: 'subSurveyWeeklyPrice', label: 'Weekly' },
  { key: 'subSurveyMonthlyPrice', label: 'Monthly' },
  { key: 'subSurveyQuarterlyPrice', label: 'Quarterly' },
  { key: 'subSurveyHalfYearlyPrice', label: 'Half Yearly' },
  { key: 'subSurveyYearlyPrice', label: 'Yearly' },
  { key: 'subSurveyLifetimePrice', label: 'Lifetime' },
];

const VIDEO_FIELDS: PriceField[] = [
  { key: 'subVideoDailyPrice', label: 'Daily' },
  { key: 'subVideoWeeklyPrice', label: 'Weekly' },
  { key: 'subVideoMonthlyPrice', label: 'Monthly' },
  { key: 'subVideoQuarterlyPrice', label: 'Quarterly' },
  { key: 'subVideoHalfYearlyPrice', label: 'Half Yearly' },
  { key: 'subVideoYearlyPrice', label: 'Yearly' },
  { key: 'subVideoLifetimePrice', label: 'Lifetime' },
];

const ALL_FIELDS = [...SURVEY_FIELDS, ...VIDEO_FIELDS];

// ============================================================================
// COMPONENT
// ============================================================================

export function SubscriptionSettingsSheet({ visible, onClose }: SubscriptionSettingsSheetProps) {
  const { colors, isDark } = useTheme();
  const { data: config, isLoading } = useSubscriptionPriceConfig();
  const updateConfig = useUpdateSubscriptionPriceConfig();

  // Local form state — keyed by field name
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PricingTab>('survey');

  // Sync form from server config when sheet opens
  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (config) {
      const initial: Record<string, string> = {};
      for (const { key } of ALL_FIELDS) {
        initial[key] = String(config[key]);
      }
      setValues(initial);
    }
  }, [visible, config]);

  const updateField = useCallback((key: string, text: string) => {
    setValues(prev => ({ ...prev, [key]: text }));
  }, []);

  const validate = useCallback((): boolean => {
    // Check survey fields first, then video — auto-switch to the tab with the error
    for (const { key, label } of SURVEY_FIELDS) {
      const v = Number(values[key]);
      if (!Number.isInteger(v) || v < 100 || v > 10_000_000) {
        setActiveTab('survey');
        setError(`${label} must be an integer between 100 and 10,000,000 UGX.`);
        return false;
      }
    }
    for (const { key, label } of VIDEO_FIELDS) {
      const v = Number(values[key]);
      if (!Number.isInteger(v) || v < 100 || v > 10_000_000) {
        setActiveTab('video');
        setError(`${label} must be an integer between 100 and 10,000,000 UGX.`);
        return false;
      }
    }
    setError(null);
    return true;
  }, [values]);

  const handleTabChange = useCallback((tab: PricingTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const payload: Partial<SubscriptionPriceConfig> = {};
      for (const { key } of ALL_FIELDS) {
        (payload as any)[key] = Number(values[key]);
      }
      await updateConfig.mutateAsync(payload);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Subscription pricing saved successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [validate, values, updateConfig, onClose]);

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
            <View style={[styles.iconBg, { backgroundColor: withAlpha('#2196F3', 0.12) }]}>
              <CreditCard size={22} color="#2196F3" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>Subscription Pricing</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Configure plan prices in UGX
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
            <PricingTabSwitcher
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
            {(activeTab === 'survey' ? SURVEY_FIELDS : VIDEO_FIELDS).map(({ key, label }) => (
              <PriceFieldRow
                key={key}
                fieldKey={key}
                label={label}
                value={values[key] || ''}
                onChangeText={updateField}
                colors={colors}
              />
            ))}

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
// PRICING TAB SWITCHER SUB-COMPONENT
// ============================================================================

const TAB_SPRING_CONFIG = { damping: 20, stiffness: 300 };
const MIN_TOUCH_TARGET = 48;

interface PricingTabSwitcherProps {
  activeTab: PricingTab;
  onTabChange: (tab: PricingTab) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const PricingTabSwitcher = React.memo<PricingTabSwitcherProps>(({
  activeTab,
  onTabChange,
  colors,
  isDark,
}) => {
  const reduceMotion = useReducedMotion();
  const indicatorPos = useSharedValue(activeTab === 'video' ? 1 : 0);

  useEffect(() => {
    const target = activeTab === 'video' ? 1 : 0;
    indicatorPos.value = reduceMotion
      ? target
      : withSpring(target, TAB_SPRING_CONFIG);
  }, [activeTab, indicatorPos, reduceMotion]);

  const handleTabPress = useCallback((tab: PricingTab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(
      tab === 'survey' ? 'Showing survey plan prices' : 'Showing video plan prices'
    );
    onTabChange(tab);
  }, [activeTab, onTabChange]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorPos.value * 50}%` as any,
  }));

  const surveyTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indicatorPos.value,
      [0, 1],
      [isDark ? '#FFFFFF' : '#000000', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)']
    ),
  }));

  const videoTextStyle = useAnimatedStyle(() => ({
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
      accessibilityLabel="Pricing category tabs"
      style={[tabStyles.container, { backgroundColor: containerBg, borderColor: withAlpha(colors.border, 0.3) }]}
    >
      <Animated.View style={[tabStyles.indicator, { backgroundColor: pillBg }, indicatorStyle]} />

      <Pressable
        style={tabStyles.tab}
        onPress={() => handleTabPress('survey')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'survey' }}
        accessibilityLabel="Survey Plans"
        accessibilityHint="Show survey subscription plan prices"
      >
        <ClipboardList
          size={16}
          color={activeTab === 'survey' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[tabStyles.tabText, surveyTextStyle]}>
          Survey Plans
        </Animated.Text>
      </Pressable>

      <Pressable
        style={tabStyles.tab}
        onPress={() => handleTabPress('video')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'video' }}
        accessibilityLabel="Video Plans"
        accessibilityHint="Show video subscription plan prices"
      >
        <Video
          size={16}
          color={activeTab === 'video' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[tabStyles.tabText, videoTextStyle]}>
          Video Plans
        </Animated.Text>
      </Pressable>
    </View>
  );
});

PricingTabSwitcher.displayName = 'PricingTabSwitcher';

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
// PRICE FIELD ROW SUB-COMPONENT
// ============================================================================

interface PriceFieldRowProps {
  fieldKey: string;
  label: string;
  value: string;
  onChangeText: (key: string, text: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const PriceFieldRow = React.memo(function PriceFieldRow({
  fieldKey,
  label,
  value,
  onChangeText,
  colors,
}: PriceFieldRowProps) {
  const numValue = Number(value);
  const preview = Number.isInteger(numValue) && numValue > 0
    ? `${numValue.toLocaleString()} UGX`
    : null;

  const handleChange = useCallback((text: string) => {
    onChangeText(fieldKey, text);
  }, [fieldKey, onChangeText]);

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.priceRow}>
        <TextInput
          style={[styles.input, {
            color: colors.text,
            backgroundColor: withAlpha(colors.text, 0.04),
            borderColor: withAlpha(colors.border, 0.3),
          }]}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          accessibilityLabel={`${label} price`}
          accessibilityHint="Enter price in UGX"
        />
        {preview && (
          <Text style={[styles.previewText, { color: colors.success }]}>{preview}</Text>
        )}
      </View>
    </View>
  );
});

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
    gap: SPACING.md,
  },
  fieldGroup: {
    gap: SPACING.xxs,
  },
  fieldLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm + 2,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  previewText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 80,
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
