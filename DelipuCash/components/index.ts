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
  SearchOverlay,
  ProgressCard,
  ExploreCard,
  Section,
  RecentQuestionCard,
  ExploreModal,
  LeaderboardCard,
} from './cards';
export type {
  StatCardProps,
  SurveyCardProps,
  QuestionCardProps,
  VideoCardProps,
  DailyRewardCardProps,
  SectionHeaderProps,
  SearchBarProps,
  SearchOverlayProps,
  ProgressCardProps,
  ExploreCardProps,
  SectionProps,
  RecentQuestionCardProps,
  ExploreModalProps,
  ExploreFeature,
  LeaderboardCardProps,
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

export { ScreenWrapper, useScreenInsets } from './ui/ScreenWrapper';
export type { ScreenWrapperProps, ScreenVariant } from './ui/ScreenWrapper';

// Video Components
export {
  VideoPlayer,
  VideoPlayerOverlay,
  MiniPlayer,
  VideoActions,
  UploadModal,
  SearchResults,
  TrendingVideoSlider,
  InlineVideoPlayer,
} from './video';
export type {
  VideoPlayerProps,
  VideoPlayerOverlayProps,
  MiniPlayerProps,
  VideoActionsProps,
  UploadModalProps,
  SearchResultsProps,
  TrendingVideoSliderProps,
  InlineVideoPlayerProps,
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

// Support Components
export * from './support';

// Notification Components (detailed)
export * from './notifications';

// Payment Components
export {
  PaymentProviderCard,
  SubscriptionPlanCard,
} from './payment';
export type {
  PaymentProviderCardProps,
  PaymentProvider,
  SubscriptionPlanCardProps,
  SubscriptionPlanType,
  PlanConfig,
} from './payment';

// Ad Components - Industry Standard Ad Placement System
export {
  AdComponent,
  VideoAdComponent,
  StandardAd,
  FeaturedAd,
  BannerAd,
  CompactAd,
  NativeAd,
  CardAd,
  SmartAd,
  // Placement & Transition Components
  AdPlacementWrapper,
  InterstitialAd,
  StickyBanner,
  InFeedAd,
  BetweenContentAd,
  AdCarousel,
} from './ads';
export type {
  AdComponentProps,
  AdVariant,
  AdPlacementType,
  AdPlacementWrapperProps,
  InterstitialAdProps,
  StickyBannerProps,
  InFeedAdProps,
} from './ads';

// Quiz Components
export {
  QuizProgressBar,
  CircularTimer,
  ScoreBadge,
  OptionButton,
  TextInputAnswer,
  AnswerFeedback,
  SessionSummaryCard,
} from './quiz';

// Home Screen Components - 2025/2026 Modern Dashboard
export {
  // Skeleton loaders
  SkeletonBase,
  HeroCardSkeleton,
  QuickActionSkeleton,
  QuickActionsRowSkeleton,
  VideoCardSkeleton,
  VideoListSkeleton,
  SurveyCardSkeleton,
  QuestionCardSkeleton,
  StatCardSkeleton,
  WalletCardSkeleton,
  DashboardSkeleton,
  // Dashboard components
  QuickActions,
  PersonalizedHeader,
  HeroRewardCard,
  EarningOpportunityCard,
  EarningOpportunitiesList,
} from './home';
export type {
  QuickActionsProps,
  QuickAction,
  PersonalizedHeaderProps,
  HeroRewardCardProps,
  EarningOpportunityCardProps,
  EarningOpportunitiesListProps,
  EarningOpportunity,
  OpportunityType,
} from './home';

// Feed Components - Industry Standard Q&A Feed System
export {
  // Core feed components
  QuestionFeedItem,
  FeedTabs,
  // Gamification components
  StreakCounter,
  PointsDisplay,
  DailyProgress,
  LeaderboardSnippet,
  AchievementBadge,
  RewardProgress,
  // Question creation wizard
  CreateQuestionWizard,
  // Skeleton loaders
  QuestionFeedSkeleton,
  GamificationSkeleton,
  FeedTabsSkeleton,
  StatsRowSkeleton,
  ActionCardSkeleton,
  SectionHeaderSkeleton,
  FeedSkeleton,
} from './feed';
export type {
  // Feed types
  QuestionFeedItemProps,
  FeedQuestion,
  QuestionAuthor,
  FeedTabsProps,
  FeedTab,
  // Gamification types
  StreakCounterProps,
  PointsDisplayProps,
  DailyProgressProps,
  LeaderboardSnippetProps,
  LeaderboardUser,
  AchievementBadgeProps,
  RewardProgressProps,
  RewardTier,
  // Wizard types
  CreateQuestionWizardProps,
  QuestionFormData,
  // Skeleton types
  QuestionFeedSkeletonProps,
  GamificationSkeletonProps,
  FeedSkeletonProps,
} from './feed';
