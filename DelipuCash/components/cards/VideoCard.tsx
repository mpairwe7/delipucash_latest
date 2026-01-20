/**
 * VideoCard Component
 * Displays video thumbnail with engagement metrics
 * 
 * @example
 * ```tsx
 * <VideoCard
 *   video={videoData}
 *   onPress={() => router.push(`/video/${video.id}`)}
 * />
 * ```
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Image,
  ImageBackground,
} from 'react-native';
import { Play, Eye, Heart, Bookmark } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { Video } from '@/types';

export interface VideoCardProps {
  /** Video data object */
  video: Video;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default, compact, or horizontal */
  variant?: 'default' | 'compact' | 'horizontal';
  /** Show bookmark status */
  showBookmark?: boolean;
  /** Test ID for testing */
  testID?: string;
}

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

export function VideoCard({
  video,
  onPress,
  style,
  variant = 'default',
  showBookmark = true,
  testID,
}: VideoCardProps): React.ReactElement {
  const { colors } = useTheme();

  const isLive = video.videoUrl?.includes('.m3u8');

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Video: ${video.title}`}
        testID={testID}
        style={[
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
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            </View>
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
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Video: ${video.title}`}
      testID={testID}
      style={[
        styles.container,
        variant === 'compact' && styles.containerCompact,
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
            variant === 'compact' && styles.thumbnailCompact,
          ]}
          imageStyle={{ borderRadius: RADIUS.md }}
        >
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {showBookmark && video.isBookmarked && (
            <View style={styles.bookmarkBadge}>
              <Bookmark size={16} color={colors.warning} fill={colors.warning} />
            </View>
          )}
        </ImageBackground>
      </View>

      {/* Title & Meta */}
      <View style={styles.infoContainer}>
        <Text
          style={[
            styles.title,
            variant === 'compact' && styles.titleCompact,
            { color: colors.text },
          ]}
          numberOfLines={2}
        >
          {video.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Eye size={14} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {formatViews(video.views)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Heart size={14} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {formatViews(video.likes)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  containerCompact: {
    width: 200,
    marginRight: SPACING.md,
    marginBottom: 0,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailCompact: {
    height: 112,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bookmarkBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Horizontal variant styles
  horizontalContainer: {
    flexDirection: 'row',
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  horizontalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  horizontalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
});

export default VideoCard;
