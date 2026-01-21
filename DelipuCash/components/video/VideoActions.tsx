/**
 * VideoActions Component
 * Engagement action bar for videos (like, comment, share, bookmark)
 * 
 * @example
 * ```tsx
 * <VideoActions
 *   video={video}
 *   onLike={handleLike}
 *   onComment={handleComment}
 *   onShare={handleShare}
 *   onBookmark={handleBookmark}
 * />
 * ```
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  ICON_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';

/**
 * Format number to human readable string
 */
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * Props for the VideoActions component
 */
export interface VideoActionsProps {
  /** Video data */
  video: Video;
  /** Like handler */
  onLike: (videoId: string) => void;
  /** Comment handler */
  onComment: (video: Video) => void;
  /** Share handler */
  onShare: (video: Video) => void;
  /** Bookmark handler */
  onBookmark: (video: Video) => void;
  /** Whether to show counts */
  showCounts?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

interface ActionButtonProps {
  icon: React.ReactElement;
  activeIcon?: React.ReactElement;
  count?: number;
  onPress: () => void;
  isActive?: boolean;
  label: string;
  showCount: boolean;
  textColor: string;
  activeColor: string;
}

function ActionButton({
  icon,
  activeIcon,
  count,
  onPress,
  isActive = false,
  label,
  showCount,
  textColor,
  activeColor,
}: ActionButtonProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.actionItem}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      {isActive && activeIcon ? activeIcon : icon}
      {showCount && count !== undefined && (
        <Text style={[styles.actionText, { color: isActive ? activeColor : textColor }]}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function VideoActionsComponent({
  video,
  onLike,
  onComment,
  onShare,
  onBookmark,
  showCounts = true,
  size = 'medium',
  orientation = 'horizontal',
  style,
  testID,
}: VideoActionsProps): React.ReactElement {
  const { colors } = useTheme();

  const iconSize = size === 'small' ? ICON_SIZE.sm : size === 'large' ? ICON_SIZE.xl : ICON_SIZE.base;

  const handleLike = useCallback(() => {
    onLike(video.id);
  }, [video.id, onLike]);

  const handleComment = useCallback(() => {
    onComment(video);
  }, [video, onComment]);

  const handleShare = useCallback(() => {
    onShare(video);
  }, [video, onShare]);

  const handleBookmark = useCallback(() => {
    onBookmark(video);
  }, [video, onBookmark]);

  const isLiked = video.isBookmarked; // Using isBookmarked as proxy for liked state
  const isBookmarked = video.isBookmarked;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        orientation === 'vertical' && styles.containerVertical,
        { borderTopColor: colors.border },
        style,
      ]}
    >
      <ActionButton
        icon={<Heart size={iconSize} color={colors.textMuted} strokeWidth={1.5} />}
        activeIcon={<Heart size={iconSize} color={colors.error} fill={colors.error} />}
        count={video.likes}
        onPress={handleLike}
        isActive={isLiked}
        label={`Like video. ${video.likes} likes`}
        showCount={showCounts}
        textColor={colors.textMuted}
        activeColor={colors.error}
      />

      <ActionButton
        icon={<MessageCircle size={iconSize} color={colors.textMuted} strokeWidth={1.5} />}
        count={Array.isArray(video.comments) ? video.comments.length : (video.comments || 0)}
        onPress={handleComment}
        label={`Comment on video. ${video.comments || 0} comments`}
        showCount={showCounts}
        textColor={colors.textMuted}
        activeColor={colors.primary}
      />

      <ActionButton
        icon={<Share2 size={iconSize} color={colors.textMuted} strokeWidth={1.5} />}
        onPress={handleShare}
        label="Share video"
        showCount={false}
        textColor={colors.textMuted}
        activeColor={colors.primary}
      />

      <ActionButton
        icon={<Bookmark size={iconSize} color={colors.textMuted} strokeWidth={1.5} />}
        activeIcon={<BookmarkCheck size={iconSize} color={colors.warning} fill={colors.warning} />}
        onPress={handleBookmark}
        isActive={isBookmarked}
        label={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
        showCount={false}
        textColor={colors.textMuted}
        activeColor={colors.warning}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  containerVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export const VideoActions = memo(VideoActionsComponent);
