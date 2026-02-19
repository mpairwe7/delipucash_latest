/**
 * FileUploadQuestion — Respondent-facing file upload for survey attempts
 *
 * Features:
 * - Tap to pick file via expo-document-picker
 * - Progress bar during R2 upload
 * - File preview (icon + filename + size)
 * - Delete button, retry on failure
 * - Haptic feedback on complete
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, useTheme, withAlpha } from '@/utils/theme';
import { useUploadSurveyFile, useDeleteSurveyFile } from '@/services/surveyFileHooks';
import type { SurveyFileUploadResult } from '@/services/surveyFileApi';

// ============================================================================
// TYPES
// ============================================================================

interface FileUploadQuestionProps {
  surveyId: string;
  questionId: string;
  /** Called with the file ID when upload completes */
  onFileUploaded: (fileId: string) => void;
  /** Called when file is deleted */
  onFileDeleted?: () => void;
  /** Currently uploaded file ID (if resuming) */
  currentFileId?: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
  return 'document';
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FileUploadQuestion: React.FC<FileUploadQuestionProps> = ({
  surveyId,
  questionId,
  onFileUploaded,
  onFileDeleted,
  currentFileId,
}) => {
  const { colors } = useTheme();
  const [uploadedFile, setUploadedFile] = useState<SurveyFileUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    mutate: uploadFile,
    progress,
    isUploading,
    reset: resetUpload,
  } = useUploadSurveyFile();

  const { mutate: deleteFile, isPending: isDeleting } = useDeleteSurveyFile();

  const handlePickFile = useCallback(async () => {
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/zip',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      uploadFile(
        {
          surveyId,
          questionId,
          fileUri: file.uri,
          fileName: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
        },
        {
          onSuccess: (uploadResult) => {
            if (uploadResult.success && uploadResult.data) {
              setUploadedFile(uploadResult.data);
              onFileUploaded(uploadResult.data.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } else {
              setError(uploadResult.error || 'Upload failed');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            }
          },
          onError: (err) => {
            setError(err.message || 'Upload failed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          },
        },
      );
    } catch (err: any) {
      // DocumentPicker cancellation is not an error
      if (err?.code === 'DOCUMENT_PICKER_CANCELED' || err?.message?.includes('cancel')) {
        return;
      }
      setError('Failed to pick file. Please try again.');
    }
  }, [surveyId, questionId, uploadFile, onFileUploaded]);

  const handleDelete = useCallback(() => {
    if (!uploadedFile) return;

    deleteFile(
      { surveyId, fileId: uploadedFile.id },
      {
        onSuccess: () => {
          setUploadedFile(null);
          onFileDeleted?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        },
        onError: () => {
          setError('Failed to delete file');
        },
      },
    );
  }, [uploadedFile, surveyId, deleteFile, onFileDeleted]);

  const handleRetry = useCallback(() => {
    setError(null);
    resetUpload();
    handlePickFile();
  }, [resetUpload, handlePickFile]);

  // ── Uploaded state ──
  if (uploadedFile || currentFileId) {
    return (
      <View style={[styles.container, { borderColor: withAlpha(colors.success, 0.3), backgroundColor: withAlpha(colors.success, 0.04) }]}>
        <View style={styles.fileRow}>
          <View style={[styles.fileIcon, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
            <CheckCircle2 size={20} color={colors.success} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
              {uploadedFile?.fileName || 'File uploaded'}
            </Text>
            {uploadedFile && (
              <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                {formatFileSize(uploadedFile.fileSize)} · {uploadedFile.mimeType.split('/')[1]?.toUpperCase()}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={isDeleting}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Delete uploaded file"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={18} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Uploading state ──
  if (isUploading) {
    return (
      <View style={[styles.container, { borderColor: withAlpha(colors.primary, 0.3) }]}>
        <View style={styles.uploadingContent}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.uploadingText, { color: colors.primary }]}>
            Uploading... {progress}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
        </View>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={[styles.container, { borderColor: withAlpha(colors.error, 0.3), backgroundColor: withAlpha(colors.error, 0.04) }]}>
        <View style={styles.errorContent}>
          <AlertCircle size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>
            {error}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleRetry}
          style={[styles.retryBtn, { backgroundColor: withAlpha(colors.error, 0.1) }]}
          accessibilityRole="button"
          accessibilityLabel="Retry file upload"
        >
          <RefreshCw size={16} color={colors.error} />
          <Text style={[styles.retryText, { color: colors.error }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Default: pick file ──
  return (
    <TouchableOpacity
      style={[styles.container, styles.pickArea, { borderColor: colors.border }]}
      onPress={handlePickFile}
      accessibilityRole="button"
      accessibilityLabel="Tap to upload a file"
    >
      <View style={[styles.uploadIcon, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
        <Upload size={24} color={colors.primary} />
      </View>
      <Text style={[styles.pickTitle, { color: colors.text }]}>Tap to upload a file</Text>
      <Text style={[styles.pickSubtitle, { color: colors.textMuted }]}>
        PDF, DOC, XLS, images, ZIP · Max 25MB
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  pickArea: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  pickTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.xxs,
  },
  pickSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  // Uploading
  uploadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  uploadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Uploaded
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  fileMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Error
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default FileUploadQuestion;
