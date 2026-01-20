import { Checkbox } from "@/components/Checkbox";
import { FormInput } from "@/components/FormInput";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { PhoneInput } from "@/components/PhoneInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/utils/auth";
import {
    ThemeColors,
    useTheme
} from "@/utils/theme";
import { FormFieldValue, validateForm, ValidationSchema, validators } from "@/utils/validation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Lock, Mail, User } from "lucide-react-native";
import React, { memo, useCallback, useState } from "react";
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
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
 * Signup screen component
 * Handles new user registration with validation
 */
export default function SignupScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { register, isLoading } = useAuth();

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
      router.replace("/(tabs)");
    } else {
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

            <Text style={[styles.title, { color: colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign up to start earning rewards
            </Text>
          </View>

          {/* Error Message */}
          {generalError ? (
            <ErrorMessage message={generalError} colors={colors} />
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
                  leftIcon={<User size={20} color={colors.textMuted} />}
                />
              </View>
              <View style={styles.nameField}>
                <FormInput
                  label="Last Name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChangeText={(value) => handleChange("lastName", value)}
                  onBlur={() => handleBlur("lastName")}
                  error={errors.lastName}
                  touched={touched.lastName}
                  autoCapitalize="words"
                  autoComplete="family-name"
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
              leftIcon={<Mail size={20} color={colors.textMuted} />}
            />

            <FormInput
              label="Password"
              placeholder="Create a strong password"
              value={formData.password}
              onChangeText={(value) => handleChange("password", value)}
              onBlur={() => handleBlur("password")}
              error={errors.password}
              touched={touched.password}
              secureTextEntry
              autoComplete="new-password"
              leftIcon={<Lock size={20} color={colors.textMuted} />}
            />

            <PasswordStrengthIndicator password={formData.password} />

            <FormInput
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleChange("confirmPassword", value)}
              onBlur={() => handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              secureTextEntry
              autoComplete="new-password"
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
                    onPress={() => openLink("https://example.com/terms")}
                  >
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={{ color: colors.primary }}
                    onPress={() => openLink("https://example.com/privacy")}
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
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  termsText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  checkbox: {
    marginBottom: 24,
  },
  signupButton: {
    marginBottom: 24,
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  signInText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
  },
  signInLink: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
});
