/**
 * Video Component Exports
 * Reusable video-related UI components following design system patterns
 * 
 * New 2025 TikTok/Reels/Shorts Style Components:
 * - VerticalVideoFeed: Full-screen vertical video feed with snap-to-video
 * - VideoFeedItem: Individual video item with gestures and overlays
 * - VideoFeedSkeleton: Loading skeleton for feed
 * - EnhancedMiniPlayer: Floating mini player with gestures
 * - VideoCommentsSheet: Bottom sheet for comments
 */

// ============================================================================
// NEW 2025 VIDEO FEED COMPONENTS (TikTok/Reels/Shorts Style)
// ============================================================================

// Vertical Video Feed (Main Feed Component)
export { VerticalVideoFeed } from './VerticalVideoFeed';
export type { VerticalVideoFeedProps } from './VerticalVideoFeed';

// Video Feed Item (Individual Video Card)
export { VideoFeedItem } from './VideoFeedItem';
export type { VideoFeedItemProps } from './VideoFeedItem';

// Video Feed Skeleton (Loading State)
export { VideoFeedSkeleton } from './VideoFeedSkeleton';
export type { VideoFeedSkeletonProps } from './VideoFeedSkeleton';

// Enhanced Mini Player (Gesturable Floating Player)
export { EnhancedMiniPlayer } from './EnhancedMiniPlayer';
export type { EnhancedMiniPlayerProps } from './EnhancedMiniPlayer';

// Video Comments Sheet (Bottom Sheet)
export { VideoCommentsSheet } from './VideoCommentsSheet';
export type { VideoCommentsSheetProps } from './VideoCommentsSheet';

// Video Error Boundary (Crash isolation for video components)
export { VideoErrorBoundary } from './VideoErrorBoundary';

// ============================================================================
// LEGACY PLAYER COMPONENTS (Backward Compatibility)
// ============================================================================

// Player Components
export { VideoPlayer } from './VideoPlayer';
export type { VideoPlayerProps } from './VideoPlayer';

export { VideoPlayerOverlay } from './VideoPlayerOverlay';
export type { VideoPlayerOverlayProps } from './VideoPlayerOverlay';

export { MiniPlayer } from './MiniPlayer';
export type { MiniPlayerProps } from './MiniPlayer';

// Action Components
export { VideoActions } from './VideoActions';
export type { VideoActionsProps } from './VideoActions';

// Comments Components
export { VideoComments } from './VideoComments';
export type { VideoCommentsProps } from './VideoComments';

// Modal Components
export { UploadModal } from './UploadModal';
export type { UploadModalProps, UploadFormData } from './UploadModal';

// Search Components
export { SearchResults } from './SearchResults';
export type { SearchResultsProps } from './SearchResults';

// Slider Components
export { TrendingVideoSlider } from './TrendingVideoSlider';
export type { TrendingVideoSliderProps } from './TrendingVideoSlider';

// Inline Player Components
export { InlineVideoPlayer } from './InlineVideoPlayer';
export type { InlineVideoPlayerProps } from './InlineVideoPlayer';
