/**
 * VideoCard Component
 * Displays video thumbnail with engagement metrics
 * Features smooth animations and modern UI design
 *
 * @example
 * ```tsx
 * <VideoCard
 *   video={videoData}
 *   onPress={() => router.push(`/video/${video.id}`)}
 * />
 * ```
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
  ImageBackground,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  Play,
  Eye,
  Heart,
  Bookmark,
  Clock,
  MessageCircle,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import { Video } from "@/types";

// Create AnimatedPressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface VideoCardProps {
  /** Video data object */
  video: Video;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default, compact, or horizontal */
  variant?: "default" | "compact" | "horizontal";
  /** Show bookmark status */
  showBookmark?: boolean;
  /** Animation delay for staggered entrance */
  index?: number;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format view count for display
 * @param views - Raw view count
 * @returns Formatted string (e.g., "1.2K", "3.5M")
 */
const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

/**
 * Format duration in seconds to mm:ss
 */
const formatDuration = (seconds: number = 0): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Spring animation config for press feedback
 */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

export function VideoCard({
  video,
  onPress,
  style,
  variant = "default",
  showBookmark = true,
  index = 0,
  testID,
}: VideoCardProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Determine if video is live
  const isLive = video.videoUrl?.includes(".m3u8") || video.videoUrl?.includes("live");

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [scale, pressed]);

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0.3, 0.5], Extrapolation.CLAMP),
  }));

  const animatedPlayStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          pressed.value,
          [0, 1],
          [1, 1.15],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Horizontal variant
  if (variant === "horizontal") {
    return (
      <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
        <AnimatedPressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`Video: ${video.title}`}
          testID={testID}
          style={[
            animatedCardStyle,
            styles.horizontalContainer,
            { backgroundColor: colors.card },
            style,
          ]}
        >
          {/* Thumbnail */}
          <View style={styles.horizontalThumbnailContainer}>
            <ImageBackground
              source={{ uri: video.thumbnail }}
              style={styles.horizontalThumbnail}
              imageStyle={{ borderRadius: RADIUS.md }}
            >
              <Animated.View style={[styles.playOverlay, animatedOverlayStyle]}>
                <Animated.View style={[styles.playButtonSmall, animatedPlayStyle]}>
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                </Animated.View>
              </Animated.View>
              {isLive && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveIndicator} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </ImageBackground>
          </View>

          {/* Info */}
          <View style={styles.horizontalInfo}>
            <Text
              style={[styles.horizontalTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {video.title}
            </Text>
            <View style={styles.horizontalMeta}>
              <View style={styles.metaItem}>
                <Eye size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatViews(video.views)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Heart size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatViews(video.likes)}
                </Text>
              </View>
            </View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  }

  // Default and compact variants
  return (
    <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Video: ${video.title}`}
        testID={testID}
        style={[
          animatedCardStyle,
          styles.container,
          variant === "compact" && styles.containerCompact,
          { backgroundColor: colors.card },
          style,
        ]}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <ImageBackground
            source={{ uri: video.thumbnail }}
            style={[
              styles.thumbnail,
              variant === "compact" && styles.thumbnailCompact,
            ]}
            imageStyle={{ borderRadius: RADIUS.md }}
          >
            <Animated.View style={[styles.playOverlay, animatedOverlayStyle]}>
              <Animated.View style={[styles.playButton, animatedPlayStyle]}>
                <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
              </Animated.View>
            </Animated.View>

            {/* Live Badge */}
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}

            {/* Duration Badge */}
            {!isLive && (
              <View
                style={[
                  styles.durationBadge,
                  { backgroundColor: withAlpha("#000000", 0.7) },
                ]}
              >
                <Clock size={10} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.durationText}>{formatDuration(180)}</Text>
              </View>
            )}

            {/* Bookmark Badge */}
            {showBookmark && video.isBookmarked && (
              <View
                style={[
                  styles.bookmarkBadge,
                  { backgroundColor: withAlpha(colors.warning, 0.9) },
                ]}
              >
                <Bookmark size={14} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            )}
          </ImageBackground>
        </View>

        {/* Title & Meta */}
        <View style={styles.infoContainer}>
          <Text
            style={[
              styles.title,
              variant === "compact" && styles.titleCompact,
              { color: colors.text },
            ]}
            numberOfLines={2}
          >
            {video.title}
          </Text>

          {/* Stats Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Eye size={14} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(video.views)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Heart size={14} color={colors.error} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(video.likes)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MessageCircle size={14} color={colors.info} strokeWidth={1.5} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(video.commentsCount)}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  containerCompact: {
    width: 200,
    marginRight: SPACING.md,
    marginBottom: 0,
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailCompact: {
    height: 112,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.md,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  playButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  liveBadge: {
    position: "absolute",
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  liveText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  durationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: "#FFFFFF",
  },
  bookmarkBadge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    padding: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  infoContainer: {
    padding: SPACING.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.sm,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.base,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Horizontal variant styles
  horizontalContainer: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  horizontalThumbnailContainer: {
    width: 120,
    height: 68,
    marginRight: SPACING.md,
  },
  horizontalThumbnail: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  horizontalInfo: {
    flex: 1,
    justifyContent: "center",
  },
  horizontalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  horizontalMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
});

export default VideoCard;
