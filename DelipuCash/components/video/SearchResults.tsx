/**
 * SearchResults Component
 * Displays search results with video cards and empty state
 * 
 * @example
 * ```tsx
 * <SearchResults
 *   query="tutorial"
 *   results={filteredVideos}
 *   onVideoSelect={handleVideoSelect}
 *   onClear={handleClearSearch}
 * />
 * ```
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Search } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';

/**
 * Format views to human readable string
 */
const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
  return `${views} views`;
};

/**
 * Format date to relative time string
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
};

/**
 * Props for the SearchResults component
 */
export interface SearchResultsProps {
  /** Search query string */
  query: string;
  /** Array of matching videos */
  results: Video[];
  /** Handler when a video is selected */
  onVideoSelect: (video: Video) => void;
  /** Handler to clear search */
  onClear: () => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom empty state subtitle */
  emptySubtitle?: string;
  /** Test ID for testing */
  testID?: string;
}

interface SearchResultItemProps {
  video: Video;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function SearchResultItem({ video, onPress, colors }: SearchResultItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.resultItem, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${video.title}. ${formatViews(video.views)}`}
    >
      <Image
        source={{ uri: video.thumbnail }}
        style={styles.resultThumbnail}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.resultInfo}>
        <Text
          style={[styles.resultTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {video.title}
        </Text>
        <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
          {formatViews(video.views)} • {formatTimeAgo(video.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SearchResultsComponent({
  query,
  results,
  onVideoSelect,
  onClear,
  emptyMessage = 'No videos found',
  emptySubtitle,
  testID,
}: SearchResultsProps): React.ReactElement {
  const { colors } = useTheme();

  const handleVideoPress = useCallback(
    (video: Video) => {
      onVideoSelect(video);
    },
    [onVideoSelect]
  );

  // Empty state
  if (results.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={testID}>
        <Search size={ICON_SIZE['4xl']} color={colors.textMuted} strokeWidth={1} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {emptyMessage}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {emptySubtitle || `Try searching for "${query}" with different keywords`}
        </Text>
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: colors.primary }]}
          onPress={onClear}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Text style={[styles.clearButtonText, { color: colors.primaryText }]}>
            Clear Search
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {`Results for "${query}"`}
        </Text>
        <Text style={[styles.headerCount, { color: colors.textMuted }]}>
          {results.length} {results.length === 1 ? 'video' : 'videos'}
        </Text>
      </View>

      {/* Results list */}
      {results.map((video) => (
        <SearchResultItem
          key={video.id}
          video={video}
          onPress={() => handleVideoPress(video)}
          colors={colors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  resultItem: {
    flexDirection: 'row',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  resultThumbnail: {
    width: 120,
    height: 68,
    borderRadius: RADIUS.sm,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  resultTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  resultMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['3xl'],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  clearButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  clearButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export const SearchResults = memo(SearchResultsComponent);
