/**
 * Magic Link Verification Screen
 *
 * Deep link handler for magic link login verification.
 * Opens when user taps the "Verify My Login" button in their 2FA email.
 *
 * Flow: Extract token + email from URL params → call verify endpoint → navigate to home
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CircleCheck, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, SPACING, RADIUS, withAlpha } from '@/utils/theme';
import { AccessibleText } from '@/components/profile/AccessibleText';
import { useVerifyMagicLinkMutation } from '@/services/authHooks';
import * as Haptics from '@/utils/haptics';

export default function VerifyLoginScreen(): React.ReactElement {
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const verifyMutation = useVerifyMagicLinkMutation();
  const hasAttempted = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Spinner animation
  const spinnerRotation = useSharedValue(0);
  const successScale = useSharedValue(0);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${spinnerRotation.value}deg` }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  // Start spinner
  useEffect(() => {
    spinnerRotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verify on mount
  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    if (!token || !email) {
      setStatus('error');
      setErrorMessage('Invalid link — missing token or email.');
      return;
    }

    verifyMutation.mutate(
      { email: decodeURIComponent(email), token: decodeURIComponent(token) },
      {
        onSuccess: async () => {
          setStatus('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          successScale.value = withSpring(1, { damping: 12, stiffness: 180 });

          // Navigate after brief success animation
          const hasOnboarded = await AsyncStorage.getItem('hasCompletedOnboarding');
          setTimeout(() => {
            if (!hasOnboarded) {
              AsyncStorage.setItem('hasCompletedOnboarding', 'true');
              router.replace('/welcome');
            } else {
              router.replace('/(tabs)/home-redesigned');
            }
          }, 1200);
        },
        onError: (err) => {
          setStatus('error');
          setErrorMessage(err.message || 'Link expired or invalid. Please try again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={statusBarStyle} />

      <View style={styles.content}>
        {status === 'loading' && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.center}
          >
            <Animated.View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.primary, 0.1) }, spinnerStyle]}>
              <View style={[styles.spinner, { borderColor: withAlpha(colors.primary, 0.2), borderTopColor: colors.primary }]} />
            </Animated.View>
            <AccessibleText variant="h3" center style={styles.statusText}>
              Verifying your login...
            </AccessibleText>
            <AccessibleText variant="body" color="textMuted" center>
              Please wait a moment
            </AccessibleText>
          </Animated.View>
        )}

        {status === 'success' && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.center}
          >
            <Animated.View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.success, 0.1) }, successStyle]}>
              <CircleCheck size={48} color={colors.success} />
            </Animated.View>
            <AccessibleText variant="h3" center style={styles.statusText}>
              Login Verified!
            </AccessibleText>
            <AccessibleText variant="body" color="textMuted" center>
              Redirecting to your account...
            </AccessibleText>
          </Animated.View>
        )}

        {status === 'error' && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.center}
          >
            <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
              <AlertCircle size={48} color={colors.error} />
            </View>
            <AccessibleText variant="h3" center style={styles.statusText}>
              Verification Failed
            </AccessibleText>
            <AccessibleText variant="body" color="textMuted" center style={styles.errorMessage}>
              {errorMessage}
            </AccessibleText>
            <Animated.View entering={FadeIn.delay(300).duration(200)}>
              <View
                style={[styles.goToLoginButton, { backgroundColor: colors.primary }]}
                accessible
                accessibilityRole="button"
              >
                <AccessibleText
                  variant="button"
                  customColor="#FFF"
                  onPress={() => router.replace('/(auth)/login')}
                >
                  Go to Login
                </AccessibleText>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  center: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
  },
  statusText: {
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
    lineHeight: 22,
  },
  goToLoginButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
});
