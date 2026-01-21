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

// Modal Components
export { UploadRewardQuestionModal } from './UploadRewardQuestionModal';
export { default as SurveyForm } from './SurveyForm';

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

// UI Components
export { IconButton } from './ui/IconButton';
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from './ui/IconButton';

export { ProgressBar } from './ui/ProgressBar';
export type { ProgressBarProps, ProgressBarSize } from './ui/ProgressBar';

export { FloatingActionButton } from './ui/FloatingActionButton';
export type {
  FloatingActionButtonProps,
  FABAction,
  FABPosition,
} from './ui/FloatingActionButton';

// Video Components
export {
  VideoPlayerOverlay,
  MiniPlayer,
  VideoActions,
  UploadModal,
  SearchResults,
} from './video';
export type {
  VideoPlayerOverlayProps,
  MiniPlayerProps,
  VideoActionsProps,
  UploadModalProps,
  UploadFormData,
  SearchResultsProps,
} from './video';

// LiveStream Components
export {
  LiveStreamScreen,
  CameraControls,
  CameraControlButton,
  BottomControls,
  RecordButton,
  RecordingTimer,
  RecordingProgressBar,
  PermissionPrompt,
  GradientOverlay,
} from './livestream';
export type {
  LiveStreamScreenProps,
  RecordedVideo,
  CameraControlsProps,
  CameraControlButtonProps,
  BottomControlsProps,
  RecordButtonProps,
  RecordingTimerProps,
  RecordingProgressBarProps,
  PermissionPromptProps,
  GradientOverlayProps,
} from './livestream';

