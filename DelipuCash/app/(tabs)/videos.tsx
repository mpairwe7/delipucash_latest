import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
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
  MessageCircle,
  ShieldCheck,
  BadgeDollarSign,
  Megaphone,
  Play,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
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
  SearchBar,
  NotificationBell,
} from "@/components";
import { mockAds } from "@/data/mockData";
import { Video, Ad } from "@/types";

export default function VideosScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: videosData, isLoading, refetch } = useVideos({ limit: 30 });
  const { data: trendingVideos } = useTrendingVideos(8);
  const { data: userStats } = useUserStats();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: likeVideo } = useLikeVideo();

  const videos = videosData?.videos ?? [];

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const lower = searchQuery.toLowerCase();
    return videos.filter((video) => (video.title || "").toLowerCase().includes(lower));
  }, [videos, searchQuery]);

  const liveVideos = useMemo(
    () => videos.filter((video) => video.videoUrl?.includes(".m3u8") || video.videoUrl?.includes("live")),
    [videos],
  );

  const popularVideos = useMemo(
    () => [...videos].sort((a, b) => b.views - a.views).slice(0, 6),
    [videos],
  );

  const sponsoredVideos = useMemo(
    () => mockAds.filter((ad) => ad.sponsored).slice(0, 3),
    [],
  );

  const totalLikes = useMemo(() => videos.reduce((sum, video) => sum + (video.likes || 0), 0), [videos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLike = (videoId: string): void => {
    likeVideo(videoId);
  };

  const handleComment = (video: Video): void => {
    Alert.alert("Comments", "Comment flow coming soon", [
      { text: "Close" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING['2xl'],
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Videos</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Create, stream, and monetize</Text>
            </View>
            <View style={styles.headerActions}>
              <NotificationBell
                count={unreadCount ?? 0}
                onPress={() => router.push("/notifications" as Href)}
              />
              <TouchableOpacity
                style={[styles.livePill, { backgroundColor: withAlpha(colors.error, 0.12) }]}
                accessibilityRole="button"
                accessibilityLabel="Go live"
              >
                <Play size={18} color={colors.error} strokeWidth={1.5} />
                <Text style={[styles.liveText, { color: colors.error }]}>Go live</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SearchBar
            placeholder="Search videos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ marginBottom: SPACING.lg }}
          />

          {/* Quick actions */}
          <View style={styles.actionsRow}>
            <PrimaryButton
              title="Go Live"
              onPress={() => {}}
              leftIcon={<Wifi size={18} color={colors.primaryText} />}
              style={styles.actionButton}
            />
            <PrimaryButton
              title="Upload video"
              onPress={() => {}}
              variant="secondary"
              leftIcon={<Upload size={18} color={colors.primary} />}
              style={styles.actionButton}
            />
            <PrimaryButton
              title="Create post"
              onPress={() => {}}
              variant="ghost"
              leftIcon={<PenSquare size={18} color={colors.text} />}
              style={styles.actionButton}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard
              title="Watched"
              value={userStats?.totalVideosWatched || 0}
              subtitle="This week"
              icon={<Sparkles size={18} color={colors.primary} strokeWidth={1.5} />}
            />
            <StatCard
              title="Likes"
              value={totalLikes}
              subtitle="All time"
              icon={<Heart size={18} color={colors.success} strokeWidth={1.5} />}
            />
          </View>

          {/* Live now */}
          <SectionHeader
            title="Live now"
            subtitle="Catch live sessions"
            icon={<Wifi size={18} color={colors.error} strokeWidth={1.5} />}
            onSeeAll={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {liveVideos.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No live videos right now</Text>
              </View>
            ) : (
              liveVideos.map((video: Video) => (
                <VideoCard key={video.id} video={video} variant="compact" style={styles.cardSpacing} />
              ))
            )}
          </ScrollView>

          {/* Trending videos */}
          <SectionHeader
            title="Trending"
            subtitle="Top engagement this week"
            icon={<Flame size={18} color={colors.warning} strokeWidth={1.5} />}
            onSeeAll={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {trendingVideos?.map((video: Video) => (
              <View key={video.id} style={styles.cardSpacing}>
                <VideoCard video={video} variant="compact" />
                <VideoActions
                  video={video}
                  colors={colors}
                  onLike={handleLike}
                  onComment={handleComment}
                />
              </View>
            ))}
          </ScrollView>

          {/* Popular videos */}
          <SectionHeader
            title="Popular"
            subtitle="Most watched"
            icon={<Sparkles size={18} color={colors.info} strokeWidth={1.5} />}
          />
          <View style={styles.grid}> 
            {popularVideos.map((video: Video) => (
              <View key={video.id} style={styles.gridItem}>
                <VideoCard video={video} />
                <VideoActions
                  video={video}
                  colors={colors}
                  onLike={handleLike}
                  onComment={handleComment}
                />
              </View>
            ))}
          </View>

          {/* Sponsored videos */}
          <SectionHeader
            title="Sponsored"
            subtitle="Ads & promoted campaigns"
            icon={<BadgeDollarSign size={18} color={colors.success} strokeWidth={1.5} />}
          />
          <View style={styles.adList}>
            {sponsoredVideos.map((ad: Ad) => (
              <View key={ad.id} style={[styles.adCard, { backgroundColor: colors.card }]}>
                <View style={styles.adHeader}>
                  <Megaphone size={18} color={colors.primary} strokeWidth={1.5} />
                  <Text style={[styles.adTitle, { color: colors.text }]}>Promoted</Text>
                </View>
                <Text style={[styles.adHeadline, { color: colors.text }]}>{ad.title}</Text>
                <Text style={[styles.adCopy, { color: colors.textMuted }]}>{ad.description}</Text>
                <PrimaryButton title="View offer" onPress={() => {}} variant="secondary" />
              </View>
            ))}
          </View>

          {/* Content moderation */}
          <SectionHeader
            title="Content moderation"
            subtitle="Protect the community"
            icon={<ShieldCheck size={18} color={colors.secondary} strokeWidth={1.5} />}
          />
          <View style={[styles.moderationCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Content moderation status"
          >
            <View style={styles.moderationRow}>
              <Text style={[styles.moderationLabel, { color: colors.text }]}>Flagged items</Text>
              <Text style={[styles.moderationValue, { color: colors.error }]}>3 pending</Text>
            </View>
            <View style={styles.moderationRow}>
              <Text style={[styles.moderationLabel, { color: colors.text }]}>Auto-filters</Text>
              <Text style={[styles.moderationValue, { color: colors.success }]}>On</Text>
            </View>
            <View style={styles.moderationRow}>
              <Text style={[styles.moderationLabel, { color: colors.text }]}>Manual reviews</Text>
              <Text style={[styles.moderationValue, { color: colors.textMuted }]}>Queue 5</Text>
            </View>
            <PrimaryButton
              title="Open moderation queue"
              onPress={() => {}}
              variant="ghost"
            />
          </View>

          {/* All videos */}
          <SectionHeader
            title="All videos"
            subtitle="Browse and engage"
            icon={<Sparkles size={18} color={colors.primary} strokeWidth={1.5} />}
          />
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredVideos.map((video: Video) => (
                <View key={video.id} style={styles.gridItem}>
                  <VideoCard video={video} />
                  <VideoActions
                    video={video}
                    colors={colors}
                    onLike={handleLike}
                    onComment={handleComment}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  interface VideoActionsProps {
    video: Video;
    colors: ReturnType<typeof useTheme>["colors"];
    onLike: (id: string) => void;
    onComment: (video: Video) => void;
  }

  function VideoActions({ video, colors, onLike, onComment }: VideoActionsProps): React.ReactElement {
    return (
      <View style={[styles.actionRow, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel={`Like ${video.title}`}
          onPress={() => onLike(video.id)}
        >
          <Heart size={16} color={colors.text} strokeWidth={1.5} />
          <Text style={[styles.actionText, { color: colors.text }]}>{video.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          accessibilityRole="button"
          accessibilityLabel={`Comment on ${video.title}`}
          onPress={() => onComment(video)}
        >
          <MessageCircle size={16} color={colors.text} strokeWidth={1.5} />
          <Text style={[styles.actionText, { color: colors.text }]}>{video.commentsCount ?? 0}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: SPACING.base,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SPACING.lg,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    headerTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize["3xl"],
    },
    headerSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      marginTop: SPACING.xs,
    },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
    },
    liveText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    actionsRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    actionButton: {
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
    cardSpacing: {
      marginRight: SPACING.md,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    gridItem: {
      width: "48%",
    },
    adList: {
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    adCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    adHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
    },
    adTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    adHeadline: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    adCopy: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    moderationCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    moderationRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    moderationLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    moderationValue: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
      gap: SPACING.sm,
    },
    actionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
    },
    actionText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    emptyState: {
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: SPACING.md,
    },
    emptyText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    loadingContainer: {
      padding: SPACING.xl,
      alignItems: "center",
      justifyContent: "center",
    },
  });
