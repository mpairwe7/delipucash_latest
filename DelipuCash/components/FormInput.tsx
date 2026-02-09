import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  COMPONENT_SIZE,
  BORDER_WIDTH,
  ANIMATION,
} from '@/utils/theme';

/**
 * Props for the FormInput component
 */
export interface FormInputProps extends Omit<TextInputProps, 'onBlur' | 'style'> {
  /** Label text displayed above the input */
  label?: string;
  /** Current input value */
  value?: string;
  /** Callback when text changes */
  onChangeText?: (text: string) => void;
  /** Callback when input loses focus */
  onBlur?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message to display */
  error?: string | null;
  /** Whether the field has been touched/visited */
  touched?: boolean;
  /** Whether to mask the input for passwords */
  secureTextEntry?: boolean;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side (not shown if secureTextEntry) */
  rightIcon?: React.ReactNode;
  /** Container style */
  style?: ViewStyle;
  /** Input text style */
  inputStyle?: TextStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Reusable form input component with error states, animations, and password visibility toggle.
 * Follows React Native best practices with proper TypeScript types and memoization.
 *
 * @example
 * ```tsx
 * <FormInput
 *   label="Email"
 *   value={email}
 *   onChangeText={setEmail}
 *   error={errors.email}
 *   touched={touched.email}
 *   keyboardType="email-address"
 *   autoComplete="email"
 * />
 * ```
 */
export const FormInput = memo<FormInputProps>(({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  touched = false,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  editable = true,
  leftIcon,
  rightIcon,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  style,
  inputStyle,
  testID,
  ...props
}) => {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isEnabled) => setReduceMotion(isEnabled)
    );
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => subscription.remove();
  }, []);

  const handleFocus = useCallback(() => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : ANIMATION.duration.normal,
      useNativeDriver: false,
    }).start();
  }, [focusAnim, reduceMotion]);

  const handleBlur = useCallback(
    () => {
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : ANIMATION.duration.normal,
        useNativeDriver: false,
      }).start();
      onBlur?.();
    },
    [focusAnim, onBlur]
  );

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error && touched ? colors.error : colors.border,
      error && touched ? colors.error : colors.primary,
    ],
  });

  const showSecureEntry = secureTextEntry && !showPassword;
  const hasError = Boolean(error && touched);

  const styles = StyleSheet.create({
    container: {
      marginBottom: SPACING.base,
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: RADIUS.base,
      borderWidth: BORDER_WIDTH.base,
      paddingHorizontal: SPACING.base,
      minHeight: multiline ? 100 : COMPONENT_SIZE.input.medium,
    },
    leftIconContainer: {
      marginRight: SPACING.md,
    },
    input: {
      flex: 1,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.lg,
      color: colors.text,
      paddingVertical: SPACING.base,
      textAlignVertical: multiline ? 'top' : 'center',
    },
    rightIconContainer: {
      marginLeft: SPACING.md,
    },
    errorText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.error,
      marginTop: SPACING.xs + 2,
      marginLeft: SPACING.xs,
    },
  });

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View style={[styles.inputContainer, { borderColor }]}>
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={showSecureEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          style={[styles.input, inputStyle]}
          accessibilityLabel={label}
          accessibilityHint={placeholder}
          accessibilityState={{ disabled: !editable }}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            hitSlop={{ top: SPACING.sm, bottom: SPACING.sm, left: SPACING.sm, right: SPACING.sm }}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            {showPassword ? (
              <EyeOff size={ICON_SIZE.lg} color={colors.textMuted} />
            ) : (
              <Eye size={ICON_SIZE.lg} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}

        {rightIcon && !secureTextEntry && (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        )}
      </Animated.View>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

FormInput.displayName = 'FormInput';

export default FormInput;
