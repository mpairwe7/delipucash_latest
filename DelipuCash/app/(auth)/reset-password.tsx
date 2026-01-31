import React, { useState, useCallback, useEffect, memo } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from "lucide-react-native";
import { useTheme, ThemeColors } from "@/utils/theme";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { validators, validateForm, ValidationSchema } from "@/utils/validation";

interface FormData {
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  password?: string | null;
  confirmPassword?: string | null;
}

interface TouchedFields {
  password?: boolean;
  confirmPassword?: boolean;
}

const validationSchema: ValidationSchema = {
  password: [validators.required, validators.minLength(8)],
  confirmPassword: [validators.required],
};

interface ErrorMessageProps {
  message: string;
  colors: ThemeColors;
}

const ErrorMessage = memo<ErrorMessageProps>(({ message, colors }) => (
  <View
    style={[
      styles.errorContainer,
      {
        backgroundColor: `${colors.error}15`,
        borderColor: `${colors.error}30`,
      },
    ]}
  >
    <AlertCircle size={20} color={colors.error} style={{ marginRight: 8 }} />
    <Text style={[styles.errorText, { color: colors.error }]}>{message}</Text>
  </View>
));

ErrorMessage.displayName = "ErrorMessage";

interface SuccessScreenProps {
  colors: ThemeColors;
  statusBarStyle: "light" | "dark" | "auto" | "inverted";
  insets: { top: number; bottom: number };
  onBackToLogin: () => void;
}

const SuccessScreen = memo<SuccessScreenProps>(
  ({ colors, statusBarStyle, insets, onBackToLogin }) => (
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
          Password Reset!
        </Text>

        <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
          Your password has been successfully reset.{"\n"}
          You can now log in with your new password.
        </Text>

        <PrimaryButton
          title="Sign In"
          onPress={onBackToLogin}
          style={styles.successButton}
        />
      </View>
    </View>
  )
);

SuccessScreen.displayName = "SuccessScreen";

interface InvalidTokenScreenProps {
  colors: ThemeColors;
  statusBarStyle: "light" | "dark" | "auto" | "inverted";
  insets: { top: number; bottom: number };
  onRequestNew: () => void;
  onBackToLogin: () => void;
}

const InvalidTokenScreen = memo<InvalidTokenScreenProps>(
  ({ colors, statusBarStyle, insets, onRequestNew, onBackToLogin }) => (
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
        <View style={[styles.errorIcon, { backgroundColor: `${colors.error}20` }]}>
          <AlertCircle size={48} color={colors.error} />
        </View>

        <Text style={[styles.successTitle, { color: colors.text }]}>
          Link Expired
        </Text>

        <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
          This password reset link has expired or is invalid.{"\n"}
          Please request a new one.
        </Text>

        <PrimaryButton
          title="Request New Link"
          onPress={onRequestNew}
          style={styles.successButton}
        />

        <TouchableOpacity onPress={onBackToLogin} accessibilityRole="button">
          <Text style={[styles.tryAgainText, { color: colors.textSecondary }]}>
            Back to{" "}
            <Text style={{ color: colors.primary }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
);

InvalidTokenScreen.displayName = "InvalidTokenScreen";

/**
 * Reset password screen component
 * Handles password reset with valid token from email link
 */
export default function ResetPasswordScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [formData, setFormData] = useState<FormData>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [validatingToken, setValidatingToken] = useState<boolean>(true);
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>("");

  const token = params.token || "";
  const email = params.email || "";

  // Validate token on mount
  useEffect(() => {
    const validateToken = async (): Promise<void> => {
      if (!token || !email) {
        setTokenValid(false);
        setValidatingToken(false);
        return;
      }

      try {
        const baseURL = process.env.EXPO_PUBLIC_BASE_URL;
        const response = await fetch(`${baseURL}/api/auth/validate-reset-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, email }),
        });

        const data = await response.json();
        setTokenValid(data.valid === true);
      } catch (error) {
        console.error("Token validation error:", error);
        setTokenValid(false);
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [token, email]);

  const handleChange = useCallback(
    (field: "password" | "confirmPassword") => (value: string): void => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: null }));
      }
      setGeneralError("");
    },
    [errors]
  );

  const handleBlur = useCallback(
    (field: "password" | "confirmPassword") => (): void => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const fieldValidators = validationSchema[field];
      if (fieldValidators) {
        for (const validator of fieldValidators) {
          const error = validator(formData[field], field);
          if (error) {
            setErrors((prev) => ({ ...prev, [field]: error }));
            break;
          }
        }
      }

      // Check password match
      if (field === "confirmPassword" && formData.password !== formData.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
      }
    },
    [formData]
  );

  const handleSubmit = async (): Promise<void> => {
    setTouched({ password: true, confirmPassword: true });

    const formValues: Record<string, string> = { 
      password: formData.password, 
      confirmPassword: formData.confirmPassword 
    };
    const { errors: validationErrors, isValid } = validateForm(
      formValues,
      validationSchema
    );

    // Check password match
    if (formData.password !== formData.confirmPassword) {
      validationErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(validationErrors);

    if (!isValid || formData.password !== formData.confirmPassword) {
      return;
    }

    setLoading(true);
    setGeneralError("");

    try {
      const baseURL = process.env.EXPO_PUBLIC_BASE_URL;
      const response = await fetch(`${baseURL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          newPassword: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password.");
      }

      setSuccess(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred. Please try again.";
      setGeneralError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = (): void => {
    router.replace("/(auth)/login");
  };

  const handleRequestNew = (): void => {
    router.replace("/(auth)/forgot-password");
  };

  const handleBack = (): void => {
    router.back();
  };

  // Loading state
  if (validatingToken) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Validating link...
          </Text>
        </View>
      </View>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <InvalidTokenScreen
        colors={colors}
        statusBarStyle={statusBarStyle}
        insets={{ top: insets.top, bottom: insets.bottom }}
        onRequestNew={handleRequestNew}
        onBackToLogin={handleBackToLogin}
      />
    );
  }

  // Success state
  if (success) {
    return (
      <SuccessScreen
        colors={colors}
        statusBarStyle={statusBarStyle}
        insets={{ top: insets.top, bottom: insets.bottom }}
        onBackToLogin={handleBackToLogin}
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
              Create New Password
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter a strong password for your account. Your password must be at
              least 8 characters long.
            </Text>
          </View>

          {/* Error Message */}
          {generalError ? (
            <ErrorMessage message={generalError} colors={colors} />
          ) : null}

          {/* Form */}
          <View style={styles.formContainer}>
            <FormInput
              label="New Password"
              placeholder="Enter new password"
              value={formData.password}
              onChangeText={handleChange("password")}
              onBlur={handleBlur("password")}
              error={errors.password}
              touched={touched.password}
              secureTextEntry
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            {formData.password.length > 0 && (
              <PasswordStrengthIndicator password={formData.password} />
            )}

            <FormInput
              label="Confirm Password"
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChangeText={handleChange("confirmPassword")}
              onBlur={handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              secureTextEntry
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />
          </View>

          {/* Submit Button */}
          <PrimaryButton
            title="Reset Password"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
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
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: "Roboto_700Bold",
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
    flex: 1,
  },
  formContainer: {
    marginBottom: 24,
  },
  submitButton: {
    marginBottom: 24,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
  },
  loginLink: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 12,
  },
  successMessage: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  successButton: {
    width: "100%",
    marginBottom: 16,
  },
  tryAgainText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
});
