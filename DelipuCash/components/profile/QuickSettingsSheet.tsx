/**
 * QuickSettingsSheet — Fast-access settings bottom sheet
 *
 * Design Inspiration: iOS Control Center, Android Quick Settings, Instagram
 * settings gear, Spotify quick preferences, Cash App profile settings.
 *
 * 2026 Standards:
 * - BlurView backdrop with spring-animated slide-in (matches RewardSettingsSheet)
 * - Toggle switches with haptic feedback per interaction
 * - WCAG 2.2 AA accessible (roles, labels, hints, contrast)
 * - Zustand-persisted preferences survive app restarts
 * - Memoized items array to prevent unnecessary re-renders
 * - Edge-to-edge safe (statusBarTranslucent + navigationBarTranslucent)
 *
 * @example
 * ```tsx
 * <QuickSettingsSheet
 *   visible={showQuickSettings}
 *   onClose={() => setShowQuickSettings(false)}
 *   onViewAllSettings={() => scrollToSettings()}
 * />
 * ```
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Modal,
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
  Settings,
  Moon,
  Sun,
  Bell,
  BellOff,
  Wifi,
  WifiOff,
  Vibrate,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useTheme,
  useThemeStore,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import {
  useAppSettingsStore,
  selectPushNotificationsEnabled,
  selectDataSaverEnabled,
  selectHapticFeedbackEnabled,
  selectTogglePushNotifications,
  selectToggleDataSaver,
  selectToggleHapticFeedback,
} from '@/store/AppSettingsStore';

// ============================================================================
// TYPES
// ============================================================================

export interface QuickSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Callback to scroll to full settings section in profile */
  onViewAllSettings?: () => void;
}

// ============================================================================
// TOGGLE ITEM
// ============================================================================

interface QuickToggleItemProps {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  isLast?: boolean;
  accessibilityHint?: string;
}

const QuickToggleItem = React.memo(function QuickToggleItem({
  icon,
  label,
  subtitle,
  value,
  onToggle,
  isLast = false,
  accessibilityHint,
}: QuickToggleItemProps) {
  const { colors } = useTheme();
  const hapticEnabled = useAppSettingsStore(selectHapticFeedbackEnabled);

  const handleToggle = useCallback(
    (newValue: boolean) => {
      if (hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onToggle(newValue);
    },
    [onToggle, hapticEnabled],
  );

  return (
    <View
      style={[
        styles.toggleRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.border, 0.4) },
      ]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
        {icon}
      </View>
      <View style={styles.toggleContent}>
        <Text
          style={[styles.toggleLabel, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
        <Text
          style={[styles.toggleSubtitle, { color: colors.textMuted }]}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={handleToggle}
        thumbColor={value ? colors.primary : colors.border}
        trackColor={{
          false: withAlpha(colors.border, 0.6),
          true: withAlpha(colors.primary, 0.4),
        }}
        accessibilityLabel={`${label} toggle`}
      />
    </View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QuickSettingsSheet({
  visible,
  onClose,
  onViewAllSettings,
}: QuickSettingsSheetProps): React.ReactElement {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // App settings from store (atomic selectors — no extra re-renders)
  const pushEnabled = useAppSettingsStore(selectPushNotificationsEnabled);
  const dataSaverEnabled = useAppSettingsStore(selectDataSaverEnabled);
  const hapticEnabled = useAppSettingsStore(selectHapticFeedbackEnabled);
  const togglePush = useAppSettingsStore(selectTogglePushNotifications);
  const toggleDataSaver = useAppSettingsStore(selectToggleDataSaver);
  const toggleHaptic = useAppSettingsStore(selectToggleHapticFeedback);

  // Handlers
  const handleToggleTheme = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleTheme();
  }, [toggleTheme, hapticEnabled]);

  const handleViewAll = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    onViewAllSettings?.();
  }, [onClose, onViewAllSettings, hapticEnabled]);

  const handleClose = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose, hapticEnabled]);

  // Memoized icon elements (prevents re-creation on every render)
  const themeIcon = useMemo(
    () =>
      isDark ? (
        <Moon size={ICON_SIZE.base} color={colors.primary} strokeWidth={1.8} />
      ) : (
        <Sun size={ICON_SIZE.base} color={colors.warning} strokeWidth={1.8} />
      ),
    [isDark, colors.primary, colors.warning],
  );

  const notifIcon = useMemo(
    () =>
      pushEnabled ? (
        <Bell size={ICON_SIZE.base} color={colors.info} strokeWidth={1.8} />
      ) : (
        <BellOff size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.8} />
      ),
    [pushEnabled, colors.info, colors.textMuted],
  );

  const dataIcon = useMemo(
    () =>
      dataSaverEnabled ? (
        <WifiOff size={ICON_SIZE.base} color={colors.warning} strokeWidth={1.8} />
      ) : (
        <Wifi size={ICON_SIZE.base} color={colors.success} strokeWidth={1.8} />
      ),
    [dataSaverEnabled, colors.warning, colors.success],
  );

  const hapticIcon = useMemo(
    () => <Vibrate size={ICON_SIZE.base} color={colors.primary} strokeWidth={1.8} />,
    [colors.primary],
  );

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
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <BlurView
            intensity={isDark ? 40 : 25}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(200)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, SPACING.lg),
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: withAlpha(colors.border, 0.6) }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: withAlpha(colors.border, 0.3) }]}>
          <View style={[styles.headerIconBg, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
            <Settings size={22} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.headerText}>
            <Text
              style={[styles.title, { color: colors.text }]}
              allowFontScaling
              maxFontSizeMultiplier={1.2}
            >
              Quick Settings
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.textMuted }]}
              allowFontScaling
              maxFontSizeMultiplier={1.2}
            >
              Customize your experience
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={[styles.closeBtn, { backgroundColor: withAlpha(colors.text, 0.08) }]}
            accessibilityRole="button"
            accessibilityLabel="Close quick settings"
            hitSlop={8}
          >
            <X size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Toggle Items */}
        <View
          style={[
            styles.togglesContainer,
            {
              backgroundColor: colors.background,
              borderColor: withAlpha(colors.border, 0.5),
            },
          ]}
        >
          <QuickToggleItem
            icon={themeIcon}
            label={isDark ? 'Dark Mode' : 'Light Mode'}
            subtitle={isDark ? 'Easier on your eyes' : 'Bright and clear'}
            value={isDark}
            onToggle={handleToggleTheme}
            accessibilityHint="Toggle between dark and light theme"
          />
          <QuickToggleItem
            icon={notifIcon}
            label="Push Notifications"
            subtitle={pushEnabled ? 'You\'ll receive alerts' : 'Alerts are silenced'}
            value={pushEnabled}
            onToggle={togglePush}
            accessibilityHint="Toggle push notification alerts"
          />
          <QuickToggleItem
            icon={dataIcon}
            label="Data Saver"
            subtitle={dataSaverEnabled ? 'Reduced quality to save data' : 'Full quality streaming'}
            value={dataSaverEnabled}
            onToggle={toggleDataSaver}
            accessibilityHint="Toggle data saver mode for reduced bandwidth"
          />
          <QuickToggleItem
            icon={hapticIcon}
            label="Haptic Feedback"
            subtitle={hapticEnabled ? 'Touch vibrations enabled' : 'Vibrations disabled'}
            value={hapticEnabled}
            onToggle={toggleHaptic}
            isLast
            accessibilityHint="Toggle haptic vibration on interactions"
          />
        </View>

        {/* View All Settings */}
        {onViewAllSettings && (
          <Pressable
            onPress={handleViewAll}
            style={({ pressed }) => [
              styles.viewAllButton,
              {
                backgroundColor: pressed
                  ? withAlpha(colors.primary, 0.12)
                  : withAlpha(colors.primary, 0.06),
                borderColor: withAlpha(colors.primary, 0.15),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View all settings"
            accessibilityHint="Opens the full settings section in your profile"
          >
            <Text
              style={[styles.viewAllText, { color: colors.primary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.2}
            >
              All Settings
            </Text>
            <ChevronRight size={ICON_SIZE.sm} color={colors.primary} strokeWidth={2} />
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    ...SHADOWS.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerIconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglesContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: COMPONENT_SIZE.button.large,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  toggleContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  toggleLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.body,
  },
  toggleSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  viewAllText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.body,
  },
});

export default QuickSettingsSheet;
