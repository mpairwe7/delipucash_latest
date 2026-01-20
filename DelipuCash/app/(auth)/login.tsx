import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { testCredentials } from "@/services/mockAuth";
import { useAuth } from "@/utils/auth";
import {
    ThemeColors,
    useTheme
} from "@/utils/theme";
import { validateForm, ValidationSchema, validators } from "@/utils/validation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Lock, Mail } from "lucide-react-native";
import React, { memo, useCallback, useState } from "react";
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
    <Text style={[styles.errorText, { color: colors.error }]}>{message}</Text>
  </View>
));

ErrorMessage.displayName = "ErrorMessage";

/**
 * Login screen component
 * Handles user authentication with email and password
 */
export default function LoginScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { login, isLoading } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: __DEV__ ? testCredentials.email : "",
    password: __DEV__ ? testCredentials.password : "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [generalError, setGeneralError] = useState<string>("");

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
    (Object.keys(validationSchema) as Array<keyof ValidationSchema>).forEach(
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

    const response = await login({
      email: formData.email,
      password: formData.password,
    });

    if (response.success) {
      router.replace("/(tabs)");
    } else {
      setGeneralError(response.error || "Login failed. Please try again.");
    }
  };

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
            <ErrorMessage message={generalError} colors={colors} />
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
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordLink}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
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
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={handleSignUp}
              accessibilityRole="link"
              accessibilityLabel="Sign up"
            >
              <Text style={[styles.signUpLink, { color: colors.primary }]}>
                Sign Up
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
    marginBottom: 40,
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
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
  formContainer: {
    marginBottom: 24,
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
  loginButton: {
    marginBottom: 24,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginHorizontal: 16,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
  },
  signUpLink: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
});
