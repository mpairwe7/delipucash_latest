/**
 * Home Screen Components
 * Modern, accessible, high-conversion dashboard components
 * 
 * Design: TikTok + Cash App + Duolingo inspired
 * Accessibility: WCAG 2.2 AA compliant
 */

// Skeleton loaders for smooth loading states
export {
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
} from './SkeletonLoader';

// Quick action buttons
export { QuickActions } from './QuickActions';
export type { QuickActionsProps, QuickAction } from './QuickActions';

// Personalized header with streak ring
export { PersonalizedHeader } from './PersonalizedHeader';
export type { PersonalizedHeaderProps } from './PersonalizedHeader';

// Hero reward card
export { HeroRewardCard } from './HeroRewardCard';
export type { HeroRewardCardProps } from './HeroRewardCard';

// Earning opportunity cards
export {
  EarningOpportunityCard,
  EarningOpportunitiesList,
} from './EarningOpportunityCard';
export type {
  EarningOpportunityCardProps,
  EarningOpportunitiesListProps,
  EarningOpportunity,
  OpportunityType,
} from './EarningOpportunityCard';
