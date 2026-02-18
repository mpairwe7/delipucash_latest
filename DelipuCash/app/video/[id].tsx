/**
 * Video Deep Link Screen
 *
 * Handles `delipucash://video/{id}` deep links and
 * `https://delipucashserver.vercel.app/video/{id}` universal links.
 *
 * Fetches the video by ID and renders it in the full-screen VideoPlayer.
 * Shows a loading skeleton while fetching and an error state if not found.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Play } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
} from '@/utils/theme';
import { VideoPlayer } from '@/components/video';
import { useVideoDetails, useLikeVideo } from '@/services/videoHooks';
import { useVideoFeedStore, selectLikedVideoIds } from '@/store/VideoFeedStore';

export default function VideoDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: video, isLoading, isError } = useVideoDetails(id || '');
  const { mutate: likeVideoMutate } = useLikeVideo();
  const likedVideoIds = useVideoFeedStore(selectLikedVideoIds);
  const toggleLike = useVideoFeedStore(s => s.toggleLike);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/videos-new' as Href);
    }
  }, []);

  const handleLike = useCallback(() => {
    if (!video) return;
    const isCurrentlyLiked = likedVideoIds.has(video.id);
    toggleLike(video.id);
    likeVideoMutate(
      { videoId: video.id, isLiked: isCurrentlyLiked },
      { onError: () => toggleLike(video.id) },
    );
  }, [video, likedVideoIds, toggleLike, likeVideoMutate]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading video...
        </Text>
      </View>
    );
  }

  // Error / not found state
  if (isError || !video) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Play size={48} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Video not found
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textMuted }]}>
          This video may have been removed or is no longer available.
        </Text>
        <Pressable
          style={[styles.browseButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)/videos-new' as Href)}
        >
          <Text style={styles.browseButtonText}>Browse Videos</Text>
        </Pressable>
        <Pressable
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={handleClose}
        >
          <ArrowLeft size={16} color={colors.text} strokeWidth={2} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Render full-screen player with the fetched video
  return (
    <VideoPlayer
      videoSource={video.videoUrl}
      videoDetails={video}
      onClose={handleClose}
      onLike={handleLike}
      isLiked={likedVideoIds.has(video.id)}
      autoPlay
      loop={false}
      testID="deep-link-video-player"
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.sm,
  },
  errorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  errorSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  browseButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
  browseButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  backButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
