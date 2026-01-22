/**
 * File Upload Screen
 * Admin-only screen for bulk uploading questions via JSON/CSV
 */

import {
  PrimaryButton,
  SectionHeader,
} from "@/components";
import { useBulkCreateQuestions } from "@/services/hooks";
import { UserRole } from "@/types";
import {
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  CheckCircle,
  FileJson,
  FileSpreadsheet,
  Upload,
  AlertCircle,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UploadedFile {
  name: string;
  type: 'json' | 'csv';
  size: number;
  uri: string;
}

interface ParsedQuestion {
  text: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
  rewardAmount?: number;
}

export default function FileUploadScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, loading: userLoading } = useUser();
  const bulkCreateMutation = useBulkCreateQuestions();

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Admin access check
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

  // Redirect non-admins
  if (!userLoading && !isAdmin) {
    Alert.alert("Access Denied", "Only administrators can upload questions via file.", [
      { text: "OK", onPress: () => router.back() }
    ]);
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  const handleFilePick = async (fileType: 'json' | 'csv') => {
    try {
      setUploadError(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: fileType === 'json' ? 'application/json' : 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setUploadedFile({
        name: file.name,
        type: fileType,
        size: file.size || 0,
        uri: file.uri,
      });

      // Parse the file
      setIsProcessing(true);
      try {
        const response = await fetch(file.uri);
        const content = await response.text();

        if (fileType === 'json') {
          const parsed = JSON.parse(content);
          const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
          setParsedQuestions(questions);
        } else {
          // Parse CSV
          const lines = content.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const questions: ParsedQuestion[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const textIndex = headers.indexOf('text') !== -1 ? headers.indexOf('text') : headers.indexOf('question');
            const optionsIndex = headers.indexOf('options');
            const correctIndex = headers.indexOf('correctanswer') !== -1 ? headers.indexOf('correctanswer') : headers.indexOf('answer');

            if (textIndex !== -1 && values[textIndex]) {
              questions.push({
                text: values[textIndex],
                options: optionsIndex !== -1 ? values[optionsIndex]?.split('|') || [] : [],
                correctAnswer: correctIndex !== -1 ? values[correctIndex] : undefined,
              });
            }
          }
          setParsedQuestions(questions);
        }
      } catch {
        setUploadError(`Failed to parse ${fileType.toUpperCase()} file. Please check the format.`);
        setParsedQuestions([]);
      }
      setIsProcessing(false);
    } catch {
      setUploadError("Failed to pick file. Please try again.");
      setIsProcessing(false);
    }
  };

  const handlePublish = async () => {
    if (parsedQuestions.length === 0) {
      Alert.alert("Error", "No questions to publish. Please upload a valid file.");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    try {
      const result = await bulkCreateMutation.mutateAsync({
        questions: parsedQuestions,
        userId: user.id,
      });

      Alert.alert(
        "Success",
        `${result.created} questions uploaded successfully!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to upload questions");
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setParsedQuestions([]);
    setUploadError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Upload Questions</Text>
          <View style={{ width: COMPONENT_SIZE.touchTarget }} />
        </View>

        <View style={styles.content}>
          <SectionHeader
            title="Select File Type"
            subtitle="Upload questions in bulk via JSON or CSV"
            icon={<Upload size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
          />

          {/* File Type Selection */}
          <View style={styles.fileTypeRow}>
            <TouchableOpacity
              style={[
                styles.fileTypeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => handleFilePick('json')}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel="Upload JSON file"
              accessibilityHint="Select a JSON file containing questions to upload"
              accessibilityState={{ disabled: isProcessing }}
            >
              <View style={[styles.fileIconBg, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
                <FileJson size={24} color={colors.warning} strokeWidth={1.5} />
              </View>
              <Text style={[styles.fileTypeTitle, { color: colors.text }]}>JSON File</Text>
              <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>
                Structured format with all fields
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fileTypeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => handleFilePick('csv')}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel="Upload CSV file"
              accessibilityHint="Select a CSV spreadsheet file containing questions to upload"
              accessibilityState={{ disabled: isProcessing }}
            >
              <View style={[styles.fileIconBg, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                <FileSpreadsheet size={24} color={colors.success} strokeWidth={1.5} />
              </View>
              <Text style={[styles.fileTypeTitle, { color: colors.text }]}>CSV File</Text>
              <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>
                Spreadsheet-friendly format
              </Text>
            </TouchableOpacity>
          </View>

          {/* Upload Error */}
          {uploadError && (
            <View style={[styles.errorCard, { backgroundColor: withAlpha(colors.error, 0.1), borderColor: colors.error }]}>
              <AlertCircle size={20} color={colors.error} strokeWidth={1.5} />
              <Text style={[styles.errorText, { color: colors.error }]}>{uploadError}</Text>
            </View>
          )}

          {/* Uploaded File Info */}
          {uploadedFile && (
            <View style={[styles.fileInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.fileInfoHeader}>
                <View style={[styles.fileIconBg, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  {uploadedFile.type === 'json' ? (
                    <FileJson size={20} color={colors.primary} strokeWidth={1.5} />
                  ) : (
                    <FileSpreadsheet size={20} color={colors.primary} strokeWidth={1.5} />
                  )}
                </View>
                <View style={styles.fileInfoText}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {uploadedFile.name}
                  </Text>
                  <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                    {formatFileSize(uploadedFile.size)} • {uploadedFile.type.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={clearFile} 
                  style={styles.clearButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove file"
                  accessibilityHint="Remove the uploaded file and clear parsed questions"
                >
                  <Text style={[styles.clearText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>

              {isProcessing ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.processingText, { color: colors.textMuted }]}>
                    Processing file...
                  </Text>
                </View>
              ) : parsedQuestions.length > 0 ? (
                <View style={[styles.previewContainer, { borderTopColor: colors.border }]}>
                  <View style={styles.previewHeader}>
                    <CheckCircle size={16} color={colors.success} strokeWidth={1.5} />
                    <Text style={[styles.previewTitle, { color: colors.success }]}>
                      {parsedQuestions.length} questions found
                    </Text>
                  </View>
                  <View style={styles.previewList}>
                    {parsedQuestions.slice(0, 3).map((q, index) => (
                      <View key={index} style={[styles.previewItem, { borderColor: colors.border }]}>
                        <Text style={[styles.previewNumber, { color: colors.textMuted }]}>
                          {index + 1}.
                        </Text>
                        <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={2}>
                          {q.text}
                        </Text>
                      </View>
                    ))}
                    {parsedQuestions.length > 3 && (
                      <Text style={[styles.moreText, { color: colors.textMuted }]}>
                        +{parsedQuestions.length - 3} more questions
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {/* Format Instructions */}
          <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader
              title="File Format"
              subtitle="Expected structure for your files"
            />

            <View style={styles.formatSection}>
              <Text style={[styles.formatTitle, { color: colors.text }]}>JSON Format:</Text>
              <View style={[styles.codeBlock, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.codeText, { color: colors.textMuted }]}>
                  {`[
  {
    "text": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "category": "General"
  }
]`}
                </Text>
              </View>
            </View>

            <View style={styles.formatSection}>
              <Text style={[styles.formatTitle, { color: colors.text }]}>CSV Format:</Text>
              <View style={[styles.codeBlock, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.codeText, { color: colors.textMuted }]}>
                  text,options,correctAnswer,category{"\n"}
                  &quot;Question text&quot;,&quot;A|B|C|D&quot;,&quot;A&quot;,&quot;General&quot;
                </Text>
              </View>
            </View>
          </View>

          {/* Publish Button */}
          {parsedQuestions.length > 0 && (
            <PrimaryButton
              title={`Publish ${parsedQuestions.length} Questions`}
              onPress={handlePublish}
              loading={isProcessing || bulkCreateMutation.isPending}
              style={{ marginTop: SPACING.lg }}
              accessibilityLabel={`Publish ${parsedQuestions.length} questions`}
              accessibilityHint="Upload all parsed questions to the database"
            />
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    gap: SPACING.lg,
  },
  fileTypeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  fileTypeCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fileIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTypeTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  fileTypeDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  fileInfoCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  fileInfoText: {
    flex: 1,
  },
  fileName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  fileSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  clearText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  processingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  previewContainer: {
    borderTopWidth: 1,
    padding: SPACING.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  previewList: {
    gap: SPACING.xs,
  },
  previewItem: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  previewNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    width: 24,
  },
  previewText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  moreText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  instructionsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  formatSection: {
    marginTop: SPACING.md,
  },
  formatTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  codeBlock: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: 'monospace',
  },
});
