/**
 * Feed Components Index
 * 
 * Central export for all feed-related components.
 * These components provide industry-standard UX for Q&A and reward-based apps.
 */

// Core feed item component
export { 
  QuestionFeedItem, 
  type QuestionFeedItemProps,
  type FeedQuestion,
  type QuestionAuthor,
} from "./QuestionFeedItem";

// Feed navigation tabs
export { 
  FeedTabs, 
  type FeedTabsProps,
  type FeedTab,
} from "./FeedTabs";

// Gamification components
export {
  StreakCounter,
  PointsDisplay,
  DailyProgress,
  LeaderboardSnippet,
  AchievementBadge,
  RewardProgress,
  type StreakCounterProps,
  type PointsDisplayProps,
  type DailyProgressProps,
  type LeaderboardSnippetProps,
  type LeaderboardUser,
  type AchievementBadgeProps,
  type RewardProgressProps,
  type RewardTier,
} from "./GamificationComponents";

// Question creation wizard
export {
  CreateQuestionWizard,
  type CreateQuestionWizardProps,
  type QuestionFormData,
} from "./CreateQuestionWizard";

// Skeleton loaders
export {
  QuestionFeedSkeleton,
  GamificationSkeleton,
  FeedTabsSkeleton,
  StatsRowSkeleton,
  ActionCardSkeleton,
  SectionHeaderSkeleton,
  FeedSkeleton,
  type QuestionFeedSkeletonProps,
  type GamificationSkeletonProps,
  type FeedSkeletonProps,
} from "./SkeletonLoaders";
