/**
 * Videos Screen - 2025 TikTok/Instagram Reels/YouTube Shorts Style
 * Modern vertical video feed with industry-standard UX patterns
 * 
 * Features:
 * - Full-screen vertical video feed with snap-to-video
 * - Single video plays at a time (visibility-based auto-play)
 * - Double-tap to like with heart animation burst
 * - Long-press for context menu / expand
 * - Swipe gestures for navigation
 * - Bottom sheet comments
 * - Mini player when navigating away
 * - Grid mode toggle for discovery
 * - For You / Following / Trending tabs
 * - Accessibility support (WCAG 2.1 AA)
 * 
 * Architecture:
 * - VideoFeedStore: Client-side UI state (Zustand)
 * - TanStack Query: Server state (data fetching, caching)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Href } from 'expo-router';
import {
  Wifi,
  Upload,
  Camera,
  LayoutGrid,
  Play,
  Search,
  Bell,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  withAlpha,
  ICON_SIZE,
  Z_INDEX,
} from '@/utils/theme';
import {
  useVideos,
  useTrendingVideos,
  useLikeVideo,
  useUnlikeVideo,
  useBookmarkVideo,
  useShareVideo,
  useUnreadCount,
} from '@/services/hooks';
import {
  VerticalVideoFeed,
  VideoPlayer,
  EnhancedMiniPlayer,
  VideoCommentsSheet,
  UploadModal,
} from '@/components/video';
import { LiveStreamScreen } from '@/components/livestream';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { Video } from '@/types';
import {
  useVideoFeedStore,
  selectActiveVideo,
  selectFeedMode,
  selectUI,
  selectLikedVideoIds,
} from '@/store/VideoFeedStore';

// ============================================================================
// CONSTANTS
// ============================================================================

// Screen dimensions (available for responsive layout calculations)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _screenDimensions = Dimensions.get('window');

type FeedTab = 'for-you' | 'following' | 'trending';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VideosScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // ============================================================================
  // STORE STATE
  // ============================================================================

  const activeVideo = useVideoFeedStore(selectActiveVideo);
  const feedMode = useVideoFeedStore(selectFeedMode);
  const ui = useVideoFeedStore(selectUI);
  const likedVideoIds = useVideoFeedStore(selectLikedVideoIds);
  // bookmarkedVideoIds available via: useVideoFeedStore(selectBookmarkedVideoIds)

  const {
    setFeedMode,
    toggleLike,
    toggleBookmark,
    openComments,
    closeComments,
    openFullPlayer,
    closeFullPlayer,
    closeMiniPlayer,
    expandMiniPlayer,
    setRefreshing,
    setLoadingMore,
    getVideoById,
  } = useVideoFeedStore();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [liveStreamVisible, setLiveStreamVisible] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);

  // ============================================================================
  // DATA HOOKS
  // ============================================================================

  const { data: videosData, isLoading, refetch, isFetching } = useVideos({ limit: 30 });
  const { data: trendingVideos } = useTrendingVideos(20);
  const { data: unreadCount } = useUnreadCount();
  const { mutate: likeVideo } = useLikeVideo();
  const { mutate: unlikeVideo } = useUnlikeVideo();
  const { mutate: bookmarkVideo } = useBookmarkVideo();
  const { mutate: shareVideo } = useShareVideo();

  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  const videos = useMemo(() => {
    switch (activeTab) {
      case 'trending':
        return trendingVideos || [];
      case 'following':
        // Filter to followed creators (mock for now)
        return (videosData?.videos || []).filter(v => v.likes > 100);
      case 'for-you':
      default:
        return videosData?.videos || [];
    }
  }, [videosData?.videos, trendingVideos, activeTab]);

  // Get current video data from store
  const currentVideoData = useMemo(() => {
    if (ui.miniPlayerVideoId) {
      return getVideoById(ui.miniPlayerVideoId);
    }
    if (ui.fullPlayerVideoId) {
      return getVideoById(ui.fullPlayerVideoId);
    }
    return undefined;
  }, [ui.miniPlayerVideoId, ui.fullPlayerVideoId, getVideoById]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch, setRefreshing]);

  const handleEndReached = useCallback(() => {
    // Implement pagination when API supports it
    setLoadingMore(false);
  }, [setLoadingMore]);

  const handleLike = useCallback((video: Video) => {
    const isCurrentlyLiked = likedVideoIds.has(video.id);
    toggleLike(video.id);
    
    if (isCurrentlyLiked) {
      unlikeVideo(video.id);
    } else {
      likeVideo(video.id);
    }
  }, [likedVideoIds, toggleLike, likeVideo, unlikeVideo]);

  const handleComment = useCallback((video: Video) => {
    openComments(video.id);
  }, [openComments]);

  const handleShare = useCallback(async (video: Video) => {
    try {
      const result = await Share.share({
        message: `Check out this video: ${video.title}\n${video.videoUrl}`,
        title: video.title || 'Shared Video',
      });
      
      if (result.action === Share.sharedAction) {
        let platform: 'copy' | 'twitter' | 'facebook' | 'whatsapp' | 'instagram' | 'telegram' | 'email' | 'sms' | 'other' = 'other';
        const activityType = result.activityType?.toLowerCase() || '';
        
        if (activityType.includes('copy')) platform = 'copy';
        else if (activityType.includes('twitter')) platform = 'twitter';
        else if (activityType.includes('facebook')) platform = 'facebook';
        else if (activityType.includes('whatsapp')) platform = 'whatsapp';
        
        shareVideo({ videoId: video.id, platform });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [shareVideo]);

  const handleBookmark = useCallback((video: Video) => {
    toggleBookmark(video.id);
    bookmarkVideo(video.id);
  }, [toggleBookmark, bookmarkVideo]);

  const handleExpandPlayer = useCallback((video: Video) => {
    openFullPlayer(video.id);
  }, [openFullPlayer]);

  const handleVideoEnd = useCallback((video: Video) => {
    // Auto-advance to next video is handled by the feed
    console.log('Video ended:', video.title);
  }, []);

  const handleTabChange = useCallback((tab: FeedTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const toggleViewMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFeedMode(feedMode === 'vertical' ? 'grid' : 'vertical');
  }, [feedMode, setFeedMode]);

  const openLiveStream = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiveStreamVisible(true);
  }, []);

  const closeLiveStream = useCallback(() => {
    setLiveStreamVisible(false);
  }, []);

  // ============================================================================
  // FAB ACTIONS
  // ============================================================================

  const fabActions = useMemo(() => [
    {
      icon: <Wifi size={20} color="#FFFFFF" />,
      label: 'Go Live',
      onPress: () => {
        setFabExpanded(false);
        openLiveStream();
      },
      color: colors.error,
    },
    {
      icon: <Camera size={20} color="#FFFFFF" />,
      label: 'Record',
      onPress: () => {
        setFabExpanded(false);
        openLiveStream();
      },
      color: colors.warning,
    },
    {
      icon: <Upload size={20} color="#FFFFFF" />,
      label: 'Upload',
      onPress: () => {
        setFabExpanded(false);
        setUploadModalVisible(true);
      },
      color: colors.primary,
    },
  ], [colors, openLiveStream]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />

      {/* Floating Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.sm,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Left: Search */}
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: withAlpha('#000000', 0.5) }]}
          onPress={() => router.push('/search' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Search videos"
        >
          <Search size={ICON_SIZE.lg} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Center: Tab Chips */}
        <View style={styles.tabContainer}>
          {(['following', 'for-you', 'trending'] as FeedTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabChip,
                activeTab === tab && styles.tabChipActive,
              ]}
              onPress={() => handleTabChange(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
              accessibilityLabel={`${tab.replace('-', ' ')} tab`}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === 'for-you' ? 'For You' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Right: Actions */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: withAlpha('#000000', 0.5) }]}
            onPress={toggleViewMode}
            accessibilityRole="button"
            accessibilityLabel={feedMode === 'vertical' ? 'Switch to grid view' : 'Switch to vertical feed'}
          >
            {feedMode === 'vertical' ? (
              <LayoutGrid size={ICON_SIZE.md} color="#FFFFFF" />
            ) : (
              <Play size={ICON_SIZE.md} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: withAlpha('#000000', 0.5) }]}
            onPress={() => router.push('/notifications' as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadCount || 0} unread`}
          >
            <Bell size={ICON_SIZE.md} color="#FFFFFF" />
            {(unreadCount ?? 0) > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>
                  {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Video Feed */}
      <VerticalVideoFeed
        videos={videos}
        isLoading={isLoading}
        isRefreshing={isFetching}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onBookmark={handleBookmark}
        onExpandPlayer={handleExpandPlayer}
        onVideoEnd={handleVideoEnd}
        testID="video-feed"
      />

      {/* Full Screen Video Player */}
      {ui.showFullPlayer && currentVideoData && (
        <VideoPlayer
          videoSource={currentVideoData.videoUrl}
          videoDetails={currentVideoData}
          onClose={closeFullPlayer}
          onLike={() => handleLike(currentVideoData)}
          onShare={() => handleShare(currentVideoData)}
          isLiked={likedVideoIds.has(currentVideoData.id)}
          autoPlay={true}
          loop={false}
          testID="full-video-player"
        />
      )}

      {/* Mini Player */}
      {ui.showMiniPlayer && currentVideoData && (
        <EnhancedMiniPlayer
          video={currentVideoData}
          isPlaying={activeVideo.status === 'playing'}
          progress={activeVideo.progress}
          onPlayPause={() => {
            // Toggle play/pause through store
          }}
          onClose={closeMiniPlayer}
          onExpand={expandMiniPlayer}
          bottomOffset={insets.bottom + SPACING.xl}
          testID="mini-player"
        />
      )}

      {/* Comments Sheet */}
      <VideoCommentsSheet
        visible={ui.showComments}
        videoId={ui.commentsVideoId || ''}
        onClose={closeComments}
        testID="comments-sheet"
      />

      {/* Floating Action Button */}
      <FloatingActionButton
        actions={fabActions}
        position="bottom-right"
        bottomOffset={insets.bottom + SPACING.xl}
        onExpandedChange={setFabExpanded}
        defaultExpanded={fabExpanded}
      />

      {/* Upload Modal */}
      <UploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
      />

      {/* LiveStream Screen */}
      {liveStreamVisible && (
        <LiveStreamScreen
          visible={liveStreamVisible}
          onClose={closeLiveStream}
          onVideoUploaded={() => {
            refetch();
          }}
          asModal={true}
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    zIndex: Z_INDEX.sticky,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  tabChip: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  tabChipActive: {
    // Active styling handled by text and indicator
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: withAlpha('#FFFFFF', 0.6),
  },
  tabTextActive: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
  tabIndicator: {
    width: 24,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
    marginTop: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
});
