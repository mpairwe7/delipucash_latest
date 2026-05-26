/**
 * DeleteAccountSheet
 *
 * Re-authentication sheet for permanent account deletion.
 *
 * Required by Google Play policy (in-app account deletion). Re-auths the
 * user with their password (and 2FA OTP if enabled) before calling
 * `useDeleteAccountMutation`. Two-step confirmation prevents accidental
 * taps; destructive button styling matches platform convention.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertOctagon, Lock, ShieldAlert, X } from 'lucide-react-native';

import { useDeleteAccountMutation } from '@/services/authHooks';
import { useSend2FACodeMutation } from '@/services/authHooks';
import { useToast } from '@/components/ui/Toast';
import { router } from 'expo-router';
import {
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Email of the currently signed-in user, used to send the 2FA OTP. */
  userEmail: string;
  /** Whether the user has 2FA enabled. */
  twoFactorEnabled: boolean;
}

export function DeleteAccountSheet({ visible, onClose, userEmail, twoFactorEnabled }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [step, setStep] = useState<'warn' | 'confirm'>('warn');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');

  const deleteMutation = useDeleteAccountMutation();
  const sendOtpMutation = useSend2FACodeMutation();

  // Reset state whenever the sheet is closed so a re-open starts fresh.
  useEffect(() => {
    if (!visible) {
      setStep('warn');
      setPassword('');
      setCode('');
      setReason('');
    }
  }, [visible]);

  const handleProceed = useCallback(() => {
    setStep('confirm');
    if (twoFactorEnabled) {
      sendOtpMutation.mutate({ email: userEmail });
    }
  }, [twoFactorEnabled, userEmail, sendOtpMutation]);

  const handleConfirm = useCallback(() => {
    if (!password) {
      showToast({ message: 'Enter your password to continue', type: 'error' });
      return;
    }
    if (twoFactorEnabled && code.length !== 6) {
      showToast({ message: 'Enter the 6-digit code from your email', type: 'error' });
      return;
    }
    deleteMutation.mutate(
      { password, code: twoFactorEnabled ? code : undefined, reason: reason || undefined },
      {
        onSuccess: (data) => {
          showToast({
            message: data.message || 'Account scheduled for deletion',
            type: 'success',
          });
          onClose();
          // Auth has been cleared by the mutation; route back to the welcome screen.
          setTimeout(() => router.replace('/'), 200);
        },
        onError: (err) => {
          showToast({ message: err.message || 'Could not delete account', type: 'error' });
        },
      },
    );
  }, [password, code, reason, twoFactorEnabled, deleteMutation, showToast, onClose]);

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
        onPress={isPending ? undefined : onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + SPACING.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={[styles.iconBadge, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
              <ShieldAlert size={22} color={colors.error} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Delete account</Text>
            <Pressable onPress={onClose} disabled={isPending} accessibilityLabel="Close" hitSlop={12}>
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {step === 'warn' ? (
              <>
                <Text style={[styles.subhead, { color: colors.text }]}>
                  This action is permanent.
                </Text>
                <Text style={[styles.body1, { color: colors.textSecondary }]}>
                  Your account is scheduled for permanent deletion in 30 days. During that window you can sign back in to cancel. After 30 days, all of your personal data is permanently removed.
                </Text>

                <View style={[styles.warnBox, { borderColor: withAlpha(colors.warning, 0.3), backgroundColor: withAlpha(colors.warning, 0.08) }]}>
                  <AlertOctagon size={18} color={colors.warning} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.warnTitle, { color: colors.text }]}>Before you continue</Text>
                    <Text style={[styles.warnText, { color: colors.textSecondary }]}>
                      • Pending withdrawals will be cancelled and refunded to your balance.{'\n'}
                      • All your active sessions will be signed out.{'\n'}
                      • You can request a copy of your data from the previous screen.
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={[styles.dangerBtn, { backgroundColor: colors.error }]}
                  onPress={handleProceed}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to delete account"
                >
                  <Text style={styles.dangerBtnText}>I understand — continue</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Keep my account</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.subhead, { color: colors.text }]}>Confirm it&apos;s you</Text>
                <Text style={[styles.body1, { color: colors.textSecondary }]}>
                  Enter your password{twoFactorEnabled ? ' and the 6-digit code we just emailed you' : ''} to permanently delete your account.
                </Text>

                <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
                  <Lock size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!isPending}
                    accessibilityLabel="Password"
                  />
                </View>

                {twoFactorEnabled && (
                  <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
                    <ShieldAlert size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: colors.text, letterSpacing: 6 }]}
                      placeholder="6-digit code"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      editable={!isPending}
                      accessibilityLabel="Six digit verification code"
                    />
                  </View>
                )}

                <TextInput
                  style={[styles.reason, { color: colors.text, borderColor: colors.border, backgroundColor: colors.elevated }]}
                  placeholder="Tell us why you're leaving (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={reason}
                  onChangeText={(v) => setReason(v.slice(0, 500))}
                  multiline
                  numberOfLines={3}
                  editable={!isPending}
                  accessibilityLabel="Reason for leaving"
                />

                <Pressable
                  style={[styles.dangerBtn, { backgroundColor: colors.error, opacity: isPending ? 0.7 : 1 }]}
                  onPress={handleConfirm}
                  disabled={isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Permanently delete account"
                  accessibilityState={{ disabled: isPending, busy: isPending }}
                >
                  {isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerBtnText}>Delete my account</Text>
                  )}
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isPending} accessibilityRole="button">
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  body: {
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  subhead: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  body1: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 20,
  },
  warnBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  warnTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: 4,
  },
  warnText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: COMPONENT_SIZE.input.medium,
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    paddingVertical: SPACING.sm,
  },
  reason: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dangerBtn: {
    height: COMPONENT_SIZE.button.large,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  cancelBtn: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default DeleteAccountSheet;
