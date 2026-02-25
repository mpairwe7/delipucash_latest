/**
 * ChangePasswordModal Component
 *
 * A polished, accessible change-password modal matching the EditProfileModal pattern:
 * - Reanimated spring entrance/exit (SlideInDown/SlideOutDown)
 * - FormField reuse with animated focus/error borders
 * - Cascading FadeInDown entry for hero, fields, and info sections
 * - Success check animation with auto-close (Instagram pattern)
 * - Unsaved changes guard
 * - Full accessibility: labels, roles, hints, announcements
 * - Haptic feedback on validation errors and successful save
 *
 * @module components/profile/ChangePasswordModal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Check,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from '@/utils/haptics';
import {
  useTheme,
  SPACING,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';
import { FormField } from './EditProfileModal';

const LOCK_ICON_SIZE = 64;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export interface ChangePasswordModalProps {
  visible: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

interface PasswordFormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function ChangePasswordModal({
  visible,
  onChangePassword,
  onClose,
  isSaving = false,
}: ChangePasswordModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Refs for sequential keyboard navigation
  const currentPasswordRef = useRef<TextInput | null>(null);
  const newPasswordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);

  // Animation values
  const saveScale = useSharedValue(1);

  // Timer refs for cleanup on unmount / re-open
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Local guard against double-tap (complements parent's isSaving)
  const isSavingRef = useRef(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
      setIsDirty(false);
      setShowSuccessCheck(false);
      isSavingRef.current = false;

      // Focus current password field after modal animation
      focusTimerRef.current = setTimeout(() => {
        currentPasswordRef.current?.focus();
      }, 500);
    }

    return () => {
      // Clear any pending timers when modal closes or component unmounts
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [visible]);

  // Check if form has any content
  const hasContent = useMemo(() => {
    return currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;
  }, [currentPassword, newPassword, confirmPassword]);

  // Check if form is complete enough to submit
  const canSubmit = useMemo(() => {
    return currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0;
  }, [currentPassword, newPassword, confirmPassword]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: PasswordFormErrors = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (!newPassword || newPassword.length < 8) {
      newErrors.newPassword = 'New password must be at least 8 characters';
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  // Handle input change — clear field error on typing
  const handleChange = useCallback((field: keyof PasswordFormErrors, value: string) => {
    setIsDirty(true);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Handle save — shows success animation then auto-closes
  const handleSave = useCallback(async () => {
    // Guard against double-tap (isSaving from parent may lag behind)
    if (isSavingRef.current) return;

    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      AccessibilityInfo.announceForAccessibility('Please fix the errors in the form before saving.');
      return;
    }

    isSavingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await onChangePassword(currentPassword, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show success animation, then auto-close
      setShowSuccessCheck(true);
      AccessibilityInfo.announceForAccessibility('Password changed successfully.');

      autoCloseTimerRef.current = setTimeout(() => {
        setShowSuccessCheck(false);
        onClose();
      }, 1200);
    } catch (error) {
      isSavingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Map server error to the most relevant field
      const message = error instanceof Error ? error.message : 'Failed to change password';
      const lower = message.toLowerCase();
      if (lower.includes('current') || lower.includes('incorrect') || lower.includes('wrong')) {
        setErrors({ currentPassword: message });
      } else {
        setErrors({ newPassword: message });
      }
    }
  }, [currentPassword, newPassword, validateForm, onChangePassword, onClose]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (isSaving) return;

    if (hasContent && isDirty) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            },
          },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  }, [hasContent, isDirty, isSaving, onClose]);

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const handleSavePressIn = () => {
    saveScale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
  };

  const handleSavePressOut = () => {
    saveScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  // Eye toggle elements
  const currentPasswordToggle = (
    <TouchableOpacity
      onPress={() => setShowCurrentPassword(v => !v)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={showCurrentPassword ? 'Hide current password' : 'Show current password'}
      accessibilityRole="button"
      style={cpStyles.eyeToggle}
    >
      {showCurrentPassword
        ? <EyeOff size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />
        : <Eye size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
    </TouchableOpacity>
  );

  const newPasswordToggle = (
    <TouchableOpacity
      onPress={() => setShowNewPassword(v => !v)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
      accessibilityRole="button"
      style={cpStyles.eyeToggle}
    >
      {showNewPassword
        ? <EyeOff size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />
        : <Eye size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
    </TouchableOpacity>
  );

  const confirmPasswordToggle = (
    <TouchableOpacity
      onPress={() => setShowConfirmPassword(v => !v)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
      accessibilityRole="button"
      style={cpStyles.eyeToggle}
    >
      {showConfirmPassword
        ? <EyeOff size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />
        : <Eye size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      accessibilityViewIsModal
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
        style={[cpStyles.overlay, { backgroundColor: withAlpha('#000', 0.5) }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={cpStyles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Animated.View
            entering={SlideInDown.springify().damping(15).reduceMotion(ReduceMotion.System)}
            exiting={SlideOutDown.springify().reduceMotion(ReduceMotion.System)}
            style={[
              cpStyles.container,
              {
                backgroundColor: colors.card,
                paddingTop: insets.top + SPACING.lg,
                paddingBottom: insets.bottom + SPACING.lg,
              },
            ]}
            accessible
            accessibilityLabel="Change Password"
            accessibilityRole="none"
          >
            {/* Header */}
            <View style={cpStyles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={[cpStyles.closeButton, { backgroundColor: withAlpha(colors.error, 0.1) }]}
                accessibilityLabel="Close password editor"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={ICON_SIZE.lg} color={colors.error} strokeWidth={2} />
              </TouchableOpacity>

              <View style={cpStyles.headerCenter}>
                <AccessibleText variant="h3" headingLevel={2} style={cpStyles.headerTitle}>
                  Change Password
                </AccessibleText>
              </View>

              <AnimatedTouchable
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
                onPress={handleSave}
                disabled={isSaving || !canSubmit}
                style={[
                  cpStyles.saveButton,
                  {
                    backgroundColor: canSubmit
                      ? colors.primary
                      : withAlpha(colors.primary, 0.3),
                  },
                  saveAnimatedStyle,
                ]}
                accessibilityLabel={
                  showSuccessCheck
                    ? 'Password changed successfully'
                    : canSubmit
                    ? 'Save new password'
                    : 'Fill all fields to save'
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving || !canSubmit }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : showSuccessCheck ? (
                  <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
                    <Check size={ICON_SIZE.lg} color={colors.primaryText} strokeWidth={3} />
                  </Animated.View>
                ) : (
                  <Check size={ICON_SIZE.lg} color={colors.primaryText} strokeWidth={2.5} />
                )}
              </AnimatedTouchable>
            </View>

            <ScrollView
              style={cpStyles.scrollView}
              contentContainerStyle={cpStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Lock Icon Section */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(300).reduceMotion(ReduceMotion.System)}
                style={cpStyles.heroSection}
              >
                <View style={cpStyles.lockContainer}>
                  <LinearGradient
                    colors={[colors.primary, withAlpha(colors.primary, 0.6)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={cpStyles.lockBorder}
                  >
                    <View style={[cpStyles.lockInner, { backgroundColor: colors.background }]}>
                      <LinearGradient
                        colors={[colors.primary, withAlpha(colors.primary, 0.7)]}
                        style={cpStyles.lockGradient}
                      >
                        <Lock size={32} color="#FFF" strokeWidth={2} />
                      </LinearGradient>
                    </View>
                  </LinearGradient>
                </View>

                <AccessibleText variant="bodySmall" color="textMuted" style={cpStyles.heroHint}>
                  Choose a strong, unique password
                </AccessibleText>
              </Animated.View>

              {/* Form Fields */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(300).reduceMotion(ReduceMotion.System)}
                style={cpStyles.formSection}
              >
                {/* Current Password */}
                <FormField
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={(v) => {
                    setCurrentPassword(v);
                    handleChange('currentPassword', v);
                  }}
                  placeholder="Enter current password"
                  error={errors.currentPassword}
                  icon={<Lock size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  required
                  secureTextEntry={!showCurrentPassword}
                  rightElement={currentPasswordToggle}
                  returnKeyType="next"
                  onSubmitEditing={() => newPasswordRef.current?.focus()}
                  inputRef={currentPasswordRef}
                  accessibilityLabel="Current password"
                  accessibilityHint="Enter your current account password"
                  colors={colors}
                />

                {/* New Password */}
                <FormField
                  label="New Password"
                  value={newPassword}
                  onChangeText={(v) => {
                    setNewPassword(v);
                    handleChange('newPassword', v);
                  }}
                  placeholder="Min 8 characters"
                  error={errors.newPassword}
                  icon={<KeyRound size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  required
                  secureTextEntry={!showNewPassword}
                  rightElement={newPasswordToggle}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  inputRef={newPasswordRef}
                  accessibilityLabel="New password"
                  accessibilityHint="Enter a new password, minimum 8 characters"
                  colors={colors}
                />

                {/* Confirm Password */}
                <FormField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    handleChange('confirmPassword', v);
                  }}
                  placeholder="Re-enter new password"
                  error={errors.confirmPassword}
                  icon={<KeyRound size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  required
                  secureTextEntry={!showConfirmPassword}
                  rightElement={confirmPasswordToggle}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  inputRef={confirmPasswordRef}
                  accessibilityLabel="Confirm new password"
                  accessibilityHint="Re-enter your new password to confirm"
                  colors={colors}
                />
              </Animated.View>

              {/* Security Info Box */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(300).reduceMotion(ReduceMotion.System)}
                style={[cpStyles.infoBox, { backgroundColor: withAlpha(colors.info, 0.06), borderColor: withAlpha(colors.info, 0.15) }]}
              >
                <Shield size={14} color={colors.info} strokeWidth={1.5} />
                <View style={cpStyles.infoTextContainer}>
                  <AccessibleText variant="caption" color="textMuted" style={cpStyles.infoText}>
                    Use a mix of letters, numbers, and symbols. Avoid using personal information or common words.
                  </AccessibleText>
                </View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  closeButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING['2xl'],
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  lockContainer: {
    position: 'relative',
  },
  lockBorder: {
    width: LOCK_ICON_SIZE + 8,
    height: LOCK_ICON_SIZE + 8,
    borderRadius: (LOCK_ICON_SIZE + 8) / 2,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInner: {
    width: LOCK_ICON_SIZE,
    height: LOCK_ICON_SIZE,
    borderRadius: LOCK_ICON_SIZE / 2,
    overflow: 'hidden',
  },
  lockGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHint: {
    marginTop: SPACING.sm,
  },
  formSection: {
    gap: SPACING.lg,
  },
  eyeToggle: {
    padding: SPACING.xs,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    lineHeight: 18,
  },
});

export default ChangePasswordModal;
