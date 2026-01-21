/**
 * UploadModal Component
 * A modal for uploading videos with form validation
 * 
 * @example
 * ```tsx
 * <UploadModal
 *   visible={showUpload}
 *   onClose={() => setShowUpload(false)}
 *   onUpload={handleUpload}
 * />
 * ```
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
} from 'react-native';
import {
  X,
  Film,
  Image as ImageIcon,
  Smile,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';

/**
 * Upload form data
 */
export interface UploadFormData {
  title: string;
  description: string;
  isPrivate: boolean;
}

/**
 * Props for the UploadModal component
 */
export interface UploadModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Upload handler */
  onUpload?: (data: UploadFormData) => Promise<void>;
  /** Maximum title length */
  maxTitleLength?: number;
  /** Maximum description length */
  maxDescriptionLength?: number;
  /** Test ID for testing */
  testID?: string;
}

function UploadModalComponent({
  visible,
  onClose,
  onUpload,
  maxTitleLength = 100,
  maxDescriptionLength = 500,
  testID,
}: UploadModalProps): React.ReactElement {
  const { colors } = useTheme();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (title || description) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  }, [title, description, resetForm, onClose]);

  const handleUpload = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUploading(true);

    try {
      await onUpload?.({
        title: title.trim(),
        description: description.trim(),
        isPrivate: false,
      });
      resetForm();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [title, description, onUpload, resetForm, onClose]);

  const isValid = title.trim().length > 0;

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
                backgroundColor: isValid ? colors.primary : colors.border,
                opacity: isUploading ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Upload video"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValid || isUploading }}
          >
            <Text
              style={[
                styles.uploadButtonText,
                { color: isValid ? colors.primaryText : colors.textMuted },
              ]}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>

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
                borderColor: colors.border,
                backgroundColor: withAlpha(colors.card, 0.5),
              },
            ]}
            accessibilityLabel="Select video to upload"
            accessibilityRole="button"
          >
            <View style={[styles.selectorIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
              <Film size={32} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.selectorTitle, { color: colors.text }]}>
              Tap to select video
            </Text>
            <Text style={[styles.selectorSubtitle, { color: colors.textMuted }]}>
              MP4, MOV • Max 500MB
            </Text>
          </TouchableOpacity>

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
              💡 Tips for better videos
            </Text>
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              • Use clear, descriptive titles{'\n'}
              • Add relevant tags in description{'\n'}
              • Keep videos under 10 minutes for best engagement{'\n'}
              • Use good lighting and clear audio
            </Text>
          </View>
        </ScrollView>

        {/* Bottom toolbar */}
        {!keyboardVisible && (
          <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.toolbarButton}
              accessibilityLabel="Add image"
              accessibilityRole="button"
            >
              <ImageIcon size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              accessibilityLabel="Add emoji"
              accessibilityRole="button"
            >
              <Smile size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              accessibilityLabel="Add location"
              accessibilityRole="button"
            >
              <MapPin size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        )}
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
  },
  uploadButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  toolbarButton: {
    padding: SPACING.md,
  },
});

export const UploadModal = memo(UploadModalComponent);
