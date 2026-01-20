import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type ThemeColors } from '@/utils/theme';

/**
 * Password strength levels
 */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Password strength labels
 */
export type StrengthLabel = '' | 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Excellent';

/**
 * Password requirements check results
 */
export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  special: boolean;
}

/**
 * Password strength analysis result
 */
export interface PasswordStrength {
  level: StrengthLevel;
  label: StrengthLabel;
  color: string;
  checks?: PasswordChecks;
}

/**
 * Props for the PasswordStrengthIndicator component
 */
export interface PasswordStrengthIndicatorProps {
  /** Password to analyze */
  password: string;
  /** Show detailed requirements list */
  showRequirements?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Props for the PasswordRequirement component
 */
interface PasswordRequirementProps {
  met: boolean;
  text: string;
  colors: {
    success: string;
    textMuted: string;
  };
}

const STRENGTH_LEVELS = [1, 2, 3, 4, 5] as const;
const STRENGTH_BAR_HEIGHT = 4;
const REQUIREMENT_DOT_SIZE = 6;

/**
 * Individual password requirement indicator
 */
const PasswordRequirement = memo<PasswordRequirementProps>(({ met, text, colors }) => (
  <View style={requirementStyles.container}>
    <View
      style={[
        requirementStyles.dot,
        { backgroundColor: met ? colors.success : colors.textMuted },
      ]}
    />
    <Text
      style={[
        requirementStyles.text,
        { color: met ? colors.success : colors.textMuted },
      ]}
    >
      {text}
    </Text>
  </View>
));

PasswordRequirement.displayName = 'PasswordRequirement';

const requirementStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: REQUIREMENT_DOT_SIZE,
    height: REQUIREMENT_DOT_SIZE,
    borderRadius: REQUIREMENT_DOT_SIZE / 2,
    marginRight: 8,
  },
  text: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
  },
});

/**
 * Analyzes password strength based on multiple criteria.
 */
const analyzePassword = (password: string, colors: ThemeColors): PasswordStrength => {
  if (!password) {
    return { level: 0, label: '', color: colors.border };
  }

  const checks: PasswordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 1) {
    return { level: 1, label: 'Weak', color: colors.error, checks };
  }
  if (score <= 2) {
    return { level: 2, label: 'Fair', color: colors.warning, checks };
  }
  if (score <= 3) {
    return { level: 3, label: 'Good', color: '#FFA500', checks };
  }
  if (score <= 4) {
    return { level: 4, label: 'Strong', color: colors.success, checks };
  }
  return { level: 5, label: 'Excellent', color: colors.success, checks };
};

/**
 * Password strength indicator with visual bars and requirement checklist.
 * Provides real-time feedback on password strength.
 *
 * @example
 * ```tsx
 * <PasswordStrengthIndicator
 *   password={password}
 *   showRequirements={true}
 * />
 * ```
 */
export const PasswordStrengthIndicator = memo<PasswordStrengthIndicatorProps>(({
  password,
  showRequirements = true,
  testID,
}) => {
  const { colors } = useTheme();

  const strength = useMemo(
    () => analyzePassword(password, colors),
    [password, colors]
  );

  if (!password) return null;

  const styles = StyleSheet.create({
    container: {
      marginTop: -8,
      marginBottom: 16,
    },
    barsContainer: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 8,
    },
    bar: {
      flex: 1,
      height: STRENGTH_BAR_HEIGHT,
      borderRadius: STRENGTH_BAR_HEIGHT / 2,
    },
    labelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      fontFamily: 'Roboto_500Medium',
      fontSize: 12,
      color: strength.color,
    },
    requirementsContainer: {
      marginTop: 12,
      gap: 6,
    },
  });

  return (
    <View style={styles.container} testID={testID}>
      {/* Strength bars */}
      <View style={styles.barsContainer}>
        {STRENGTH_LEVELS.map((level) => (
          <View
            key={level}
            style={[
              styles.bar,
              {
                backgroundColor:
                  level <= strength.level ? strength.color : colors.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Strength label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label} accessibilityLabel={`Password strength: ${strength.label}`}>
          {strength.label}
        </Text>
      </View>

      {/* Password requirements */}
      {showRequirements && strength.checks && (
        <View style={styles.requirementsContainer}>
          <PasswordRequirement
            met={strength.checks.length}
            text="At least 8 characters"
            colors={colors}
          />
          <PasswordRequirement
            met={strength.checks.lowercase && strength.checks.uppercase}
            text="Upper & lowercase letters"
            colors={colors}
          />
          <PasswordRequirement
            met={strength.checks.numbers}
            text="At least one number"
            colors={colors}
          />
          <PasswordRequirement
            met={strength.checks.special}
            text="At least one special character"
            colors={colors}
          />
        </View>
      )}
    </View>
  );
});

PasswordStrengthIndicator.displayName = 'PasswordStrengthIndicator';

export default PasswordStrengthIndicator;
