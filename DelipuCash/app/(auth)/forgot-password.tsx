import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react-native";
import { useTheme, ThemeColors, SPACING, TYPOGRAPHY, RADIUS } from "@/utils/theme";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AuthErrorMessage } from "@/components/ui/AuthErrorMessage";
import { validators, validateForm, ValidationSchema } from "@/utils/validation";
import { useForgotPasswordMutation } from "@/services/authHooks";

interface FormErrors {
  email?: string | null;
}

interface TouchedFields {
  email?: boolean;
}

const validationSchema: ValidationSchema = {
  email: [validators.required, validators.email],
};

interface SuccessScreenProps {
  email: string;
  colors: ThemeColors;
  statusBarStyle: "light" | "dark" | "auto" | "inverted";
  insets: { top: number; bottom: number };
  onBackToLogin: () => void;
  onTryAgain: () => void;
}

const SuccessScreen = memo<SuccessScreenProps>(
  ({ email, colors, statusBarStyle, insets, onBackToLogin, onTryAgain }) => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <View
        style={[
          styles.successContainer,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
          <CheckCircle size={48} color={colors.success} />
        </View>

        <Text style={[styles.successTitle, { color: colors.text }]}>
          Check Your Email
        </Text>

        <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
          We&apos;ve sent a password reset link to{"\n"}
          <Text style={[styles.successEmail, { color: colors.text }]}>{email}</Text>
        </Text>

        <PrimaryButton
          title="Back to Login"
          onPress={onBackToLogin}
          style={styles.successButton}
        />

        <TouchableOpacity onPress={onTryAgain} accessibilityRole="button">
          <Text style={[styles.tryAgainText, { color: colors.textSecondary }]}>
            Didn&apos;t receive email?{" "}
            <Text style={{ color: colors.primary }}>Try again</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
);

SuccessScreen.displayName = "SuccessScreen";

/**
 * Forgot password screen component
 * Handles password reset request flow
 */
export default function ForgotPasswordScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();

  const forgotPasswordMutation = useForgotPasswordMutation();

  const [email, setEmail] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [success, setSuccess] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>("");

  const handleChange = useCallback(
    (value: string): void => {
      setEmail(value);
      if (errors.email) {
        setErrors({});
      }
      setGeneralError("");
    },
    [errors]
  );

  const handleBlur = useCallback((): void => {
    setTouched({ email: true });
    const fieldValidators = validationSchema.email;
    for (const validator of fieldValidators) {
      const error = validator(email, "email");
      if (error) {
        setErrors({ email: error });
        break;
      }
    }
  }, [email]);

  const handleSubmit = async (): Promise<void> => {
    setTouched({ email: true });

    const { errors: validationErrors, isValid } = validateForm(
      { email },
      validationSchema
    );
    setErrors(validationErrors);

    if (!isValid) {
      return;
    }

    setGeneralError("");

    try {
      const normalizedEmail = email.toLowerCase().trim();
      await forgotPasswordMutation.mutateAsync({ email: normalizedEmail });
      setSuccess(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred. Please try again.";
      setGeneralError(errorMessage);
    }
  };

  const handleBackToLogin = (): void => {
    router.replace("/(auth)/login");
  };

  const handleTryAgain = (): void => {
    setSuccess(false);
    setEmail("");
  };

  const handleBack = (): void => {
    router.back();
  };

  if (success) {
    return (
      <SuccessScreen
        email={email}
        colors={colors}
        statusBarStyle={statusBarStyle}
        insets={{ top: insets.top, bottom: insets.bottom }}
        onBackToLogin={handleBackToLogin}
        onTryAgain={handleTryAgain}
      />
    );
  }

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
              Forgot Password?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              No worries! Enter your email address and we&apos;ll send you a link to
              reset your password.
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
              value={email}
              onChangeText={handleChange}
              onBlur={handleBlur}
              error={errors.email}
              touched={touched.email}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              leftIcon={<Mail size={20} color={colors.textMuted} />}
            />
          </View>

          {/* Submit Button */}
          <PrimaryButton
            title="Send Reset Link"
            onPress={handleSubmit}
            loading={forgotPasswordMutation.isPending}
            disabled={forgotPasswordMutation.isPending}
            accessibilityHint="Double tap to send a password reset link to your email"
            style={styles.submitButton}
          />

          {/* Back to Login */}
          <View style={styles.loginLinkContainer}>
            <Text style={[styles.loginLinkText, { color: colors.textSecondary }]}>
              Remember your password?{" "}
            </Text>
            <TouchableOpacity
              onPress={handleBackToLogin}
              accessibilityRole="link"
              accessibilityLabel="Sign in"
            >
              <Text style={[styles.loginLink, { color: colors.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  formContainer: {
    marginBottom: SPACING.lg,
  },
  submitButton: {
    marginBottom: SPACING.lg,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  loginLink: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  successMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    marginBottom: SPACING.xl,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  successEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  successButton: {
    width: "100%",
    marginBottom: SPACING.base,
  },
  tryAgainText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
