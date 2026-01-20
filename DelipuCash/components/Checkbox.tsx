import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/utils/theme';

/**
 * Props for the Checkbox component
 */
export interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when checkbox is pressed */
  onPress: () => void;
  /** Label text or custom element */
  label?: string | React.ReactNode;
  /** Error message to display */
  error?: string | null;
  /** Whether the field has been touched/visited */
  touched?: boolean;
  /** Disables the checkbox */
  disabled?: boolean;
  /** Container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

const CHECKBOX_SIZE = 24;
const CHECKBOX_BORDER_RADIUS = 6;
const CHECK_ICON_SIZE = 16;

/**
 * Accessible checkbox component for forms with support for custom labels.
 * Follows React Native accessibility guidelines.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   checked={acceptTerms}
 *   onPress={() => setAcceptTerms(!acceptTerms)}
 *   label="I accept the terms and conditions"
 *   error={errors.acceptTerms}
 *   touched={touched.acceptTerms}
 * />
 * ```
 */
export const Checkbox = memo<CheckboxProps>(({
  checked,
  onPress,
  label,
  error,
  touched = false,
  disabled = false,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const hasError = Boolean(error && touched);

  const getBorderColor = useCallback(() => {
    if (hasError) return colors.error;
    if (checked) return colors.primary;
    return colors.border;
  }, [hasError, checked, colors]);

  const styles = StyleSheet.create({
    container: {},
    touchable: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    checkbox: {
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      borderRadius: CHECKBOX_BORDER_RADIUS,
      borderWidth: 2,
      borderColor: getBorderColor(),
      backgroundColor: checked ? colors.primary : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    labelContainer: {
      flex: 1,
    },
    labelText: {
      fontFamily: 'Roboto_400Regular',
      fontSize: 14,
      color: disabled ? colors.textDisabled : colors.text,
      lineHeight: 20,
    },
    errorText: {
      fontFamily: 'Roboto_400Regular',
      fontSize: 12,
      color: colors.error,
      marginTop: 6,
      marginLeft: 36,
    },
  });

  const renderLabel = () => {
    if (!label) return null;

    if (typeof label === 'string') {
      return <Text style={styles.labelText}>{label}</Text>;
    }

    return label;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={styles.touchable}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={typeof label === 'string' ? label : undefined}
      >
        <View style={styles.checkbox}>
          {checked && <Check size={CHECK_ICON_SIZE} color="#FFFFFF" strokeWidth={3} />}
        </View>

        {label && <View style={styles.labelContainer}>{renderLabel()}</View>}
      </TouchableOpacity>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
