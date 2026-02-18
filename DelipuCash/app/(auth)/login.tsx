import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { OTPVerificationModal } from "@/components/profile/OTPVerificationModal";
import { AuthErrorMessage } from "@/components/ui/AuthErrorMessage";
import { useSend2FACodeMutation, useVerify2FALoginMutation } from "@/services/authHooks";
import { useAuth } from "@/utils/auth";
import { useAuthStore } from "@/utils/auth/store";
import {
    SPACING,
    TYPOGRAPHY,
    RADIUS,
    useTheme
} from "@/utils/theme";
import { validateForm, ValidationSchema, validators } from "@/utils/validation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FormData {
  email: string;
  password: string;
  [key: string]: string;
}

interface FormErrors {
  [key: string]: string | null | undefined;
}

interface TouchedFields {
  [key: string]: boolean | undefined;
}

const validationSchema: ValidationSchema = {
  email: [validators.required, validators.email],
  password: [validators.required, validators.minLength(6)],
};

/**
 * Login screen component
 * Handles user authentication with email and password
 */
export default function LoginScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { login, isLoading, isReady: authReady, isAuthenticated } = useAuth();
  const isNavigatingRef = React.useRef(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [generalError, setGeneralError] = useState<string>("");

  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);

  const send2FAMutation = useSend2FACodeMutation();
  const verify2FAMutation = useVerify2FALoginMutation();

  // Auto-redirect if user lands on login while already authenticated
  // (e.g. back-navigation). Skip if handleLogin is driving navigation.
  useEffect(() => {
    if (authReady && isAuthenticated && !isNavigatingRef.current) {
      router.replace("/(tabs)/home-redesigned");
    }
  }, [authReady, isAuthenticated]);

  const handleChange = useCallback(
    (field: keyof FormData, value: string): void => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: null }));
      }
      setGeneralError("");
    },
    [errors]
  );

  const handleBlur = useCallback(
    (field: keyof FormData): void => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const fieldValidators = validationSchema[field];
      if (fieldValidators) {
        for (const validator of fieldValidators) {
          const error = validator(formData[field], String(field));
          if (error) {
            setErrors((prev) => ({ ...prev, [field]: error }));
            break;
          }
        }
      }
    },
    [formData]
  );

  const handleLogin = async (): Promise<void> => {
    const allTouched: TouchedFields = {};
    (Object.keys(validationSchema) as (keyof ValidationSchema)[]).forEach(
      (key) => {
        allTouched[key] = true;
      }
    );
    setTouched(allTouched);

    const { errors: validationErrors, isValid } = validateForm(
      formData,
      validationSchema
    );
    setErrors(validationErrors);

    if (!isValid) {
      return;
    }

    setGeneralError("");

    // Pre-read onboarding flag BEFORE login so we know the destination
    // without any async gap after auth state changes
    const hasOnboarded = await AsyncStorage.getItem('hasCompletedOnboarding');

    // Set navigation guard BEFORE login() — the mutation's onSuccess will
    // call setAuth() which triggers a re-render with isAuthenticated=true.
    // Without this, the useEffect auto-redirect races and wins.
    isNavigatingRef.current = true;

    const response = await login({
      email: formData.email,
      password: formData.password,
    });

    if (response.success) {
      // 2FA required — send code and show OTP modal
      if (response.message === '2FA_REQUIRED') {
        isNavigatingRef.current = false;
        setLoginEmail(formData.email);
        send2FAMutation.mutate(
          { email: formData.email },
          {
            onSuccess: (data) => {
              setMaskedEmail(data.data?.email || formData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
              setOtpExpiresAt(Date.now() + (data.data?.expiresIn ?? 600) * 1000);
              setShow2FAModal(true);
            },
            onError: (err) => {
              setGeneralError(err.message || 'Failed to send verification code.');
            },
          }
        );
        return;
      }

      // Defer navigation by one tick so the root layout can settle
      // after the auth state change (prevents "navigate before mounting" error)
      requestAnimationFrame(() => {
        if (!hasOnboarded) {
          AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          router.replace("/welcome");
        } else {
          router.replace("/(tabs)/home-redesigned");
        }
      });
    } else {
      // Login failed — release the navigation guard so useEffect can
      // handle future auth changes (e.g. back-navigation while authed)
      isNavigatingRef.current = false;
      setGeneralError(response.error || "Login failed. Please try again.");
    }
  };

  /** Verify the 2FA code entered in the OTP modal */
  const handle2FAVerify = useCallback(async (code: string) => {
    // Pre-read onboarding flag before auth state change
    const hasOnboarded = await AsyncStorage.getItem('hasCompletedOnboarding');
    isNavigatingRef.current = true;

    verify2FAMutation.mutate(
      { email: loginEmail, code },
      {
        onSuccess: () => {
          setShow2FAModal(false);
          queryClient.invalidateQueries();
          requestAnimationFrame(() => {
            if (!hasOnboarded) {
              AsyncStorage.setItem('hasCompletedOnboarding', 'true');
              router.replace("/welcome");
            } else {
              router.replace("/(tabs)/home-redesigned");
            }
          });
        },
        onError: (err) => {
          isNavigatingRef.current = false;
          setGeneralError(err.message || 'Invalid verification code.');
        },
      }
    );
  }, [loginEmail, verify2FAMutation, queryClient]);

  /** Resend 2FA code */
  const handle2FAResend = useCallback(() => {
    send2FAMutation.mutate(
      { email: loginEmail },
      {
        onSuccess: (data) => {
          setOtpExpiresAt(Date.now() + (data.data?.expiresIn ?? 600) * 1000);
        },
      }
    );
  }, [loginEmail, send2FAMutation]);

  const handleBack = (): void => {
    router.back();
  };

  const handleForgotPassword = (): void => {
    router.push("/(auth)/forgot-password");
  };

  const handleSignUp = (): void => {
    router.replace("/(auth)/signup");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backButton, { backgroundColor: colors.card }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.text }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to continue earning rewards
            </Text>
          </View>

          {/* Error Message */}
          {generalError ? (
            <AuthErrorMessage message={generalError} />
          ) : null}

          {/* Form */}
          <View style={styles.formContainer}>
            <FormInput
              label="Email Address"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(value) => handleChange("email", value)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              touched={touched.email}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              editable={!isLoading}
              leftIcon={<Mail size={20} color={colors.textMuted} />}
            />

            <FormInput
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChangeText={(value) => handleChange("password", value)}
              onBlur={() => handleBlur("password")}
              error={errors.password}
              touched={touched.password}
              secureTextEntry
              autoComplete="password"
              editable={!isLoading}
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordLink}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              disabled={isLoading}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <PrimaryButton
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            accessibilityHint="Double tap to sign in to your account"
            style={styles.loginButton}
          />

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: colors.textSecondary }]}>
              Don&apos;t have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={handleSignUp}
              accessibilityRole="link"
              accessibilityLabel="Sign up"
              disabled={isLoading}
            >
              <Text style={[styles.signUpLink, { color: colors.primary }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 2FA Verification Modal */}
      <OTPVerificationModal
        visible={show2FAModal}
        variant="verification"
        title="Two-Factor Authentication"
        subtitle="Enter the 6-digit code sent to your email"
        maskedEmail={maskedEmail}
        expiresAt={otpExpiresAt}
        onVerify={handle2FAVerify}
        onResend={handle2FAResend}
        onClose={() => {
          setShow2FAModal(false);
          isNavigatingRef.current = false;
        }}
        isVerifying={verify2FAMutation.isPending}
        isResending={send2FAMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginBottom: SPACING['2xl'],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  formContainer: {
    marginBottom: SPACING.lg,
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
  },
  forgotPasswordText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  loginButton: {
    marginBottom: SPACING.lg,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginHorizontal: SPACING.base,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  signUpLink: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});
