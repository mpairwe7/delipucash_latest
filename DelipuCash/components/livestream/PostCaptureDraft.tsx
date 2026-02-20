/**
 * PostCaptureDraft Component
 * Shown after recording stops — lets user set title, description before publishing.
 * Inspired by TikTok/Instagram post-capture flow.
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Upload, Trash2, Film } from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, withAlpha } from '@/utils/theme';
import { formatDuration } from '@/utils/video-utils';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface PostCaptureDraftProps {
  videoUri: string;
  duration: number;
  onPublish: (metadata: { title: string; description: string; thumbnailUri?: string }) => void;
  onDiscard: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  /** True after upload reaches 100% while waiting for server finalization */
  isProcessing?: boolean;
}

export const PostCaptureDraft = memo<PostCaptureDraftProps>(({
  videoUri,
  duration,
  onPublish,
  onDiscard,
  isUploading = false,
  uploadProgress = 0,
  isProcessing = false,
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // Generate thumbnail from first frame
  useEffect(() => {
    let cancelled = false;
    setThumbnailFailed(false);
    (async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 500 });
        if (!cancelled) setThumbnailUri(uri);
      } catch {
        if (!cancelled) setThumbnailFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [videoUri]);

  const handlePublish = useCallback(() => {
    const now = new Date();
    const defaultTitle = `Video ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    onPublish({
      title: title.trim() || defaultTitle,
      description: description.trim(),
      thumbnailUri: thumbnailUri ?? undefined,
    });
  }, [title, description, thumbnailUri, onPublish]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Header */}
        <Text style={[styles.heading, { color: colors.text }]}>New Post</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Add details before publishing
        </Text>

        {/* Thumbnail + Duration */}
        <View style={styles.previewRow}>
          <View style={[styles.thumbnailContainer, { backgroundColor: colors.surfaceVariant }]}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
            ) : thumbnailFailed ? (
              <Film size={24} color={colors.textSecondary} />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          </View>

          {/* Title input beside thumbnail */}
          <View style={styles.titleInputContainer}>
            <TextInput
              style={[styles.titleInput, { color: colors.text, borderColor: withAlpha(colors.border, 0.3) }]}
              placeholder="Add a title..."
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              autoFocus
            />
          </View>
        </View>

        {/* Description */}
        <TextInput
          style={[styles.descriptionInput, { color: colors.text, borderColor: withAlpha(colors.border, 0.3) }]}
          placeholder="Add a description..."
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Upload progress */}
        {(isUploading || isProcessing) && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
              <View style={[styles.progressBar, {
                width: isProcessing ? '100%' : `${uploadProgress}%`,
                backgroundColor: isProcessing ? colors.warning : colors.primary,
              }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {isProcessing
                ? 'Finalizing on server...'
                : `Uploading... ${Math.round(uploadProgress)}%`}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.discardButton, { borderColor: withAlpha(colors.border, 0.3) }]}
            onPress={onDiscard}
            disabled={isUploading || isProcessing}
          >
            <Trash2 size={18} color={colors.error} />
            <Text style={[styles.discardText, { color: colors.error }]}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishButton, { backgroundColor: colors.primary, opacity: (isUploading || isProcessing) ? 0.7 : 1 }]}
            onPress={handlePublish}
            disabled={isUploading || isProcessing}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Upload size={18} color="#fff" />
                <Text style={styles.publishText}>Post</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});

PostCaptureDraft.displayName = 'PostCaptureDraft';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  content: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING['2xl'],
  },
  heading: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.lg,
  },
  previewRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  thumbnailContainer: {
    width: 80,
    height: 120,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  titleInputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleInput: {
    fontSize: TYPOGRAPHY.fontSize.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  descriptionInput: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    minHeight: 80,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  discardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  discardText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  publishButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  publishText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
