/**
 * Video Component Exports — 2026 Industry-Standard Mobile UI/UX
 * Reusable video components following 2026 design system patterns
 * 
 * 2026 Component Architecture:
 * - VerticalVideoFeed: Adaptive scroll, intelligent preloading, reduced-motion support
 * - VideoFeedItem: Creator economy, content safety, contextual haptics, ambient design
 * - VideoFeedSkeleton: Branded gradient shimmer with content-aware placeholders
 * - EnhancedMiniPlayer: Now-playing waveform, glassmorphism, omnidirectional gestures
 * - VideoCommentsSheet: Pinned comments, creator hearts, reaction emoji, thread preview
 * - VideoPlayer: AI chapters, auto-captions, silence skip, adaptive bitrate, gift/tip
 * 
 * Standards Applied Across All Components:
 * - WCAG 2.2 AAA: 44px touch targets, reduced motion, semantic roles, live regions
 * - Contextual Haptics: Action-specific feedback (Soft/Medium/Rigid/Warning/Success)
 * - Glassmorphism: Frosted glass with depth blur and scrim gradients
 * - Creator Economy: Gift/tip affordances, verified badges, engagement metrics
 * - Content Safety: Sponsored/ad labels, content type indicators
 */

// ============================================================================
// 2026 VIDEO FEED COMPONENTS
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

// Video Options Sheet (More menu — Not Interested, Hide Creator, Report)
export { VideoOptionsSheet } from './VideoOptionsSheet';
export type { VideoOptionsSheetProps, VideoOptionsAction } from './VideoOptionsSheet';

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
export type { UploadModalProps } from './UploadModal';

// Search Components
export { SearchResults } from './SearchResults';
export type { SearchResultsProps } from './SearchResults';

export { CollapsibleSearchBar } from './CollapsibleSearchBar';
export type { CollapsibleSearchBarProps } from './CollapsibleSearchBar';

// Slider Components
export { TrendingVideoSlider } from './TrendingVideoSlider';
export type { TrendingVideoSliderProps } from './TrendingVideoSlider';

// Inline Player Components
export { InlineVideoPlayer } from './InlineVideoPlayer';
export type { InlineVideoPlayerProps } from './InlineVideoPlayer';
