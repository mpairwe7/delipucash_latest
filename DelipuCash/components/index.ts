/**
 * Component exports for the mobile application
 * All components follow React Native best practices with TypeScript
 */

// Form Components
export { FormInput } from './FormInput';
export type { FormInputProps } from './FormInput';

export { PhoneInput, COUNTRY_CODES } from './PhoneInput';
export type { PhoneInputProps, CountryCode } from './PhoneInput';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

// Button Components
export { PrimaryButton } from './PrimaryButton';
export type { PrimaryButtonProps, ButtonVariant, ButtonSize } from './PrimaryButton';

// Notification Components
export { NotificationBell } from './NotificationBell';
export type { NotificationBellProps } from './NotificationBell';

// Feedback Components
export { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
export type {
  PasswordStrengthIndicatorProps,
  PasswordStrength,
  PasswordChecks,
  StrengthLevel,
  StrengthLabel,
} from './PasswordStrengthIndicator';

// Layout Components
export { KeyboardAvoidingAnimatedView } from './KeyboardAvoidingAnimatedView';
export type {
  KeyboardAvoidingAnimatedViewProps,
  KeyboardBehavior,
} from './KeyboardAvoidingAnimatedView';

// Card Components
export {
  StatCard,
  SurveyCard,
  QuestionCard,
  VideoCard,
  DailyRewardCard,
  SectionHeader,
  SearchBar,
  ProgressCard,
} from './cards';
export type {
  StatCardProps,
  SurveyCardProps,
  QuestionCardProps,
  VideoCardProps,
  DailyRewardCardProps,
  SectionHeaderProps,
  SearchBarProps,
  ProgressCardProps,
} from './cards';
