/**
 * Ad Components Index
 * Export all ad-related components for easy imports
 * 
 * Industry Standard Ad Components:
 * - Variant components for different ad formats
 * - Placement wrappers for proper positioning
 * - Transition components for smooth UX
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

// Types
export type { AdComponentProps, AdVariant } from './AdComponent';
export type {
  AdPlacementType,
  AdPlacementWrapperProps,
  InterstitialAdProps,
  StickyBannerProps,
  InFeedAdProps,
} from './AdPlacementWrapper';
