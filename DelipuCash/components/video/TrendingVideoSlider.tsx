/**
 * TrendingVideoSlider Component
 * A modern horizontal video slider for trending content
 * Industry Standard UX - Inspired by TikTok, YouTube Shorts, Instagram Reels
 * 
 * Features:
 * - Horizontal scroll with snap behavior (like Instagram Stories)
 * - Auto-play preview on focus (muted)
 * - Pagination dots indicator
 * - View count and engagement overlays
 * - Smooth animations and haptic feedback
 * - Accessibility support
 * 
 * @example
 * ```tsx
 * <TrendingVideoSlider
 *   videos={trendingVideos}
 *   onVideoPress={handleVideoSelect}
 * />
 * ```
 */

import React, { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import {
  Play,
  Eye,
  Heart,
  TrendingUp,
  Flame,
  Crown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
  SHADOWS,
} from '@/utils/theme';
import { Video } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { getBestThumbnailUrl, getPlaceholderImage } from '@/utils/thumbnail-utils';
import { useReducedMotion } from '@/utils/accessibility';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Slider card width - Full width with padding */
const SLIDER_WIDTH = SCREEN_WIDTH - SPACING.xl * 2;

/** Slider card height - 16:9 aspect ratio for video */
const SLIDER_HEIGHT = (SLIDER_WIDTH * 9) / 16;

/** Gap between slider items */
const SLIDER_GAP = SPACING.md;

/** Auto-scroll interval in ms */
const AUTO_SCROLL_INTERVAL = 5000;

/** Maximum videos to display */
const MAX_VIDEOS = 8;

// ============================================================================
// TYPES
// ============================================================================

export interface TrendingVideoSliderProps {
  /** Array of trending videos to display */
  videos: Video[];
  /** Callback when a video is pressed */
  onVideoPress: (video: Video) => void;
  /** Callback when like button is pressed */
  onLikePress?: (video: Video) => void;
  /** Whether to auto-scroll through videos */
  autoScroll?: boolean;
  /** Auto-scroll interval in milliseconds */
  autoScrollInterval?: number;
  /** Show ranking badge (1st, 2nd, 3rd, etc.) */
  showRanking?: boolean;
  /** Test ID for testing */
  testID?: string;
}

export interface TrendingVideoCardProps {
  video: Video;
  index: number;
  isActive: boolean;
  showRanking: boolean;
  onPress: () => void;
  onLikePress?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format view count with K/M suffixes
 */
const formatViewCount = (views: number): string => {
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}K`;
  }
  return views.toString();
};

/**
 * Get ranking badge icon and color based on position
 */
const getRankingBadge = (index: number, colors: ReturnType<typeof useTheme>['colors']) => {
  switch (index) {
    case 0:
      return { icon: Crown, color: '#FFD700', label: '#1' }; // Gold
    case 1:
      return { icon: Flame, color: '#C0C0C0', label: '#2' }; // Silver
    case 2:
      return { icon: TrendingUp, color: '#CD7F32', label: '#3' }; // Bronze
    default:
      return { icon: TrendingUp, color: colors.primary, label: `#${index + 1}` };
  }
};

// ============================================================================
// TRENDING VIDEO CARD COMPONENT
// ============================================================================

const TrendingVideoCard = memo<TrendingVideoCardProps>(({
  video,
  index,
  isActive,
  showRanking,
  onPress,
  onLikePress,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const ranking = getRankingBadge(index, colors);

  // Thumbnail state with fallback handling
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(true);

  // Load best available thumbnail
  useEffect(() => {
    const loadThumbnail = async () => {
      setIsLoadingThumbnail(true);
      try {
        if (video.thumbnail) {
          setThumbnailUrl(video.thumbnail);
        } else if (video.videoUrl) {
          const generated = await getBestThumbnailUrl({
            thumbnailUrl: video.thumbnail,
            videoUrl: video.videoUrl,
          });
          setThumbnailUrl(generated || getPlaceholderImage('video'));
        } else {
          setThumbnailUrl(getPlaceholderImage('video'));
        }
      } catch (error) {
        console.error('[TrendingVideoCard] Failed to load thumbnail:', error);
        setThumbnailUrl(getPlaceholderImage('video'));
      } finally {
        setIsLoadingThumbnail(false);
      }
    };

    loadThumbnail();
  }, [video.thumbnail, video.videoUrl]);

  // Scale animation on active state
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1 : 0.95,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isActive, scaleAnim]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  const handleLikePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLikePress?.();
  }, [onLikePress]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: colors.card }]}
        accessibilityLabel={`Play ${video.title}`}
        accessibilityRole="button"
        accessibilityHint="Double tap to play this trending video"
      >
        {/* Video Thumbnail */}
        {isLoadingThumbnail ? (
          <View style={[styles.thumbnail, styles.loadingContainer, { backgroundColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
        <ImageBackground
              source={{ uri: thumbnailUrl || getPlaceholderImage('video') }}
          style={styles.thumbnail}
          imageStyle={styles.thumbnailImage}
          resizeMode="cover"
        >
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.5, 1]}
            style={styles.gradient}
          >
            {/* Ranking Badge */}
            {showRanking && (
              <View style={[styles.rankingBadge, { backgroundColor: ranking.color }]}>
                <ranking.icon size={12} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.rankingText}>{ranking.label}</Text>
              </View>
            )}

            {/* Trending Badge */}
            <View style={[styles.trendingBadge, { backgroundColor: withAlpha(colors.error, 0.9) }]}>
              <TrendingUp size={10} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.trendingText}>TRENDING</Text>
            </View>

            {/* Play Button Overlay */}
            <View style={styles.playButtonContainer}>
              <View style={[styles.playButton, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]}>
                <Play size={28} color={colors.primary} strokeWidth={2} fill={colors.primary} />
              </View>
            </View>

            {/* Video Info Overlay */}
            <View style={styles.videoInfoOverlay}>
              <Text
                style={[styles.videoTitle, { color: '#FFFFFF' }]}
                numberOfLines={2}
              >
                {video.title || 'Untitled Video'}
              </Text>
              
              <View style={styles.videoMeta}>
                <View style={styles.metaItem}>
                  <Eye size={12} color="rgba(255,255,255,0.9)" strokeWidth={2} />
                  <Text style={styles.metaText}>
                    {formatViewCount(video.views || 0)}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.metaItem}
                  onPress={handleLikePress}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Like this video"
                >
                  <Heart
                    size={12}
                    color="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                        fill={'transparent'}
                  />
                  <Text style={styles.metaText}>
                    {formatViewCount(video.likes || 0)}
                  </Text>
                </TouchableOpacity>

                {video.duration && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

TrendingVideoCard.displayName = 'TrendingVideoCard';

// ============================================================================
// PAGINATION DOTS COMPONENT
// ============================================================================

interface PaginationDotsProps {
  total: number;
  activeIndex: number;
}

const PaginationDots = memo<PaginationDotsProps>(({ total, activeIndex }) => {
  const { colors } = useTheme();
  
  return (
    <View style={styles.paginationContainer}>
      {Array.from({ length: total }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.paginationDot,
            {
              backgroundColor: index === activeIndex ? colors.primary : withAlpha(colors.text, 0.2),
              width: index === activeIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
});

PaginationDots.displayName = 'PaginationDots';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function TrendingVideoSliderComponent({
  videos,
  onVideoPress,
  onLikePress,
  autoScroll = false,
  autoScrollInterval = AUTO_SCROLL_INTERVAL,
  showRanking = true,
  testID,
}: TrendingVideoSliderProps): React.ReactElement | null {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduceMotion = useReducedMotion();
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Limit videos to display
  const displayVideos = useMemo(
    () => videos.slice(0, MAX_VIDEOS),
    [videos]
  );

  // Handle scroll events for pagination
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / (SLIDER_WIDTH + SLIDER_GAP));
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < displayVideos.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, displayVideos.length]);

  // Handle scroll start (pause auto-scroll)
  const handleScrollBegin = useCallback(() => {
    setIsUserScrolling(true);
  }, []);

  // Handle scroll end (resume auto-scroll after delay)
  const handleScrollEnd = useCallback(() => {
    setIsUserScrolling(false);
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    if (!autoScroll || isUserScrolling || displayVideos.length <= 1 || reduceMotion) {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      return;
    }

    autoScrollTimerRef.current = setInterval(() => {
      const nextIndex = (activeIndex + 1) % displayVideos.length;
      
      scrollViewRef.current?.scrollTo({
        x: nextIndex * (SLIDER_WIDTH + SLIDER_GAP),
        animated: true,
      });
      
      setActiveIndex(nextIndex);
    }, autoScrollInterval);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [autoScroll, autoScrollInterval, activeIndex, displayVideos.length, isUserScrolling]);

  // Don't render if no videos
  if (!displayVideos.length) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Section Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconContainer, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
            <Flame size={ICON_SIZE.md} color={colors.error} strokeWidth={2} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Trending Now
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {displayVideos.length} hot videos
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.seeAllButton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          accessibilityLabel="See all trending videos"
        >
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Video Slider */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SLIDER_WIDTH + SLIDER_GAP}
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        accessibilityLabel="Trending videos slider"
      >
        {displayVideos.map((video, index) => (
          <TrendingVideoCard
            key={video.id}
            video={video}
            index={index}
            isActive={index === activeIndex}
            showRanking={showRanking}
            onPress={() => onVideoPress(video)}
            onLikePress={() => onLikePress?.(video)}
          />
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <PaginationDots total={displayVideos.length} activeIndex={activeIndex} />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  seeAllButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  seeAllText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    gap: SLIDER_GAP,
  },
  cardContainer: {
    width: SLIDER_WIDTH,
    height: SLIDER_HEIGHT,
    ...SHADOWS.md,
  },
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  thumbnail: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    borderRadius: RADIUS.lg,
  },
  gradient: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  rankingBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  rankingText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  trendingBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    gap: 4,
  },
  trendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  playButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
  },
  videoInfoOverlay: {
    gap: SPACING.xs,
  },
  videoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  videoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginLeft: 'auto',
  },
  durationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.xl,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const TrendingVideoSlider = memo(TrendingVideoSliderComponent);
TrendingVideoSlider.displayName = 'TrendingVideoSlider';

export default TrendingVideoSlider;
