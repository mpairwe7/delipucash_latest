/**
 * File Upload Screen
 * Admin-only screen for bulk uploading questions via JSON/CSV/Excel
 * Supports all question types for Answer Questions & Earn feature
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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  ArrowLeft,
  CheckCircle,
  FileJson,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  Download,
  Info,
} from "lucide-react-native";
import React, { useState, useCallback } from "react";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

// ============================================================================
// TYPES
// ============================================================================

interface UploadedFile {
  name: string;
  type: 'json' | 'csv' | 'excel';
  size: number;
  uri: string;
}

/**
 * Question type detection based on options structure
 * Matches QuizQuestionType from types/index.ts
 */
type QuestionType = 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';

/**
 * Enhanced ParsedQuestion interface matching QuizQuestion structure
 * Supports all question types for Answer Questions & Earn feature
 */
interface ParsedQuestion {
  text: string;
  options: string[] | Record<string, string>;
  correctAnswer?: string | string[];
  category?: string;
  rewardAmount?: number;
  // Enhanced fields for different question types
  type?: QuestionType;
  difficulty?: 'easy' | 'medium' | 'hard';
  explanation?: string;
  timeLimit?: number; // seconds
  pointValue?: number;
}

// ============================================================================
// SAMPLE TEMPLATES
// ============================================================================

/**
 * Sample JSON template for question upload
 */
const SAMPLE_JSON_TEMPLATE = {
  questions: [
    {
      text: "What is the largest planet in our solar system?",
      options: ["Earth", "Mars", "Jupiter", "Saturn"],
      correctAnswer: "Jupiter",
      category: "Science",
      type: "single_choice",
      difficulty: "easy",
      explanation: "Jupiter is the largest planet in our solar system, with a mass more than twice that of all other planets combined.",
      pointValue: 10,
      timeLimit: 90
    },
    {
      text: "Is Python a compiled programming language?",
      options: ["True", "False"],
      correctAnswer: "False",
      type: "boolean",
      category: "Technology",
      difficulty: "medium",
      explanation: "Python is an interpreted language, not compiled. Code is executed line by line at runtime.",
      pointValue: 15,
      timeLimit: 60
    },
    {
      text: "Which of these are programming languages?",
      options: ["Python", "Excel", "JavaScript", "PowerPoint"],
      correctAnswer: ["Python", "JavaScript"],
      type: "multiple_choice",
      category: "Technology",
      difficulty: "easy",
      explanation: "Python and JavaScript are programming languages, while Excel and PowerPoint are applications.",
      pointValue: 20,
      timeLimit: 90
    },
    {
      text: "What is the capital city of Uganda?",
      options: ["Nairobi", "Kampala", "Dar es Salaam", "Kigali"],
      correctAnswer: "Kampala",
      category: "Geography",
      type: "single_choice",
      difficulty: "easy",
      pointValue: 10,
      timeLimit: 90
    },
    {
      text: "Explain the concept of machine learning in your own words.",
      options: [],
      type: "text",
      category: "Technology",
      difficulty: "hard",
      pointValue: 25,
      timeLimit: 180
    }
  ],
  metadata: {
    version: "1.0",
    description: "Sample quiz questions template for DelipuCash",
    createdAt: new Date().toISOString(),
    supportedTypes: ["single_choice", "multiple_choice", "boolean", "text"]
  }
};

/**
 * Sample CSV template content
 */
const SAMPLE_CSV_TEMPLATE = `text,options,correctAnswer,category,type,difficulty,explanation,pointValue,timeLimit
"What is the largest planet in our solar system?","Earth|Mars|Jupiter|Saturn","Jupiter","Science","single_choice","easy","Jupiter is the largest planet in our solar system","10","90"
"Is Python a compiled programming language?","True|False","False","Technology","boolean","medium","Python is an interpreted language, not compiled","15","60"
"What is the capital city of Uganda?","Nairobi|Kampala|Dar es Salaam|Kigali","Kampala","Geography","single_choice","easy","Kampala is the capital and largest city of Uganda","10","90"
"Which company owns Instagram?","Google|Microsoft|Meta|Twitter","Meta","Technology","single_choice","easy","Instagram was acquired by Facebook (now Meta) in 2012","10","90"
"What year did the first iPhone launch?","2005|2006|2007|2008","2007","Technology","single_choice","medium","The first iPhone was released on June 29, 2007","15","90"`;

/**
 * Sample Excel template as TSV (Tab-separated for easy import)
 * Excel can open TSV files directly
 */
const SAMPLE_EXCEL_TEMPLATE = `text\toptions\tcorrectAnswer\tcategory\ttype\tdifficulty\texplanation\tpointValue\ttimeLimit
What is the largest planet in our solar system?\tEarth|Mars|Jupiter|Saturn\tJupiter\tScience\tsingle_choice\teasy\tJupiter is the largest planet\t10\t90
Is Python a compiled programming language?\tTrue|False\tFalse\tTechnology\tboolean\tmedium\tPython is interpreted\t15\t60
What is the capital city of Uganda?\tNairobi|Kampala|Dar es Salaam|Kigali\tKampala\tGeography\tsingle_choice\teasy\tKampala is the capital\t10\t90
Which company owns Instagram?\tGoogle|Microsoft|Meta|Twitter\tMeta\tTechnology\tsingle_choice\teasy\tAcquired by Facebook in 2012\t10\t90
What year did the first iPhone launch?\t2005|2006|2007|2008\t2007\tTechnology\tsingle_choice\tmedium\tReleased June 29 2007\t15\t90`;

/**
 * Detect question type based on options structure
 */
function detectQuestionType(options: unknown, correctAnswer?: unknown): QuestionType {
  if (!options) return 'text';

  const optionsArray = Array.isArray(options)
    ? options
    : Object.values(options as Record<string, string>);

  // Check for boolean type
  if (optionsArray.length === 2) {
    const normalized = optionsArray.map(o => String(o).toLowerCase().trim());
    if (
      (normalized.includes('true') && normalized.includes('false')) ||
      (normalized.includes('yes') && normalized.includes('no'))
    ) {
      return 'boolean';
    }
  }

  // Check for multiple choice (multiple correct answers)
  if (Array.isArray(correctAnswer) && correctAnswer.length > 1) {
    return 'multiple_choice';
  }

  // Check for checkbox type (based on convention or metadata)
  if (optionsArray.length > 0) {
    return 'single_choice';
  }

  return 'text';
}

/**
 * Validate parsed question structure
 */
function validateQuestion(q: ParsedQuestion): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!q.text || q.text.trim().length < 5) {
    errors.push('Question text must be at least 5 characters');
  }

  const options = Array.isArray(q.options)
    ? q.options
    : Object.values(q.options || {});

  if (q.type !== 'text' && options.length < 2) {
    errors.push('At least 2 options are required for choice questions');
  }

  if (q.type !== 'text' && !q.correctAnswer) {
    errors.push('Correct answer is required');
  }

  if (q.correctAnswer) {
    const correctAnswers = Array.isArray(q.correctAnswer)
      ? q.correctAnswer
      : [q.correctAnswer];
    const optionValues = options.map(o => String(o).toLowerCase().trim());
    const optionKeys = !Array.isArray(q.options)
      ? Object.keys(q.options || {})
      : options.map((_, i) => String.fromCharCode(97 + i));

    for (const answer of correctAnswers) {
      const answerLower = String(answer).toLowerCase().trim();
      const isValidAnswer = optionValues.includes(answerLower) ||
        optionKeys.includes(answerLower);
      if (!isValidAnswer) {
        errors.push(`Correct answer "${answer}" must match one of the options`);
        break;
      }
    }
  }

  if (q.rewardAmount !== undefined && (isNaN(Number(q.rewardAmount)) || Number(q.rewardAmount) < 0)) {
    errors.push('Reward amount must be a positive number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse CSV content with proper handling of quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parse TSV/Excel content (tab-separated)
 */
function parseTSVLine(line: string): string[] {
  return line.split('\t').map(v => v.trim().replace(/^["']|["']$/g, ''));
}

/**
 * Detect delimiter in content (comma, tab, or semicolon)
 */
function detectDelimiter(content: string): ',' | '\t' | ';' {
  const firstLine = content.split('\n')[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;

  if (tabCount >= commaCount && tabCount >= semicolonCount) return '\t';
  if (semicolonCount >= commaCount) return ';';
  return ',';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [showTemplateSection, setShowTemplateSection] = useState(false);

  // Admin access check
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

  /**
   * Download sample template file
   */
  const handleDownloadTemplate = useCallback(async (templateType: 'json' | 'csv' | 'excel') => {
    setIsDownloading(true);
    try {
      let content: string;
      let fileName: string;
      let mimeType: string;

      switch (templateType) {
        case 'json':
          content = JSON.stringify(SAMPLE_JSON_TEMPLATE, null, 2);
          fileName = 'delipucash_questions_template.json';
          mimeType = 'application/json';
          break;
        case 'csv':
          content = SAMPLE_CSV_TEMPLATE;
          fileName = 'delipucash_questions_template.csv';
          mimeType = 'text/csv';
          break;
        case 'excel':
          content = SAMPLE_EXCEL_TEMPLATE;
          fileName = 'delipucash_questions_template.tsv';
          mimeType = 'text/tab-separated-values';
          break;
      }

      // Use document directory as a fallback safe location
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: 'utf8',
      });

      // Check if sharing is available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: `Save ${templateType.toUpperCase()} Template`,
          UTI: templateType === 'json' ? 'public.json' : 'public.comma-separated-values-text',
        });

        Alert.alert(
          "Template Ready",
          `Your ${templateType.toUpperCase()} template has been prepared. Open it with ${templateType === 'excel' ? 'Excel or Google Sheets' : templateType === 'json' ? 'a text editor' : 'Excel or any spreadsheet app'}.`,
          [{ text: "OK" }]
        );
      } else {
        // Fallback for platforms without sharing
        Alert.alert(
          "Template Created",
          `Template saved to: ${fileUri}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('[FileUpload] Error downloading template:', error);
      Alert.alert("Error", "Failed to create template file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, []);

  /**
   * Parse spreadsheet content (CSV, TSV, Excel-exported)
   */
  const parseSpreadsheetContent = useCallback((content: string, isExcel: boolean): ParsedQuestion[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const delimiter = detectDelimiter(content);
    const parseLine = delimiter === '\t' ? parseTSVLine : parseCSVLine;

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
    const questions: ParsedQuestion[] = [];
    const parseErrors: string[] = [];

    // Find column indices
    const textIndex = headers.findIndex(h => h === 'text' || h === 'question');
    const optionsIndex = headers.indexOf('options');
    const correctIndex = headers.findIndex(h => h === 'correctanswer' || h === 'answer' || h === 'correct_answer');
    const categoryIndex = headers.indexOf('category');
    const rewardIndex = headers.findIndex(h => h === 'rewardamount' || h === 'reward' || h === 'points' || h === 'pointvalue');
    const typeIndex = headers.indexOf('type');
    const difficultyIndex = headers.indexOf('difficulty');
    const explanationIndex = headers.indexOf('explanation');
    const timeLimitIndex = headers.findIndex(h => h === 'timelimit' || h === 'time_limit');

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);

      if (textIndex !== -1 && values[textIndex]) {
        // Parse options (pipe-separated or JSON array)
        let options: string[] = [];
        if (optionsIndex !== -1 && values[optionsIndex]) {
          const optVal = values[optionsIndex].replace(/^["']|["']$/g, '');
          if (optVal.startsWith('[')) {
            try {
              options = JSON.parse(optVal);
            } catch {
              options = optVal.split('|').map(o => o.trim());
            }
          } else {
            options = optVal.split('|').map(o => o.trim());
          }
        }

        const correctAnswer = correctIndex !== -1 ? values[correctIndex]?.replace(/^["']|["']$/g, '') : undefined;
        const questionType = typeIndex !== -1
          ? (values[typeIndex] as QuestionType)
          : detectQuestionType(options, correctAnswer);

        const question: ParsedQuestion = {
          text: values[textIndex].replace(/^["']|["']$/g, ''),
          options,
          correctAnswer,
          category: categoryIndex !== -1 ? values[categoryIndex]?.replace(/^["']|["']$/g, '') : undefined,
          rewardAmount: rewardIndex !== -1 && values[rewardIndex] ? Number(values[rewardIndex]) : undefined,
          type: questionType,
          difficulty: difficultyIndex !== -1 ? (values[difficultyIndex] as 'easy' | 'medium' | 'hard') : 'medium',
          explanation: explanationIndex !== -1 ? values[explanationIndex]?.replace(/^["']|["']$/g, '') : undefined,
          timeLimit: timeLimitIndex !== -1 && values[timeLimitIndex] ? Number(values[timeLimitIndex]) : 90,
        };

        const validation = validateQuestion(question);
        if (validation.valid) {
          questions.push(question);
        } else {
          parseErrors.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
        }
      }
    }

    if (parseErrors.length > 0) {
      setUploadError(`${parseErrors.length} row(s) had validation errors. First: ${parseErrors[0]}`);
    }

    return questions;
  }, []);

  const handleFilePick = async (fileType: 'json' | 'csv' | 'excel') => {
    try {
      setUploadError(null);

      // Define MIME types for each file format
      const mimeTypes: Record<string, string[]> = {
        json: ['application/json'],
        csv: ['text/csv', 'text/comma-separated-values'],
        excel: [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/tab-separated-values',
          'text/csv', // Excel can export as CSV
        ],
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[fileType],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const detectedType = file.name.endsWith('.json')
        ? 'json'
        : file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.tsv')
          ? 'excel'
          : 'csv';

      setUploadedFile({
        name: file.name,
        type: detectedType,
        size: file.size || 0,
        uri: file.uri,
      });

      // Parse the file
      setIsProcessing(true);
      try {
        const response = await fetch(file.uri);
        const content = await response.text();

        if (detectedType === 'json') {
          const parsed = JSON.parse(content);
          const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [];

          // Enhanced JSON parsing with type detection
          const questions: ParsedQuestion[] = rawQuestions.map((q: Record<string, unknown>) => {
            // Handle options in both array and object format
            let options: string[] | Record<string, string> = [];
            if (Array.isArray(q.options)) {
              options = q.options.map(String);
            } else if (q.options && typeof q.options === 'object') {
              options = q.options as Record<string, string>;
            }

            const correctAnswer = q.correctAnswer || q.answer;
            const questionType = (q.type as QuestionType) || detectQuestionType(options, correctAnswer);

            return {
              text: String(q.text || q.question || ''),
              options,
              correctAnswer: correctAnswer as string | string[],
              category: q.category as string | undefined,
              rewardAmount: q.rewardAmount ? Number(q.rewardAmount) : q.pointValue ? Number(q.pointValue) : undefined,
              type: questionType,
              difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
              explanation: q.explanation as string | undefined,
              timeLimit: q.timeLimit ? Number(q.timeLimit) : 90,
              pointValue: q.pointValue ? Number(q.pointValue) : q.rewardAmount ? Number(q.rewardAmount) : 10,
            };
          });

          // Validate all questions and filter out invalid ones
          const validQuestions = questions.filter(q => {
            const validation = validateQuestion(q);
            if (!validation.valid) {
              console.warn(`[FileUpload] Invalid question: "${q.text?.slice(0, 30)}..." - ${validation.errors.join(', ')}`);
            }
            return validation.valid;
          });

          setParsedQuestions(validQuestions);

          if (validQuestions.length < questions.length) {
            setUploadError(`${questions.length - validQuestions.length} question(s) had validation errors and were skipped`);
          }
        } else {
          // Parse CSV or Excel/TSV using the unified function
          const questions = parseSpreadsheetContent(content, detectedType === 'excel');
          setParsedQuestions(questions);
        }
      } catch (parseError) {
        console.error('[FileUpload] Parse error:', parseError);
        setUploadError(`Failed to parse ${detectedType.toUpperCase()} file. Please check the format matches our template.`);
        setParsedQuestions([]);
      }
      setIsProcessing(false);
    } catch (pickError) {
      console.error('[FileUpload] Pick error:', pickError);
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

  // Redirect non-admins (after all hooks)
  if (!userLoading && !isAdmin) {
    Alert.alert("Access Denied", "Only administrators can upload questions via file.", [
      { text: "OK", onPress: () => router.back() }
    ]);
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

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
            subtitle="Upload questions in bulk via JSON, CSV, or Excel"
            icon={<Upload size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
          />

          {/* File Type Selection - 3 options */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <View style={styles.fileTypeGrid}>
              {/* JSON */}
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
                  <FileJson size={28} color={colors.warning} strokeWidth={1.5} />
                </View>
                <Text style={[styles.fileTypeTitle, { color: colors.text }]}>JSON</Text>
                <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>
                  Structured data format
                </Text>
              </TouchableOpacity>

              {/* CSV */}
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
                  <FileSpreadsheet size={28} color={colors.success} strokeWidth={1.5} />
                </View>
                <Text style={[styles.fileTypeTitle, { color: colors.text }]}>CSV</Text>
                <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>
                  Comma-separated
                </Text>
              </TouchableOpacity>

              {/* Excel */}
              <TouchableOpacity
                style={[
                  styles.fileTypeCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => handleFilePick('excel')}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel="Upload Excel file"
                accessibilityHint="Select an Excel spreadsheet file containing questions to upload"
                accessibilityState={{ disabled: isProcessing }}
              >
                <View style={[styles.fileIconBg, { backgroundColor: withAlpha('#217346', 0.1) }]}>
                  <FileSpreadsheet size={28} color="#217346" strokeWidth={1.5} />
                </View>
                <Text style={[styles.fileTypeTitle, { color: colors.text }]}>Excel</Text>
                <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>
                  .xlsx, .xls, .tsv
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Download Templates Section */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <TouchableOpacity
              style={[styles.templateToggle, { backgroundColor: withAlpha(colors.primary, 0.08), borderColor: withAlpha(colors.primary, 0.2) }]}
              onPress={() => setShowTemplateSection(!showTemplateSection)}
              accessibilityRole="button"
              accessibilityLabel={showTemplateSection ? "Hide template downloads" : "Show template downloads"}
            >
              <View style={styles.templateToggleContent}>
                <Download size={20} color={colors.primary} strokeWidth={1.5} />
                <View style={styles.templateToggleText}>
                  <Text style={[styles.templateToggleTitle, { color: colors.text }]}>
                    Download Sample Templates
                  </Text>
                  <Text style={[styles.templateToggleSubtitle, { color: colors.textMuted }]}>
                    Get started quickly with our pre-formatted files
                  </Text>
                </View>
              </View>
              <View style={[styles.chevronContainer, { transform: [{ rotate: showTemplateSection ? '180deg' : '0deg' }] }]}>
                <ArrowLeft size={18} color={colors.textMuted} style={{ transform: [{ rotate: '-90deg' }] }} strokeWidth={1.5} />
              </View>
            </TouchableOpacity>

            {showTemplateSection && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[styles.templateSection, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.templateInfo}>
                  <Info size={16} color={colors.primary} strokeWidth={1.5} />
                  <Text style={[styles.templateInfoText, { color: colors.textMuted }]}>
                    Download a template, fill in your questions, then upload it above.
                  </Text>
                </View>

                <View style={styles.templateButtons}>
                  {/* JSON Template */}
                  <TouchableOpacity
                    style={[styles.templateButton, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: withAlpha(colors.warning, 0.3) }]}
                    onPress={() => handleDownloadTemplate('json')}
                    disabled={isDownloading}
                    accessibilityRole="button"
                    accessibilityLabel="Download JSON template"
                  >
                    <FileJson size={20} color={colors.warning} strokeWidth={1.5} />
                    <View style={styles.templateButtonText}>
                      <Text style={[styles.templateButtonTitle, { color: colors.text }]}>JSON Template</Text>
                      <Text style={[styles.templateButtonDesc, { color: colors.textMuted }]}>Full structure with metadata</Text>
                    </View>
                    <Download size={16} color={colors.warning} strokeWidth={1.5} />
                  </TouchableOpacity>

                  {/* CSV Template */}
                  <TouchableOpacity
                    style={[styles.templateButton, { backgroundColor: withAlpha(colors.success, 0.1), borderColor: withAlpha(colors.success, 0.3) }]}
                    onPress={() => handleDownloadTemplate('csv')}
                    disabled={isDownloading}
                    accessibilityRole="button"
                    accessibilityLabel="Download CSV template"
                  >
                    <FileSpreadsheet size={20} color={colors.success} strokeWidth={1.5} />
                    <View style={styles.templateButtonText}>
                      <Text style={[styles.templateButtonTitle, { color: colors.text }]}>CSV Template</Text>
                      <Text style={[styles.templateButtonDesc, { color: colors.textMuted }]}>Works with all spreadsheet apps</Text>
                    </View>
                    <Download size={16} color={colors.success} strokeWidth={1.5} />
                  </TouchableOpacity>

                  {/* Excel Template */}
                  <TouchableOpacity
                    style={[styles.templateButton, { backgroundColor: withAlpha('#217346', 0.1), borderColor: withAlpha('#217346', 0.3) }]}
                    onPress={() => handleDownloadTemplate('excel')}
                    disabled={isDownloading}
                    accessibilityRole="button"
                    accessibilityLabel="Download Excel template"
                  >
                    <FileSpreadsheet size={20} color="#217346" strokeWidth={1.5} />
                    <View style={styles.templateButtonText}>
                      <Text style={[styles.templateButtonTitle, { color: colors.text }]}>Excel Template</Text>
                      <Text style={[styles.templateButtonDesc, { color: colors.textMuted }]}>Tab-separated for Excel/Sheets</Text>
                    </View>
                    <Download size={16} color="#217346" strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>

                {isDownloading && (
                  <View style={styles.downloadingIndicator}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.downloadingText, { color: colors.textMuted }]}>Preparing template...</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>

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
                  ) : uploadedFile.type === 'excel' ? (
                    <FileSpreadsheet size={20} color="#217346" strokeWidth={1.5} />
                  ) : (
                        <FileSpreadsheet size={20} color={colors.success} strokeWidth={1.5} />
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
                        {parsedQuestions.length} questions validated
                      </Text>
                  </View>

                    {/* Question type summary */}
                    <View style={[styles.typeSummary, { backgroundColor: colors.secondary }]}>
                      {(() => {
                        const typeCounts = parsedQuestions.reduce((acc, q) => {
                          const type = q.type || 'single_choice';
                          acc[type] = (acc[type] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        return Object.entries(typeCounts).map(([type, count]) => (
                          <Text key={type} style={[styles.typeBadge, { color: colors.textMuted }]}>
                            {type.replace('_', ' ')}: {count}
                          </Text>
                        ));
                      })()}
                    </View>

                  <View style={styles.previewList}>
                    {parsedQuestions.slice(0, 3).map((q, index) => (
                      <View key={index} style={[styles.previewItem, { borderColor: colors.border }]}>
                        <View style={styles.previewItemHeader}>
                          <Text style={[styles.previewNumber, { color: colors.textMuted }]}>
                            {index + 1}.
                          </Text>
                          <View style={[styles.questionTypeBadge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                            <Text style={[styles.questionTypeText, { color: colors.primary }]}>
                              {(q.type || 'single_choice').replace('_', ' ')}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={2}>
                          {q.text}
                        </Text>
                        {q.category && (
                          <Text style={[styles.previewCategory, { color: colors.textMuted }]}>
                            Category: {q.category}
                          </Text>
                        )}
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
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SectionHeader
                title="File Format Guide"
                subtitle="Supports multiple question types for enhanced experience"
              />

              {/* JSON Format */}
              <View style={styles.formatSection}>
                <View style={styles.formatHeader}>
                  <FileJson size={16} color={colors.warning} strokeWidth={1.5} />
                  <Text style={[styles.formatTitle, { color: colors.text }]}>JSON Format (Recommended)</Text>
                </View>
                <View style={[styles.codeBlock, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.codeText, { color: colors.textMuted }]}>
                    {`{
  "questions": [
    {
      "text": "Question?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "category": "Science",
      "type": "single_choice",
      "difficulty": "medium",
      "pointValue": 10
    }
  ]
}`}
                  </Text>
                </View>
              </View>

              {/* CSV/Excel Format */}
              <View style={styles.formatSection}>
                <View style={styles.formatHeader}>
                  <FileSpreadsheet size={16} color={colors.success} strokeWidth={1.5} />
                  <Text style={[styles.formatTitle, { color: colors.text }]}>CSV / Excel Format</Text>
                </View>
                <View style={[styles.codeBlock, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.codeText, { color: colors.textMuted }]}>
                    {`text | options | correctAnswer | category | type | difficulty
"Question?" | "A|B|C|D" | "A" | "Science" | "single_choice" | "easy"`}
                  </Text>
                </View>
                <Text style={[styles.formatNote, { color: colors.textMuted }]}>
                  💡 Use pipe (|) to separate options. Excel can export as CSV or TSV.
                </Text>
              </View>

              {/* Supported Types */}
              <View style={styles.formatSection}>
                <Text style={[styles.formatTitle, { color: colors.text }]}>Supported Question Types:</Text>
                <View style={styles.typesList}>
                  <View style={[styles.typeRow, { backgroundColor: withAlpha(colors.primary, 0.05) }]}>
                    <View style={[styles.typeDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.typeLabel, { color: colors.text }]}>single_choice</Text>
                    <Text style={[styles.typeDesc, { color: colors.textMuted }]}>One correct answer</Text>
                  </View>
                  <View style={[styles.typeRow, { backgroundColor: withAlpha(colors.success, 0.05) }]}>
                    <View style={[styles.typeDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.typeLabel, { color: colors.text }]}>multiple_choice</Text>
                    <Text style={[styles.typeDesc, { color: colors.textMuted }]}>Multiple correct</Text>
                  </View>
                  <View style={[styles.typeRow, { backgroundColor: withAlpha(colors.warning, 0.05) }]}>
                    <View style={[styles.typeDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.typeLabel, { color: colors.text }]}>boolean</Text>
                    <Text style={[styles.typeDesc, { color: colors.textMuted }]}>True/False</Text>
                  </View>
                  <View style={[styles.typeRow, { backgroundColor: withAlpha(colors.textMuted, 0.05) }]}>
                    <View style={[styles.typeDot, { backgroundColor: colors.textMuted }]} />
                    <Text style={[styles.typeLabel, { color: colors.text }]}>text</Text>
                    <Text style={[styles.typeDesc, { color: colors.textMuted }]}>Open-ended</Text>
                  </View>
                </View>
              </View>

              {/* Column Reference */}
              <View style={styles.formatSection}>
                <Text style={[styles.formatTitle, { color: colors.text }]}>Available Columns:</Text>
                <View style={[styles.columnGrid, { borderColor: colors.border }]}>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.primary }]}>text *</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Question</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.primary }]}>options *</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Choices</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.primary }]}>correctAnswer *</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Answer</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>category</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Topic</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>type</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Question type</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>difficulty</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>easy/medium/hard</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>explanation</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Why correct</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>pointValue</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Points</Text>
                  </View>
                  <View style={styles.columnItem}>
                    <Text style={[styles.columnName, { color: colors.text }]}>timeLimit</Text>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>Seconds</Text>
                  </View>
                </View>
                <Text style={[styles.requiredNote, { color: colors.textMuted }]}>
                  * Required fields
                </Text>
              </View>
            </View>
          </Animated.View>

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
  fileTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
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
    gap: SPACING.sm,
  },
  previewItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  previewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  previewNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    width: 24,
  },
  previewText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.lg,
  },
  previewCategory: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: SPACING.lg,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  typeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  typeBadge: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    paddingHorizontal: SPACING.xs,
  },
  questionTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  questionTypeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'capitalize',
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
    marginTop: SPACING.lg,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  formatTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  formatNote: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  codeBlock: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: 'monospace',
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.6,
  },
  typesList: {
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },
  typeDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  typeItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  columnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  columnItem: {
    width: '33.33%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
  },
  columnName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  columnDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  requiredNote: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Template section styles
  templateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  templateToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  templateToggleText: {
    flex: 1,
  },
  templateToggleTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  templateToggleSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  chevronContainer: {
    padding: SPACING.xs,
  },
  templateSection: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  templateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  templateInfoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  templateButtons: {
    gap: SPACING.sm,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
  },
  templateButtonText: {
    flex: 1,
  },
  templateButtonTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  templateButtonDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  downloadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  downloadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
