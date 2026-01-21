/**
 * Videos Screen - Using Design System Reusable Components
 * Clean implementation with proper component composition
 * Includes LiveStream functionality inspired by TikTok/Instagram
 */

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Dimensions,
  Share,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Href } from "expo-router";
import {
  Wifi,
  Upload,
  PenSquare,
  Flame,
  Sparkles,
  Heart,
  ShieldCheck,
  BadgeDollarSign,
  Megaphone,
  X,
  Search,
  Filter,
  Eye,
  TrendingUp,
  Video as VideoIcon,
  Camera,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
  Z_INDEX,
} from "@/utils/theme";
import {
  useTrendingVideos,
  useVideos,
  useLikeVideo,
  useUserStats,
  useUnreadCount,
} from "@/services/hooks";
import {
  VideoCard,
  SectionHeader,
  PrimaryButton,
  StatCard,
  NotificationBell,
  VideoPlayerOverlay,
  MiniPlayer,
  VideoActions,
  UploadModal,
  SearchResults,
  FloatingActionButton,
  LiveStreamScreen,
} from "@/components";
import type { RecordedVideo } from "@/components";
import { mockAds } from "@/data/mockData";
import { Video } from "@/types";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isTablet = SCREEN_WIDTH >= 768;

const getResponsiveValue = (small: number, medium: number, large: number) => {
  if (isTablet) return large;
  if (SCREEN_WIDTH < 375) return small;
  return medium;
};

// ============================================================================
// MAIN VIDEOS SCREEN
// ============================================================================

export default function VideosScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [liveStreamVisible, setLiveStreamVisible] = useState(false);

  // Player State
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  // Data Hooks
  const { data: videosData, isLoading, refetch } = useVideos({ limit: 30 });
  const { data: trendingVideos } = useTrendingVideos(8);
  const { data: userStats } = useUserStats();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: likeVideo } = useLikeVideo();

  // Memoized Data
  const videos = useMemo(() => videosData?.videos ?? [], [videosData?.videos]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const lower = searchQuery.toLowerCase();
    return videos.filter(
      (video) =>
        (video.title || "").toLowerCase().includes(lower) ||
        (video.description || "").toLowerCase().includes(lower)
    );
  }, [videos, searchQuery]);

  const liveVideos = useMemo(
    () => videos.filter((video) =>
      video.videoUrl?.includes(".m3u8") || video.videoUrl?.includes("live")
    ),
    [videos]
  );

  const popularVideos = useMemo(
    () => [...videos].sort((a, b) => b.views - a.views).slice(0, 6),
    [videos]
  );

  const sponsoredVideos = useMemo(
    () => mockAds.filter((ad) => ad.sponsored).slice(0, 3),
    []
  );

  const totalLikes = useMemo(
    () => videos.reduce((sum, video) => sum + (video.likes || 0), 0),
    [videos]
  );

  // Handlers
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLike = useCallback(
    (videoId: string): void => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      likeVideo(videoId);
    },
    [likeVideo]
  );

  const handleComment = useCallback((video: Video): void => {
    router.push(`/question-comments/${video.id}` as Href);
  }, []);

  const handleShare = useCallback(async (video: Video): Promise<void> => {
    try {
      await Share.share({
        message: `Check out this video: ${video.title}\n${video.videoUrl}`,
        title: video.title || "Shared Video",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  }, []);

  const handleBookmark = useCallback((video: Video): void => {
    Alert.alert(
      "Bookmark",
      video.isBookmarked ? "Removed from bookmarks" : "Added to bookmarks"
    );
  }, []);

  const handleVideoSelect = useCallback((video: Video): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentVideo(video);
    setIsPlaying(true);
    setShowControls(true);
    setShowMiniPlayer(false);
    setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setShowSearchResults(false);
  }, []);

  const closePlayer = useCallback(() => {
    if (currentVideo) {
      setShowMiniPlayer(true);
    }
    setCurrentVideo(null);
    setIsPlaying(false);
    setProgress(0);
  }, [currentVideo]);

  const closeMiniPlayer = useCallback(() => {
    setShowMiniPlayer(false);
    setCurrentVideo(null);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const expandMiniPlayer = useCallback(() => {
    setShowMiniPlayer(false);
    setShowControls(true);
  }, []);

  // LiveStream Handlers
  const openLiveStream = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiveStreamVisible(true);
  }, []);

  const closeLiveStream = useCallback(() => {
    setLiveStreamVisible(false);
  }, []);

  const handleVideoUploaded = useCallback((videoData: RecordedVideo) => {
    console.log("Video uploaded:", videoData);
    // Refresh videos list after upload
    refetch();
  }, [refetch]);

  // FAB Actions
  const fabActions = useMemo(() => [
    {
      icon: <Wifi size={20} color="#FFFFFF" />,
      label: "Go Live",
      onPress: () => {
        setFabExpanded(false);
        openLiveStream();
      },
      color: colors.error,
    },
    {
      icon: <Camera size={20} color="#FFFFFF" />,
      label: "Record",
      onPress: () => {
        setFabExpanded(false);
        openLiveStream();
      },
      color: colors.warning,
    },
    {
      icon: <Upload size={20} color="#FFFFFF" />,
      label: "Upload",
      onPress: () => {
        setFabExpanded(false);
        setUploadModalVisible(true);
      },
      color: colors.primary,
    },
    {
      icon: <PenSquare size={20} color="#FFFFFF" />,
      label: "Create Post",
      onPress: () => {
        setFabExpanded(false);
        Alert.alert("Create Post", "Post creation coming soon!");
      },
      color: colors.info,
    },
  ], [colors, openLiveStream]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.sm,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <VideoIcon size={ICON_SIZE["2xl"]} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Videos</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
            <TouchableOpacity
              style={[styles.liveButton, { backgroundColor: withAlpha(colors.error, 0.12) }]}
              accessibilityRole="button"
              accessibilityLabel="Go live"
              onPress={openLiveStream}
            >
              <Wifi size={ICON_SIZE.md} color={colors.error} strokeWidth={2} />
              <Text style={[styles.liveButtonText, { color: colors.error }]}>Live</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1.5} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search videos..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            accessibilityLabel="Search videos"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} accessibilityLabel="Clear search">
              <X size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
            accessibilityLabel="Filter videos"
            accessibilityRole="button"
          >
            <Filter size={ICON_SIZE.md} color={colors.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {showSearchResults ? (
          <SearchResults
            query={searchQuery}
            results={filteredVideos}
            onVideoSelect={handleVideoSelect}
            onClear={clearSearch}
          />
        ) : (
          <>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <PrimaryButton
                title="Go Live"
                  onPress={openLiveStream}
                  leftIcon={<Wifi size={ICON_SIZE.md} color={colors.primaryText} />}
                  style={styles.quickActionButton}
                />
                <PrimaryButton
                  title="Record"
                  onPress={openLiveStream}
                  variant="secondary"
                  leftIcon={<Camera size={ICON_SIZE.md} color={colors.primary} />}
                  style={styles.quickActionButton}
                />
                <PrimaryButton
                  title="Upload"
                  onPress={() => setUploadModalVisible(true)}
                  variant="ghost"
                  leftIcon={<Upload size={ICON_SIZE.md} color={colors.text} />}
                  style={styles.quickActionButton}
                />
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <StatCard
                  title="Watched"
                  value={userStats?.totalVideosWatched || 0}
                  subtitle="This week"
                  icon={<Eye size={ICON_SIZE.md} color={colors.primary} strokeWidth={1.5} />}
                />
                <StatCard
                  title="Total Likes"
                  value={totalLikes}
                  subtitle="All videos"
                  icon={<Heart size={ICON_SIZE.md} color={colors.error} strokeWidth={1.5} />}
                />
              </View>

              {/* Live Now Section */}
              <SectionHeader
                title="Live Now"
                subtitle="Catch live sessions"
                icon={<Wifi size={ICON_SIZE.md} color={colors.error} strokeWidth={1.5} />}
                onSeeAll={() => Alert.alert("Live Videos", "View all live videos")}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {liveVideos.length === 0 ? (
                  <View style={[styles.emptyLive, { backgroundColor: colors.card }]}>
                    <Wifi size={ICON_SIZE.xl} color={colors.textMuted} strokeWidth={1.5} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      No live videos right now
                    </Text>
                  </View>
                ) : (
                  liveVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      variant="compact"
                      style={styles.horizontalCard}
                      onPress={() => handleVideoSelect(video)}
                    />
                  ))
                )}
              </ScrollView>

              {/* Trending Section */}
              <SectionHeader
                title="Trending"
                subtitle="Top engagement this week"
                icon={<TrendingUp size={ICON_SIZE.md} color={colors.warning} strokeWidth={1.5} />}
                onSeeAll={() => Alert.alert("Trending", "View all trending videos")}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {trendingVideos?.map((video) => (
                  <View key={video.id} style={styles.trendingCard}>
                    <VideoCard
                      video={video}
                      variant="compact"
                      onPress={() => handleVideoSelect(video)}
                    />
                    <VideoActions
                      video={video}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onBookmark={handleBookmark}
                      showCounts={false}
                    />
                  </View>
                ))}
              </ScrollView>

              {/* Popular Section */}
              <SectionHeader
                title="Popular"
                subtitle="Most watched videos"
                icon={<Flame size={ICON_SIZE.md} color={colors.info} strokeWidth={1.5} />}
              />
              <View style={styles.videoGrid}>
                {popularVideos.map((video) => (
                  <View key={video.id} style={styles.gridItem}>
                    <VideoCard video={video} onPress={() => handleVideoSelect(video)} />
                    <VideoActions
                      video={video}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onBookmark={handleBookmark}
                    />
                  </View>
                ))}
              </View>

              {/* Sponsored Section */}
              <SectionHeader
                title="Sponsored"
                subtitle="Promoted content"
                icon={<BadgeDollarSign size={ICON_SIZE.md} color={colors.success} strokeWidth={1.5} />}
              />
              <View style={styles.sponsoredList}>
                {sponsoredVideos.map((ad) => (
                  <View key={ad.id} style={[styles.sponsoredCard, { backgroundColor: colors.card }]}>
                    <View style={styles.sponsoredHeader}>
                      <View style={[styles.sponsoredBadge, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
                        <Megaphone size={ICON_SIZE.sm} color={colors.warning} strokeWidth={2} />
                        <Text style={[styles.sponsoredBadgeText, { color: colors.warning }]}>Sponsored</Text>
                      </View>
                    </View>
                    <Text style={[styles.sponsoredTitle, { color: colors.text }]}>{ad.title}</Text>
                    <Text style={[styles.sponsoredDescription, { color: colors.textMuted }]}>
                      {ad.description}
                    </Text>
                    <PrimaryButton title="View Offer" onPress={() => { }} variant="secondary" />
                  </View>
                ))}
              </View>

              {/* Content Moderation */}
              <SectionHeader
                title="Content Moderation"
                subtitle="Community guidelines"
                icon={<ShieldCheck size={ICON_SIZE.md} color={colors.secondary} strokeWidth={1.5} />}
              />
              <View style={[styles.moderationCard, { backgroundColor: colors.card }]}>
                <View style={styles.moderationRow}>
                  <Text style={[styles.moderationLabel, { color: colors.text }]}>Flagged items</Text>
                  <View style={[styles.moderationBadge, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
                    <Text style={[styles.moderationValue, { color: colors.error }]}>3 pending</Text>
                  </View>
                </View>
                <View style={styles.moderationRow}>
                  <Text style={[styles.moderationLabel, { color: colors.text }]}>Auto-filters</Text>
                  <View style={[styles.moderationBadge, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                    <Text style={[styles.moderationValue, { color: colors.success }]}>Active</Text>
                  </View>
                </View>
                <View style={styles.moderationRow}>
                  <Text style={[styles.moderationLabel, { color: colors.text }]}>Manual reviews</Text>
                  <View style={[styles.moderationBadge, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
                    <Text style={[styles.moderationValue, { color: colors.info }]}>Queue: 5</Text>
                  </View>
                </View>
                <PrimaryButton
                  title="Open Moderation Queue"
                  onPress={() => Alert.alert("Moderation", "Moderation queue")}
                  variant="ghost"
                />
              </View>

              {/* All Videos */}
              <SectionHeader
                title="All Videos"
                subtitle="Browse and discover"
                icon={<Sparkles size={ICON_SIZE.md} color={colors.primary} strokeWidth={1.5} />}
              />
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading videos...</Text>
                </View>
              ) : (
                  <View style={styles.videoGrid}>
                    {filteredVideos.map((video) => (
                      <View key={video.id} style={styles.gridItem}>
                        <VideoCard video={video} onPress={() => handleVideoSelect(video)} />
                        <VideoActions
                          video={video}
                          onLike={handleLike}
                          onComment={handleComment}
                          onShare={handleShare}
                          onBookmark={handleBookmark}
                        />
                      </View>
                    ))}
                </View>
              )}
          </>
        )}
      </ScrollView>

      {/* Video Player Overlay */}
      {currentVideo && !showMiniPlayer && (
        <View style={styles.playerContainer}>
          <Image
            source={{ uri: currentVideo.thumbnail }}
            style={styles.playerThumbnail}
            accessibilityLabel={`Playing ${currentVideo.title}`}
          />
          <VideoPlayerOverlay
            video={currentVideo}
            isPlaying={isPlaying}
            isMuted={isMuted}
            progress={progress}
            currentTime={progress * 180}
            duration={180}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onMute={() => setIsMuted(!isMuted)}
            onSeek={setProgress}
            onClose={closePlayer}
            onShare={() => handleShare(currentVideo)}
            onLike={() => handleLike(currentVideo.id)}
            visible={showControls}
            isLiked={currentVideo.isBookmarked}
          />
          <TouchableOpacity
            style={styles.playerTouchArea}
            onPress={() => setShowControls(!showControls)}
            activeOpacity={1}
            accessibilityLabel="Toggle video controls"
          />
        </View>
      )}

      {/* Mini Player */}
      {showMiniPlayer && currentVideo && (
        <MiniPlayer
          video={currentVideo}
          isPlaying={isPlaying}
          progress={progress}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onClose={closeMiniPlayer}
          onExpand={expandMiniPlayer}
          bottomOffset={insets.bottom + SPACING["4xl"]}
        />
      )}

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
      <LiveStreamScreen
        visible={liveStreamVisible}
        onClose={closeLiveStream}
        onVideoUploaded={handleVideoUploaded}
        asModal={true}
      />
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
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  liveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  liveButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingVertical: SPACING.xs,
  },
  filterButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
  },
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  quickActionButton: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  horizontalList: {
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  horizontalCard: {
    width: getResponsiveValue(200, 240, 280),
  },
  trendingCard: {
    width: getResponsiveValue(200, 240, 280),
    marginRight: SPACING.md,
  },
  emptyLive: {
    width: SCREEN_WIDTH - SPACING.base * 2,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
  },
  videoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  gridItem: {
    width: isTablet ? "48%" : "100%",
  },
  sponsoredList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sponsoredCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  sponsoredHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sponsoredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  sponsoredBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  sponsoredTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  sponsoredDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  moderationCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  moderationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  moderationLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  moderationBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  moderationValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  loadingContainer: {
    padding: SPACING["2xl"],
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  playerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: Z_INDEX.modal,
  },
  playerThumbnail: {
    width: "100%",
    height: "100%",
  },
  playerTouchArea: {
    ...StyleSheet.absoluteFillObject,
  },
});
