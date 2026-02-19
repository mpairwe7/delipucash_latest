import { Checkbox } from "@/components/Checkbox";
import { FormInput } from "@/components/FormInput";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { PhoneInput } from "@/components/PhoneInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AuthErrorMessage } from "@/components/ui/AuthErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/utils/auth";
import { triggerHaptic } from "@/utils/quiz-utils";
import {
    SPACING,
    TYPOGRAPHY,
    RADIUS,
    useTheme
} from "@/utils/theme";
import { FormFieldValue, validateForm, ValidationSchema, validators } from "@/utils/validation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Lock, Mail, User } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  [key: string]: string | boolean;
}

interface FormErrors {
  [key: string]: string | null | undefined;
}

interface TouchedFields {
  [key: string]: boolean | undefined;
}

const confirmPasswordValidator = (
  confirmPassword: FormFieldValue,
  _fieldName?: string,
  formData?: FormData
): string | null => {
  if (!confirmPassword) return null;
  if (typeof confirmPassword === "string" && confirmPassword !== formData?.password) {
    return "Passwords do not match";
  }
  return null;
};

const createValidationSchema = (formData: FormData): ValidationSchema => ({
  firstName: [validators.required, validators.minLength(2)],
  lastName: [validators.required, validators.minLength(2)],
  phone: [validators.required, validators.phoneNumber],
  email: [validators.required, validators.email],
  password: [
    validators.required,
    validators.minLength(8),
    validators.pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number"
    ),
  ],
  confirmPassword: [
    validators.required,
    (value: FormFieldValue) =>
      confirmPasswordValidator(value, "confirmPassword", formData),
  ],
  acceptTerms: [
    validators.checked("You must accept the terms and conditions"),
  ],
});

/**
 * Signup screen component
 * Handles new user registration with validation
 */
export default function SignupScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { register, isLoading, isReady: authReady, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Refs for sequential keyboard navigation
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "+256 ",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [generalError, setGeneralError] = useState<string>("");

  // Auth guard: redirect already-authenticated users to home
  useEffect(() => {
    if (authReady && isAuthenticated) {
      router.replace("/(tabs)/home-redesigned");
    }
  }, [authReady, isAuthenticated]);

  const handleChange = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]): void => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        if (field === "password" && errors.confirmPassword) {
          setErrors((e) => ({ ...e, confirmPassword: null }));
        }
        return updated;
      });
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
      const schema = createValidationSchema(formData);
      const fieldValidators = schema[field];
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

  const handleSignup = async (): Promise<void> => {
    const allTouched: TouchedFields = {};
    const schema = createValidationSchema(formData);
    Object.keys(schema).forEach((key) => {
      allTouched[key as keyof TouchedFields] = true;
    });
    setTouched(allTouched);

    const { errors: validationErrors, isValid } = validateForm(formData, schema);
    setErrors(validationErrors);

    if (!isValid) {
      return;
    }

    setGeneralError("");

    const response = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phone.replace(/\s/g, ""),
      email: formData.email,
      password: formData.password,
    });

    if (response.success) {
      // Haptic celebration + toast on successful signup
      triggerHaptic("success");
      showToast({
        message: "Account created successfully! Please sign in to continue.",
        type: "success",
        duration: 3000,
      });

      // Redirect to login so user explicitly authenticates
      // (2026 best practice: signup ≠ auto-login)
      router.replace("/(auth)/login");
    } else {
      triggerHaptic("error");
      setGeneralError(response.error || "Registration failed. Please try again.");
    }
  };

  const openLink = (url: string): void => {
    Linking.openURL(url).catch(() => {});
  };

  const handleBack = (): void => {
    router.back();
  };

  const handleSignIn = (): void => {
    router.replace("/(auth)/login");
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

            <Text
              style={[styles.title, { color: colors.text }]}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.3}
            >
              Create Account
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={1.2}
            >
              Sign up to start earning rewards
            </Text>
          </View>

          {/* Error Message */}
          {generalError ? (
            <AuthErrorMessage message={generalError} />
          ) : null}

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Name Row */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <FormInput
                  label="First Name"
                  placeholder="John"
                  value={formData.firstName}
                  onChangeText={(value) => handleChange("firstName", value)}
                  onBlur={() => handleBlur("firstName")}
                  error={errors.firstName}
                  touched={touched.firstName}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  autoFocus
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  leftIcon={<User size={20} color={colors.textMuted} />}
                />
              </View>
              <View style={styles.nameField}>
                <FormInput
                  ref={lastNameRef}
                  label="Last Name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChangeText={(value) => handleChange("lastName", value)}
                  onBlur={() => handleBlur("lastName")}
                  error={errors.lastName}
                  touched={touched.lastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <PhoneInput
              label="Phone Number"
              placeholder="7XX XXX XXX"
              value={formData.phone}
              onChangeText={(value) => handleChange("phone", value)}
              onBlur={() => handleBlur("phone")}
              error={errors.phone}
              touched={touched.phone}
            />

            <FormInput
              ref={emailRef}
              label="Email Address"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChangeText={(value) => handleChange("email", value)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              touched={touched.email}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              leftIcon={<Mail size={20} color={colors.textMuted} />}
            />

            <FormInput
              ref={passwordRef}
              label="Password"
              placeholder="Create a strong password"
              value={formData.password}
              onChangeText={(value) => handleChange("password", value)}
              onBlur={() => handleBlur("password")}
              error={errors.password}
              touched={touched.password}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            <PasswordStrengthIndicator password={formData.password} />

            <FormInput
              ref={confirmPasswordRef}
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleChange("confirmPassword", value)}
              onBlur={() => handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            {/* Terms & Conditions */}
            <Checkbox
              checked={formData.acceptTerms}
              onPress={() => handleChange("acceptTerms", !formData.acceptTerms)}
              error={errors.acceptTerms}
              touched={touched.acceptTerms}
              label={
                <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                  I agree to the{" "}
                  <Text
                    style={{ color: colors.primary }}
                    onPress={() => openLink("https://mpairwe7.github.io/delipucash_latest/terms.html")}
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={{ color: colors.primary }}
                    onPress={() => openLink("https://mpairwe7.github.io/delipucash_latest/privacy.html")}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              }
              style={styles.checkbox}
            />
          </View>

          {/* Signup Button */}
          <PrimaryButton
            title="Create Account"
            onPress={handleSignup}
            loading={isLoading}
            disabled={isLoading}
            accessibilityHint="Double tap to create your account"
            style={styles.signupButton}
          />

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={[styles.signInText, { color: colors.textSecondary }]}>
              Already have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={handleSignIn}
              accessibilityRole="link"
              accessibilityLabel="Sign in"
            >
              <Text style={[styles.signInLink, { color: colors.primary }]}>
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
    marginBottom: SPACING.xl,
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
    marginBottom: SPACING.base,
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  nameField: {
    flex: 1,
  },
  termsText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },
  checkbox: {
    marginBottom: SPACING.lg,
  },
  signupButton: {
    marginBottom: SPACING.lg,
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.base,
  },
  signInText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  signInLink: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});
