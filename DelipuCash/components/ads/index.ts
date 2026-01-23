/**
 * Ad Components Index
 * Export all ad-related components for easy imports
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

// Types
export type { AdComponentProps, AdVariant } from './AdComponent';
