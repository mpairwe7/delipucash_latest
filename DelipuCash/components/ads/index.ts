/**
 * Ad Components Index
 * Export all ad-related components for easy imports
 * 
 * Industry Standard Ad Components (2024-2025):
 * - Variant components for different ad formats
 * - Placement wrappers for proper positioning
 * - Transition components for smooth UX
 * - Native ad components for seamless integration
 * - Video ad components with skip functionality
 * - Feedback and transparency modals
 * - Preview components for ad creation
 */

// Main Components
export { default as AdComponent } from './AdComponent';
export { default as VideoAdComponent } from './VideoAdComponent';

// Variant Components
export {
  StandardAd,
  FeaturedAd,
  BannerAd,
  CompactAd,
  NativeAd,
  CardAd,
  SmartAd,
} from './AdComponent';

// Placement & Transition Components
export {
  AdPlacementWrapper,
  InterstitialAd,
  StickyBanner,
  InFeedAd,
  BetweenContentAd,
  AdCarousel,
} from './AdPlacementWrapper';

// New Industry-Standard Components
export { NativeQuestionAd } from './NativeQuestionAd';
export { SkippableVideoAd } from './SkippableVideoAd';
export { AdFeedbackModal } from './AdFeedbackModal';
export { AdPreviewCard } from './AdPreviewCard';

// Types
export type { AdComponentProps, AdVariant } from './AdComponent';
export type {
  AdPlacementType,
  AdPlacementWrapperProps,
  InterstitialAdProps,
  StickyBannerProps,
  InFeedAdProps,
} from './AdPlacementWrapper';
export type { NativeQuestionAdProps } from './NativeQuestionAd';
export type { SkippableVideoAdProps } from './SkippableVideoAd';
export type { AdFeedbackModalProps, FeedbackType, AdFeedbackResult } from './AdFeedbackModal';
export type { AdPreviewCardProps, PreviewVariant, AdPreviewData } from './AdPreviewCard';
