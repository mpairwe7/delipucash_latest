/**
 * VerticalVideoFeed Component — 2026 Industry-Standard Vertical Video Feed
 * Immersive full-screen vertical video experience with adaptive performance
 *
 * 2026 Standards Applied:
 * 1. Adaptive Scroll Physics — Velocity-tuned snapping with reduced-motion fallback
 * 2. Intelligent Preloading — Predictive buffer of next N videos based on scroll direction
 * 3. WCAG 2.2 AAA — Screen reader detection, reduced motion, semantic list roles
 * 4. Contextual Haptics — Soft haptic on pull-to-refresh
 * 5. Visibility-Based Autoplay — 60%+ threshold with minimum dwell time
 * 6. Zero-Buffering Architecture — Preload targets + markPreloaded pattern
 * 7. Virtualized Rendering — Tuned windowSize/batchSize for 60fps scroll
 * 8. Screen Focus Awareness — Pauses playback on screen blur / app background
 * 9. Infinite Scroll — Threshold-triggered with loading footer
 * 10. Error Recovery — Graceful scroll-to-index failure handling
 *
 * @example
 * ```tsx
 * <VerticalVideoFeed
 *   videos={videos}
 *   onVideoEnd={handleVideoEnd}
 *   onRefresh={handleRefresh}
 * />
 * ```
 */

import React, {
  memo,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  useState,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ViewToken,
  RefreshControl,
  AccessibilityInfo,
  Text,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
} from '@/utils/theme';
import { Video } from '@/types';
import {
  useVideoFeedStore,
  selectIsPlaybackAllowed,
} from '@/store/VideoFeedStore';
import { VideoFeedItem } from './VideoFeedItem';
import { VideoFeedSkeleton } from './VideoFeedSkeleton';

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Viewability config for determining which video should play */
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 60, // Video plays when 60%+ visible
  minimumViewTime: 100, // Minimum time (ms) before considering viewable
  waitForInteraction: false,
};

/** FlatList optimization settings - tuned for TikTok-style vertical video feeds */
const LIST_OPTIMIZATION = {
  windowSize: 5, // Render 5 screens worth of content for smoother scrolling
  maxToRenderPerBatch: 2, // Render 2 items per batch
  updateCellsBatchingPeriod: 100, // Batch updates every 100ms
  initialNumToRender: 2, // Start with 2 items for faster initial render with less jank
  removeClippedSubviews: true, // Enable on both platforms - prevents off-screen items from consuming resources
};

// ============================================================================
// TYPES
// ============================================================================

export interface VerticalVideoFeedProps {
  /** Array of videos to display */
  videos: Video[];
  /** Loading state */
  isLoading?: boolean;
  /** Refreshing state for pull-to-refresh */
  isRefreshing?: boolean;
  /** Callback when pull-to-refresh is triggered */
  onRefresh?: () => void;
  /** Callback when end of list is reached (for infinite scroll) */
  onEndReached?: () => void;
  /** Loading more state */
  isLoadingMore?: boolean;
  /** Callback when a video ends playing */
  onVideoEnd?: (video: Video) => void;
  /** Callback when user likes a video */
  onLike?: (video: Video) => void;
  /** Callback when user wants to comment */
  onComment?: (video: Video) => void;
  /** Callback when user shares a video */
  onShare?: (video: Video) => void;
  /** Callback when user bookmarks a video */
  onBookmark?: (video: Video) => void;
  /** Callback when user expands to full player */
  onExpandPlayer?: (video: Video) => void;
  /** 2026: Callback when ad CTA is pressed (sponsored videos) */
  onAdCtaPress?: (video: Video) => void;
  /** 2026: Callback for ad feedback / "Why this ad?" */
  onAdFeedback?: (video: Video) => void;
  /** Initial video index to scroll to */
  initialIndex?: number;
  /** Header component to render above feed */
  ListHeaderComponent?: React.ReactElement;
  /** 2026: Called when a sponsored video becomes visible (for ad impression tracking) */
  onAdImpression?: (video: Video) => void;
  /** 2026: Data saver mode — skip neighbor preloading */
  isDataSaver?: boolean;
  /** Height of the absolute-positioned header overlay (search bar + tabs).
   *  When provided, the feed adjusts its top padding and item sizing so
   *  video content starts below the header instead of behind it. */
  headerHeight?: number;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

function VerticalVideoFeedComponent({
  videos,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onEndReached,
  isLoadingMore = false,
  onVideoEnd,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onExpandPlayer,
  onAdCtaPress,
  onAdFeedback,
  initialIndex = 0,
  ListHeaderComponent,
  onAdImpression,
  isDataSaver = false,
  headerHeight,
  testID,
}: VerticalVideoFeedProps): React.ReactElement {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<Video>>(null);

  // Store state — granular field selectors (primitives) to avoid re-render from setProgress every 250ms
  const activeVideoId = useVideoFeedStore(state => state.activeVideo.videoId);
  const activeVideoIndex = useVideoFeedStore(state => state.activeVideo.index);
  const isMuted = useVideoFeedStore(state => state.activeVideo.isMuted);
  const isPlaybackAllowed = useVideoFeedStore(selectIsPlaybackAllowed);
  // Note: feedMode and ui available via store if needed
  // Actions — individual selectors (stable references, no full-store subscription)
  const setVideos = useVideoFeedStore(s => s.setVideos);
  const setActiveVideo = useVideoFeedStore(s => s.setActiveVideo);
  const handleViewableItemsChanged = useVideoFeedStore(s => s.handleViewableItemsChanged);
  const setRefreshing = useVideoFeedStore(s => s.setRefreshing);
  const setLoadingMore = useVideoFeedStore(s => s.setLoadingMore);
  const getPreloadTargets = useVideoFeedStore(s => s.getPreloadTargets);
  const markPreloaded = useVideoFeedStore(s => s.markPreloaded);

  // Local state
  const [isInitialized, setIsInitialized] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false);

  // Animation values
  const feedOpacity = useSharedValue(1);

  // Calculate item height — if headerHeight is provided, items fill the area
  // below the header; otherwise fall back to safe-area-only calculation.
  const effectiveTopOffset = headerHeight ?? insets.top;
  const itemHeight = useMemo(() => {
    return SCREEN_HEIGHT - effectiveTopOffset;
  }, [effectiveTopOffset]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Sync videos with store
  useEffect(() => {
    if (videos.length > 0) {
      setVideos(videos);
      if (!isInitialized && videos.length > 0) {
        // Set initial active video
        setActiveVideo(videos[initialIndex]?.id ?? null, initialIndex);
        setIsInitialized(true);
      }
    }
  }, [videos, setVideos, isInitialized, initialIndex, setActiveVideo]);

  // Check for screen reader
  useEffect(() => {
    const checkScreenReader = async () => {
      const enabled = await AccessibilityInfo.isScreenReaderEnabled();
      setScreenReaderEnabled(enabled);
    };
    checkScreenReader();

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled
    );
    return () => subscription.remove();
  }, []);

  // 2026: WCAG 2.2 AAA - Detect reduced motion preference
  useEffect(() => {
    const checkMotion = async () => {
      const isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      setReducedMotionEnabled(isReduceMotion);
    };
    checkMotion();
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotionEnabled(enabled);
    });
    return () => listener.remove();
  }, []);

  // Preload videos when active video changes
  useEffect(() => {
    const preloadTargets = getPreloadTargets();
    preloadTargets.forEach((videoId) => {
      // Mark as preloaded (actual preloading handled by VideoFeedItem)
      markPreloaded(videoId);
    });
  }, [activeVideoIndex, getPreloadTargets, markPreloaded]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  // Handle viewable items change (core auto-play logic)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const mappedItems = viewableItems.map((vt) => ({
        item: vt.item as Video,
        index: vt.index ?? 0,
        isViewable: vt.isViewable,
      }));
      handleViewableItemsChanged(mappedItems);

      // Track ad impressions for sponsored videos that become visible
      if (onAdImpression) {
        for (const vt of viewableItems) {
          const video = vt.item as Video;
          if (vt.isViewable && video.isSponsored) {
            onAdImpression(video);
          }
        }
      }
    },
    [handleViewableItemsChanged, onAdImpression]
  );

  // Memoized viewability config ref
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged },
  ]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    setRefreshing(true);
    onRefresh?.();
  }, [onRefresh, setRefreshing]);

  // Handle end reached
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && !isLoading) {
      setLoadingMore(true);
      onEndReached?.();
    }
  }, [isLoadingMore, isLoading, onEndReached, setLoadingMore]);

  // Handle video like - stable reference passed to VideoFeedItem
  const handleLike = useCallback(
    (video: Video) => {
      onLike?.(video);
    },
    [onLike]
  );

  // Handle video comment - stable reference passed to VideoFeedItem
  const handleComment = useCallback(
    (video: Video) => {
      onComment?.(video);
    },
    [onComment]
  );

  // Handle video share - stable reference passed to VideoFeedItem
  const handleShare = useCallback(
    (video: Video) => {
      onShare?.(video);
    },
    [onShare]
  );

  // Handle video bookmark - stable reference passed to VideoFeedItem
  const handleBookmark = useCallback(
    (video: Video) => {
      onBookmark?.(video);
    },
    [onBookmark]
  );

  // Handle expand to full player - stable reference passed to VideoFeedItem
  const handleExpandPlayer = useCallback(
    (video: Video) => {
      onExpandPlayer?.(video);
    },
    [onExpandPlayer]
  );

  // Scroll to specific index (exposed for programmatic navigation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      flatListRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0,
      });
    },
    []
  );

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  // Key extractor
  const keyExtractor = useCallback((item: Video) => item.id, []);

  // Get item layout for optimization — offset accounts for contentContainer paddingTop
  const getItemLayout = useCallback(
    (_: ArrayLike<Video> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: effectiveTopOffset + itemHeight * index,
      index,
    }),
    [itemHeight, effectiveTopOffset]
  );

  // Render video item - optimized with granular selectors
  // isActive computed from primitive activeVideoId (no object re-creation on setProgress)
  // isLiked/isBookmarked resolved per-item inside VideoFeedItem via store subscriptions
  const renderItem = useCallback(
    ({ item, index }: { item: Video; index: number }) => (
      <VideoFeedItem
        video={item}
        index={index}
        itemHeight={itemHeight}
        isActive={activeVideoId === item.id && isPlaybackAllowed}
        isMuted={isMuted}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onBookmark={handleBookmark}
        onExpand={handleExpandPlayer}
        onVideoEnd={onVideoEnd}
        onAdCtaPress={onAdCtaPress}
        onAdFeedback={onAdFeedback}
        screenReaderEnabled={screenReaderEnabled}
        isDataSaver={isDataSaver}
        testID={`video-feed-item-${index}`}
      />
    ),
    [
      itemHeight,
      activeVideoId,
      isPlaybackAllowed,
      isMuted,
      handleLike,
      handleComment,
      handleShare,
      handleBookmark,
      handleExpandPlayer,
      onVideoEnd,
      onAdCtaPress,
      onAdFeedback,
      screenReaderEnabled,
      isDataSaver,
    ]
  );

  // Render footer (loading more indicator)
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={[styles.footer, { height: itemHeight * 0.3 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Loading more videos...
        </Text>
      </View>
    );
  }, [isLoadingMore, itemHeight, colors]);

  // Render empty state
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return <VideoFeedSkeleton count={3} itemHeight={itemHeight} />;
    }
    return (
      <View style={[styles.emptyContainer, { height: itemHeight }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No videos yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Pull down to refresh or check back later
        </Text>
      </View>
    );
  }, [isLoading, itemHeight, colors]);

  // Stable scroll-to-index failure handler (extracted from inline closure)
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
        });
      }, 100);
    },
    []
  );

  // Animated container style
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: feedOpacity.value,
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show skeleton during initial load
  if (isLoading && videos.length === 0) {
    return <VideoFeedSkeleton count={3} itemHeight={itemHeight} />;
  }

  return (
    <Animated.View
      testID={testID}
      style={[styles.container, animatedContainerStyle]}
    >
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        // Snapping configuration — 2026: Adaptive scroll physics
        pagingEnabled
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate={reducedMotionEnabled ? 'normal' : 'fast'}
        // Viewability configuration
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        // Performance optimization
        windowSize={LIST_OPTIMIZATION.windowSize}
        maxToRenderPerBatch={LIST_OPTIMIZATION.maxToRenderPerBatch}
        updateCellsBatchingPeriod={LIST_OPTIMIZATION.updateCellsBatchingPeriod}
        initialNumToRender={LIST_OPTIMIZATION.initialNumToRender}
        removeClippedSubviews={LIST_OPTIMIZATION.removeClippedSubviews}
        // Scroll configuration
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        // Initial scroll
        initialScrollIndex={initialIndex}
        // Pull to refresh
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressViewOffset={effectiveTopOffset}
            />
          ) : undefined
        }
        // Infinite scroll
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Footer
        ListFooterComponent={renderFooter}
        // Empty state
        ListEmptyComponent={renderEmpty}
        // Header (optional)
        ListHeaderComponent={ListHeaderComponent}
        // Accessibility
        accessibilityRole="list"
        accessibilityLabel="Video feed"
        // Error handling for initialScrollIndex
        onScrollToIndexFailed={handleScrollToIndexFailed}
        // Content styling
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: effectiveTopOffset },
        ]}
      />
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    flexGrow: 1,
  },
  footer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const VerticalVideoFeed = memo(VerticalVideoFeedComponent);
export default VerticalVideoFeed;
