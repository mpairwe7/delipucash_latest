/**
 * UploadModal Component
 * Full-featured video upload modal with R2 cloud storage integration.
 *
 * Features:
 * - Video file picker with client + server validation
 * - Optional thumbnail/cover image picker
 * - Real upload progress via XHR (no fake intervals)
 * - Animated progress bar with percentage
 * - Premium tier file-size gating with upgrade prompt
 * - Uploads directly to Cloudflare R2 (server creates DB record atomically)
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Image,
} from 'react-native';
import {
  X,
  Film,
  Image as ImageIcon,
  AlertTriangle,
  Crown,
  CheckCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, Href } from 'expo-router';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import {
  MAX_UPLOAD_SIZE_FREE,
  MAX_UPLOAD_SIZE_PREMIUM,
  formatFileSize,
} from '@/utils/video-utils';
import { useVideoPremiumAccess } from '@/services/purchasesHooks';
import { useVideoStore, selectCurrentUpload } from '@/store/VideoStore';
import { useAuthStore } from '@/utils/auth/store';
import {
  useUploadVideoToR2,
  useUploadMediaToR2,
  useValidateR2Upload,
} from '@/services/r2UploadHooks';

/**
 * Selected file info
 */
interface SelectedFileInfo {
  uri: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Selected thumbnail info
 */
interface SelectedThumbnail {
  uri: string;
  name: string;
  type: string;
}

/**
 * Props for the UploadModal component
 */
export interface UploadModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Called after a successful upload with the created video ID */
  onUploadComplete?: (videoId: string) => void;
  /** Maximum title length */
  maxTitleLength?: number;
  /** Maximum description length */
  maxDescriptionLength?: number;
  /** Callback when user needs to upgrade for larger files */
  onUpgradeRequired?: () => void;
  /** Test ID for testing */
  testID?: string;
}

function UploadModalComponent({
  visible,
  onClose,
  onUploadComplete,
  maxTitleLength = 100,
  maxDescriptionLength = 500,
  onUpgradeRequired,
  testID,
}: UploadModalProps): React.ReactElement {
  const { colors } = useTheme();
  const { hasVideoPremium, maxUploadSize } = useVideoPremiumAccess();

  // Auth
  const userId = useAuthStore(s => s.auth?.user?.id);

  // Video store actions
  const storeCurrentUpload = useVideoStore(selectCurrentUpload);
  const startUpload = useVideoStore(s => s.startUpload);
  const updateUploadProgress = useVideoStore(s => s.updateUploadProgress);
  const cancelUpload = useVideoStore(s => s.cancelUpload);
  const completeUpload = useVideoStore(s => s.completeUpload);
  const failUpload = useVideoStore(s => s.failUpload);
  const setPremiumStatus = useVideoStore(s => s.setPremiumStatus);

  // R2 upload hooks — real progress via XHR
  const {
    mutateAsync: uploadVideoOnly,
    progress: videoProgress,
    isUploading: isUploadingVideo,
  } = useUploadVideoToR2();

  const {
    mutateAsync: uploadMedia,
    progress: mediaProgress,
    isUploading: isUploadingMedia,
  } = useUploadMediaToR2();

  const validateR2Mutation = useValidateR2Upload();

  // Derived state
  const isUploading = isUploadingVideo || isUploadingMedia;
  const uploadProgress = isUploadingMedia ? mediaProgress : videoProgress;

  // Sync premium status with store
  useEffect(() => {
    setPremiumStatus({
      hasVideoPremium,
      maxUploadSize,
      maxRecordingDuration: hasVideoPremium ? 1800 : 300,
      maxLivestreamDuration: hasVideoPremium ? 7200 : 300,
    });
  }, [hasVideoPremium, maxUploadSize, setPremiumStatus]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFileInfo | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<SelectedThumbnail | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setSelectedThumbnail(null);
    setFileSizeError(null);
    if (storeCurrentUpload) {
      cancelUpload(storeCurrentUpload.fileId);
    }
  }, [cancelUpload, storeCurrentUpload]);

  // ── Video file picker ──────────────────────────────────────────────────────
  const handleSelectFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const fileSize = file.size || 0;
      const fileName = file.name || 'video.mp4';
      const mimeType = file.mimeType || 'video/mp4';

      // Client-side size check (instant feedback)
      if (fileSize > maxUploadSize) {
        setFileSizeError(
          hasVideoPremium
            ? `File size (${formatFileSize(fileSize)}) exceeds maximum of ${formatFileSize(MAX_UPLOAD_SIZE_PREMIUM)}`
            : `File size (${formatFileSize(fileSize)}) exceeds free limit of ${formatFileSize(MAX_UPLOAD_SIZE_FREE)}. Upgrade to Video Premium for up to ${formatFileSize(MAX_UPLOAD_SIZE_PREMIUM)}.`
        );
        setSelectedFile(null);
        return;
      }

      // Server-side validation (tier + type + size)
      try {
        const validation = await validateR2Mutation.mutateAsync({
          userId: userId || '',
          fileSize,
          mimeType,
          fileName,
          type: 'video',
        });

        if (!validation.success || !validation.data?.valid) {
          setFileSizeError(validation.data?.message || validation.error || 'File validation failed');
          setSelectedFile(null);
          return;
        }
      } catch {
        // Offline fallback — client validation already passed
        if (__DEV__) console.warn('Server validation unavailable, using client-side only');
      }

      setFileSizeError(null);
      setSelectedFile({ uri: file.uri, name: fileName, size: fileSize, type: mimeType });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to select video file. Please try again.');
    }
  }, [maxUploadSize, hasVideoPremium, validateR2Mutation, userId]);

  // ── Thumbnail picker ───────────────────────────────────────────────────────
  const handleSelectThumbnail = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setSelectedThumbnail({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'thumbnail.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Error', 'Failed to select thumbnail. Please try again.');
    }
  }, []);

  const handleRemoveThumbnail = useCallback(() => {
    setSelectedThumbnail(null);
  }, []);

  // Navigate to subscription screen for upgrade
  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgradeRequired?.();
    router.push('/subscription' as Href);
  }, [onUpgradeRequired]);

  const handleClose = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        'Upload in Progress',
        'An upload is currently in progress. Are you sure you want to cancel?',
        [
          { text: 'Continue Upload', style: 'cancel' },
          {
            text: 'Cancel Upload',
            style: 'destructive',
            onPress: () => { resetForm(); onClose(); },
          },
        ]
      );
      return;
    }

    if (title || description || selectedFile) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => { resetForm(); onClose(); },
          },
        ]
      );
    } else {
      onClose();
    }
  }, [title, description, selectedFile, isUploading, resetForm, onClose]);

  // ── Upload handler — sends actual file to R2 ──────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a video to upload');
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'You must be signed in to upload');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Track in VideoStore
    const upload = startUpload({
      name: selectedFile.name,
      size: selectedFile.size,
      uri: selectedFile.uri,
    });
    const fileId = upload?.fileId || '';

    try {
      let result;

      if (selectedThumbnail) {
        // Upload video + thumbnail together → POST /api/r2/upload/media
        result = await uploadMedia({
          videoUri: selectedFile.uri,
          userId,
          title: title.trim(),
          description: description.trim(),
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          thumbnailUri: selectedThumbnail.uri,
          thumbnailFileName: selectedThumbnail.name,
          thumbnailMimeType: selectedThumbnail.type,
        });
      } else {
        // Upload video only → POST /api/r2/upload/video
        result = await uploadVideoOnly({
          videoUri: selectedFile.uri,
          userId,
          title: title.trim(),
          description: description.trim(),
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        });
      }

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Success — sync store, reset form, notify parent
      if (fileId) completeUpload(fileId, result.data?.videoUrl || '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const videoId = result.data?.id || '';
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setSelectedThumbnail(null);
      setFileSizeError(null);
      onUploadComplete?.(videoId);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (fileId) failUpload(fileId, message);
      Alert.alert('Upload Failed', message);
    }
  }, [
    title, description, selectedFile, selectedThumbnail, userId,
    uploadVideoOnly, uploadMedia, startUpload, completeUpload, failUpload,
    onUploadComplete, resetForm, onClose,
  ]);

  const isValid = title.trim().length > 0 && selectedFile !== null && !fileSizeError;

  // ── Sync R2 hook progress → VideoStore ─────────────────────────────────────
  useEffect(() => {
    if (storeCurrentUpload && isUploading) {
      updateUploadProgress(storeCurrentUpload.fileId, { progress: uploadProgress });
    }
  }, [uploadProgress, isUploading, storeCurrentUpload, updateUploadProgress]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close upload modal"
            accessibilityRole="button"
          >
            <X size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Upload Video
          </Text>

          <TouchableOpacity
            onPress={handleUpload}
            disabled={!isValid || isUploading}
            style={[
              styles.uploadButton,
              {
                backgroundColor: isValid && !isUploading ? colors.primary : colors.border,
                opacity: isUploading ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Upload video"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValid || isUploading }}
          >
            {isUploading ? (
              <Text style={[styles.uploadButtonText, { color: colors.primaryText }]}>
                {uploadProgress}%
              </Text>
            ) : (
              <Text
                style={[
                  styles.uploadButtonText,
                  { color: isValid ? colors.primaryText : colors.textMuted },
                ]}
              >
                Upload
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Upload progress bar */}
        {isUploading && (
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.primary,
                  width: `${uploadProgress}%`,
                },
              ]}
            />
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Video selector */}
          <TouchableOpacity
            style={[
              styles.videoSelector,
              {
                borderColor: selectedFile
                  ? colors.success
                  : fileSizeError
                    ? colors.error
                    : colors.border,
                backgroundColor: selectedFile
                  ? withAlpha(colors.success, 0.1)
                  : fileSizeError
                    ? withAlpha(colors.error, 0.1)
                    : withAlpha(colors.card, 0.5),
              },
            ]}
            onPress={handleSelectFile}
            disabled={isUploading}
            accessibilityLabel="Select video to upload"
            accessibilityRole="button"
          >
            {selectedFile ? (
              <>
                <View style={[styles.selectorIcon, { backgroundColor: withAlpha(colors.success, 0.2) }]}>
                  <CheckCircle size={32} color={colors.success} strokeWidth={1.5} />
                </View>
                <Text style={[styles.selectorTitle, { color: colors.text }]} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <Text style={[styles.selectorSubtitle, { color: colors.success }]}>
                  {formatFileSize(selectedFile.size)} {!isUploading && '• Tap to change'}
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.selectorIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <Film size={32} color={colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={[styles.selectorTitle, { color: colors.text }]}>
                  Tap to select video
                </Text>
                <Text style={[styles.selectorSubtitle, { color: colors.textMuted }]}>
                  MP4, MOV, WebM • Max {formatFileSize(maxUploadSize)}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Thumbnail selector */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Cover Image
            </Text>
            <TouchableOpacity
              style={[
                styles.thumbnailSelector,
                {
                  borderColor: selectedThumbnail ? colors.success : colors.border,
                  backgroundColor: selectedThumbnail
                    ? withAlpha(colors.success, 0.05)
                    : withAlpha(colors.card, 0.5),
                },
              ]}
              onPress={handleSelectThumbnail}
              disabled={isUploading}
              accessibilityLabel="Select cover image"
              accessibilityRole="button"
            >
              {selectedThumbnail ? (
                <View style={styles.thumbnailPreviewRow}>
                  <Image
                    source={{ uri: selectedThumbnail.uri }}
                    style={styles.thumbnailPreview}
                  />
                  <View style={styles.thumbnailInfo}>
                    <Text style={[styles.thumbnailName, { color: colors.text }]} numberOfLines={1}>
                      {selectedThumbnail.name}
                    </Text>
                    <TouchableOpacity onPress={handleRemoveThumbnail} disabled={isUploading}>
                      <Text style={[styles.thumbnailRemove, { color: colors.error }]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <ImageIcon size={20} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={[styles.thumbnailPlaceholderText, { color: colors.textMuted }]}>
                    Add cover image (optional)
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* File Size Error & Upgrade Prompt */}
          {fileSizeError && (
            <View style={[styles.errorContainer, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
              <View style={styles.errorHeader}>
                <AlertTriangle size={20} color={colors.error} strokeWidth={2} />
                <Text style={[styles.errorTitle, { color: colors.error }]}>
                  File Too Large
                </Text>
              </View>
              <Text style={[styles.errorText, { color: colors.textMuted }]}>
                {fileSizeError}
              </Text>
              {!hasVideoPremium && (
                <TouchableOpacity
                  style={[styles.upgradeButton, { backgroundColor: colors.warning }]}
                  onPress={handleUpgrade}
                  accessibilityLabel="Upgrade to Video Premium"
                  accessibilityRole="button"
                >
                  <Crown size={18} color={colors.primaryText} strokeWidth={2} />
                  <Text style={[styles.upgradeButtonText, { color: colors.primaryText }]}>
                    Upgrade to Video Premium
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Free User Limit Notice */}
          {!hasVideoPremium && !fileSizeError && (
            <View style={[styles.limitNotice, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
              <Text style={[styles.limitNoticeText, { color: colors.info }]}>
                Free users can upload videos up to {formatFileSize(MAX_UPLOAD_SIZE_FREE)}.
                {' '}
                <Text
                  style={{ textDecorationLine: 'underline' }}
                  onPress={handleUpgrade}
                >
                  Upgrade for larger uploads
                </Text>
              </Text>
            </View>
          )}

          {/* Title input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Title <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Add a title that describes your video"
              placeholderTextColor={colors.textMuted}
              maxLength={maxTitleLength}
              editable={!isUploading}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              accessibilityLabel="Video title"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {title.length}/{maxTitleLength}
            </Text>
          </View>

          {/* Description input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell viewers about your video"
              placeholderTextColor={colors.textMuted}
              maxLength={maxDescriptionLength}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isUploading}
              style={[
                styles.textAreaInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              accessibilityLabel="Video description"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {description.length}/{maxDescriptionLength}
            </Text>
          </View>

          {/* Tips section */}
          <View style={[styles.tipsSection, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
            <Text style={[styles.tipsTitle, { color: colors.info }]}>
              Tips for better videos
            </Text>
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              {'\u2022'} Use clear, descriptive titles{'\n'}
              {'\u2022'} Add a cover image for higher engagement{'\n'}
              {'\u2022'} Keep videos under 10 minutes for best reach{'\n'}
              {'\u2022'} Use good lighting and clear audio
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.base,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  uploadButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minWidth: 72,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.base,
    gap: SPACING.lg,
  },
  videoSelector: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['2xl'],
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: SPACING.md,
  },
  selectorIcon: {
    padding: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  selectorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  selectorSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  thumbnailSelector: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  thumbnailPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  thumbnailPlaceholderText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  thumbnailPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.md,
  },
  thumbnailPreview: {
    width: 80,
    height: 45,
    borderRadius: RADIUS.sm,
  },
  thumbnailInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  thumbnailName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  thumbnailRemove: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  inputGroup: {
    gap: SPACING.sm,
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  textInput: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  textAreaInput: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 100,
  },
  charCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
  },
  tipsSection: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  tipsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  tipText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  errorContainer: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  upgradeButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  limitNotice: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  limitNoticeText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
});

export const UploadModal = memo(UploadModalComponent);
