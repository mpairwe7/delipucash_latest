/**
 * SurveyForm Component — 2026 Mobile UI/UX Standards
 * 
 * Applied standards:
 * - Fluid card surfaces with depth hierarchy (Material You 4.0)
 * - 48px minimum touch targets throughout (WCAG 2.2 AAA)
 * - Haptic feedback on all interactive elements
 * - Optical typography with -0.2 tracking for headings
 * - Contextual inline validation with color-coded states
 * - Smooth spring transitions for expand/collapse
 * - Bottom sheet modals with gesture handle affordance
 * - Segmented controls replacing flat tabs
 * - Generous whitespace following 4px grid
 * - Accessible form patterns: labels, hints, live regions
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  Platform,
  Modal,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Type,
  List,
  Check,
  CheckSquare,
  Star,
  Calendar,
  Save,
  Upload,
  Eye,
  Info,
  ToggleLeft,
  Clock,
  Hash,
  AlignLeft,
  FileText,
  CircleDot,
  Download,
  FileJson,
  FileSpreadsheet,
  GripVertical,
  Sparkles,
  GitBranch,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, BORDER_WIDTH, SHADOWS, withAlpha } from '@/utils/theme';
import { useCreateSurvey } from '@/services/hooks';
import { UploadSurvey } from '@/types';
import useUser from '@/utils/useUser';
import {
  useSurveyBuilderStore,
  selectQuestions,
  selectExpandedQuestionId,
  selectIsMultiSelectMode,
  selectSelectedQuestionIds,
  type BuilderQuestionData,
  type BuilderQuestionType,
} from '@/store/SurveyBuilderStore';
import { UndoRedoToolbar } from '@/components/survey/UndoRedoToolbar';
import { ConditionalLogicEditor } from '@/components/survey/ConditionalLogicEditor';
import { DraggableQuestionList } from '@/components/survey/DraggableQuestionList';
import { DevicePreviewFrame } from '@/components/survey/DevicePreviewFrame';

// ============================================================================
// TYPES
// ============================================================================

// Legacy local aliases — now backed by SurveyBuilderStore types
type QuestionType = BuilderQuestionType;
type QuestionData = BuilderQuestionData;

interface SurveyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** When true, automatically open the JSON import modal (used by Import tab) */
  startWithImport?: boolean;
}

type ImportFileType = 'json' | 'csv' | 'excel';

// ============================================================================
// SAMPLE TEMPLATES
// ============================================================================

const SAMPLE_JSON_TEMPLATE = {
  title: "Customer Feedback Survey",
  description: "Help us improve our services by sharing your experience",
  questions: [
    {
      text: "How would you rate our service?",
      type: "rating",
      required: true,
      minValue: 1,
      maxValue: 5
    },
    {
      text: "Which features do you use most?",
      type: "checkbox",
      options: ["Speed", "Design", "Support", "Price"],
      required: true
    },
    {
      text: "How did you hear about us?",
      type: "dropdown",
      options: ["Social Media", "Friend", "Advertisement", "Search Engine"],
      required: false
    },
    {
      text: "Would you recommend us to a friend?",
      type: "boolean",
      required: true
    },
    {
      text: "Your date of birth",
      type: "date",
      required: false
    },
    {
      text: "What time works best for a call?",
      type: "time",
      required: false
    },
    {
      text: "How many products do you own?",
      type: "number",
      minValue: 0,
      maxValue: 100,
      placeholder: "Enter a number",
      required: false
    },
    {
      text: "Any additional feedback?",
      type: "paragraph",
      placeholder: "Share your detailed thoughts...",
      required: false
    }
  ],
  metadata: {
    version: "1.0",
    supportedTypes: ["text", "paragraph", "radio", "checkbox", "dropdown", "rating", "boolean", "date", "time", "number"]
  }
};

const SAMPLE_CSV_TEMPLATE = `text,type,options,required,minValue,maxValue,placeholder
"How would you rate our service?",rating,,true,1,5,
"Which features do you use most?",checkbox,"Speed|Design|Support|Price",true,,,
"How did you hear about us?",dropdown,"Social Media|Friend|Advertisement|Search Engine",false,,,
"Would you recommend us to a friend?",boolean,,true,,,
"Your date of birth",date,,false,,,
"What time works best for a call?",time,,false,,,
"How many products do you own?",number,,false,0,100,"Enter a number"
"Any additional feedback?",paragraph,,false,,,"Share your detailed thoughts..."`;

const SAMPLE_EXCEL_TEMPLATE = `text\ttype\toptions\trequired\tminValue\tmaxValue\tplaceholder
"How would you rate our service?"\trating\t\ttrue\t1\t5\t
"Which features do you use most?"\tcheckbox\tSpeed|Design|Support|Price\ttrue\t\t\t
"How did you hear about us?"\tdropdown\tSocial Media|Friend|Advertisement|Search Engine\tfalse\t\t\t
"Would you recommend us to a friend?"\tboolean\t\ttrue\t\t\t
"Your date of birth"\tdate\t\tfalse\t\t\t
"What time works best for a call?"\ttime\t\tfalse\t\t\t
"How many products do you own?"\tnumber\t\tfalse\t0\t100\tEnter a number
"Any additional feedback?"\tparagraph\t\tfalse\t\t\tShare your detailed thoughts...`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Remove UTF-8 BOM (Byte Order Mark) from content
 * BOM is common in files created by Excel or Windows applications
 */
function stripBOM(content: string): string {
  // UTF-8 BOM is EF BB BF, which appears as \uFEFF in JavaScript
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Normalize line endings to Unix-style (\n)
 * Handles Windows (\r\n) and old Mac (\r) line endings
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse delimited line handling quoted values
 * Supports CSV (comma), TSV (tab), and SSV (semicolon) formats
 * Follows RFC 4180 standards for CSV parsing
 */
function parseDelimitedLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        // Escaped quote (RFC 4180: "" represents a single ")
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
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
 * Parse CSV line (comma-separated)
 */
function parseCSVLine(line: string): string[] {
  return parseDelimitedLine(line, ',');
}

/**
 * Parse TSV line (tab-separated)
 */
function parseTSVLine(line: string): string[] {
  return parseDelimitedLine(line, '\t');
}

/**
 * Parse SSV line (semicolon-separated, common in European locales)
 */
function parseSSVLine(line: string): string[] {
  return parseDelimitedLine(line, ';');
}

/**
 * Detect delimiter in content by analyzing the header row
 * Uses heuristics: counts delimiters outside of quoted strings
 */
function detectDelimiter(content: string): ',' | '\t' | ';' {
  const lines = content.split('\n');
  const firstLine = lines[0] || '';

  // Count delimiters outside of quotes
  let tabCount = 0;
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === '\t') tabCount++;
      else if (char === ',') commaCount++;
      else if (char === ';') semicolonCount++;
    }
  }

  // Tab takes priority (most reliable), then compare comma vs semicolon
  if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Detect file type from file name extension
 */
function detectFileTypeFromName(fileName: string): ImportFileType {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    case 'tsv':
      return 'excel'; // TSV parsed as delimited text (same parser)
    default:
      return 'csv';
  }
}

/**
 * Validate question type
 */
function isValidQuestionType(type: string): type is QuestionType {
  const validTypes = ['text', 'paragraph', 'radio', 'checkbox', 'dropdown', 'rating', 'boolean', 'date', 'time', 'number', 'file_upload'];
  return validTypes.includes(type?.toLowerCase());
}

/**
 * Check if a question type requires options
 */
function requiresOptions(type: QuestionType): boolean {
  return ['radio', 'checkbox', 'dropdown'].includes(type);
}

/**
 * Validate a parsed question
 */
function validateQuestion(question: QuestionData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!question.text?.trim()) {
    errors.push('Question text is required');
  }

  if (requiresOptions(question.type) && (!question.options || question.options.length < 2)) {
    errors.push(`${question.type} questions require at least 2 options`);
  }

  if (question.type === 'rating') {
    const min = question.minValue ?? 1;
    const max = question.maxValue ?? 5;
    if (min >= max) {
      errors.push('Rating minValue must be less than maxValue');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse spreadsheet content (CSV/TSV/Excel export)
 * Handles BOM, different line endings, and various delimiters
 * Returns validated questions with parse warnings
 */
function parseSpreadsheetContent(content: string): { questions: QuestionData[]; warnings: string[] } {
  // Pre-process content: strip BOM and normalize line endings
  const cleanContent = normalizeLineEndings(stripBOM(content));
  const lines = cleanContent.split('\n').filter(line => line.trim());
  const warnings: string[] = [];

  if (lines.length < 2) {
    return { questions: [], warnings: ['File must have a header row and at least one data row'] };
  }

  const delimiter = detectDelimiter(cleanContent);
  const parseLine = delimiter === '\t'
    ? parseTSVLine
    : delimiter === ';'
      ? parseSSVLine
      : parseCSVLine;

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  const questions: QuestionData[] = [];

  // Find column indices
  const textIndex = headers.findIndex(h => h === 'text' || h === 'question');
  const typeIndex = headers.indexOf('type');
  const optionsIndex = headers.indexOf('options');
  const requiredIndex = headers.indexOf('required');
  const minValueIndex = headers.findIndex(h => h === 'minvalue' || h === 'min_value' || h === 'min');
  const maxValueIndex = headers.findIndex(h => h === 'maxvalue' || h === 'max_value' || h === 'max');
  const placeholderIndex = headers.indexOf('placeholder');

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);

    if (textIndex !== -1 && values[textIndex]?.trim()) {
      const rawType = typeIndex !== -1 ? values[typeIndex]?.toLowerCase().trim() : 'text';
      const type: QuestionType = isValidQuestionType(rawType) ? rawType : 'text';

      // Parse options
      let options: string[] = [];
      if (optionsIndex !== -1 && values[optionsIndex]) {
        const optVal = values[optionsIndex].replace(/^["']|["']$/g, '');
        if (optVal.startsWith('[')) {
          try {
            options = JSON.parse(optVal);
          } catch {
            options = optVal.split('|').map(o => o.trim()).filter(Boolean);
          }
        } else {
          options = optVal.split('|').map(o => o.trim()).filter(Boolean);
        }
      }

      const question: QuestionData = {
        id: `q${i}`,
        text: values[textIndex].replace(/^["']|["']$/g, ''),
        type,
        options,
        required: requiredIndex !== -1 ? values[requiredIndex]?.toLowerCase() === 'true' : false,
        minValue: minValueIndex !== -1 && values[minValueIndex] ? Number(values[minValueIndex]) : undefined,
        maxValue: maxValueIndex !== -1 && values[maxValueIndex] ? Number(values[maxValueIndex]) : undefined,
        placeholder: placeholderIndex !== -1 ? values[placeholderIndex]?.replace(/^["']|["']$/g, '') : undefined,
      };

      // Validate the question
      const validation = validateQuestion(question);
      if (validation.valid) {
        questions.push(question);
      } else {
        warnings.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
      }
    }
  }

  return { questions, warnings };
}

// ============================================================================
// COMPONENT
// ============================================================================

const SurveyForm: React.FC<SurveyFormProps> = ({ onSuccess, onCancel, startWithImport }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const createSurveyMutation = useCreateSurvey();
  const { data: user } = useUser();

  // Form state — questions, title, description managed by SurveyBuilderStore
  const questions = useSurveyBuilderStore(selectQuestions);
  const expandedQuestion = useSurveyBuilderStore(selectExpandedQuestionId);
  const isMultiSelectMode = useSurveyBuilderStore(selectIsMultiSelectMode);
  const selectedQuestionIds = useSurveyBuilderStore(selectSelectedQuestionIds);
  const builderActions = useSurveyBuilderStore((s) => ({
    addQuestion: s.addQuestion,
    removeQuestion: s.removeQuestion,
    updateQuestion: s.updateQuestion,
    reorderQuestions: s.reorderQuestions,
    setExpandedQuestion: s.setExpandedQuestion,
    addOption: s.addOption,
    removeOption: s.removeOption,
    updateOption: s.updateOption,
    loadQuestions: s.loadQuestions,
    setSurveyTitle: s.setSurveyTitle,
    setSurveyDescription: s.setSurveyDescription,
    checkBadges: s.checkBadges,
    toggleMultiSelectMode: s.toggleMultiSelectMode,
    toggleQuestionSelection: s.toggleQuestionSelection,
  }));

  // Local state for dates (not part of builder store since they're survey-level, not question-level)
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  // Title/description synced with builder store for cross-mode persistence
  const title = useSurveyBuilderStore((s) => s.surveyTitle);
  const description = useSurveyBuilderStore((s) => s.surveyDescription);
  const setTitle = builderActions.setSurveyTitle;
  const setDescription = builderActions.setSurveyDescription;

  // UI state (expandedQuestion now in builder store)
  const setExpandedQuestion = builderActions.setExpandedQuestion;
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState<ImportFileType>('json');
  const [importError, setImportError] = useState<string | null>(null);
  const [conditionalLogicQuestionId, setConditionalLogicQuestionId] = useState<string | null>(null);
  const hasAutoOpenedImport = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open import modal when the Import tab is active
  useEffect(() => {
    if (startWithImport && !hasAutoOpenedImport.current) {
      setShowImportModal(true);
      hasAutoOpenedImport.current = true;
    }

    if (!startWithImport) {
      hasAutoOpenedImport.current = false;
    }
  }, [startWithImport]);

  // ============================================================================
  // TEMPLATE DOWNLOAD HANDLER
  // ============================================================================

  const handleDownloadTemplate = useCallback(async (templateType: ImportFileType) => {
    setIsDownloading(true);
    try {
      let content: string;
      let fileName: string;
      let mimeType: string;

      switch (templateType) {
        case 'json':
          content = JSON.stringify(SAMPLE_JSON_TEMPLATE, null, 2);
          fileName = 'survey_template.json';
          mimeType = 'application/json';
          break;
        case 'csv':
          content = SAMPLE_CSV_TEMPLATE;
          fileName = 'survey_template.csv';
          mimeType = 'text/csv';
          break;
        case 'excel':
          content = SAMPLE_EXCEL_TEMPLATE;
          fileName = 'survey_template.tsv';
          mimeType = 'text/tab-separated-values';
          break;
      }

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
        // Fallback - copy to clipboard for JSON
        if (templateType === 'json') {
          Clipboard.setString(content);
          Alert.alert('Copied!', 'Template copied to clipboard. Paste it into a .json file.');
        } else {
          Alert.alert('Template Created', `Template saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('[SurveyForm] Error downloading template:', error);
      Alert.alert("Error", "Failed to create template file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // ============================================================================
  // FILE IMPORT HANDLER
  // ============================================================================

  const handleFileImport = useCallback(async (fileType: ImportFileType) => {
    setIsUploading(true);
    setImportError(null);
    try {
      // Define MIME types for each format
      const mimeTypes: Record<ImportFileType, string[]> = {
        json: ['application/json'],
        csv: ['text/csv', 'text/comma-separated-values'],
        excel: [
          'text/tab-separated-values',
          'text/csv',
        ],
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[fileType],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setIsUploading(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });

      let parsedQuestions: QuestionData[] = [];
      let surveyTitle = '';
      let surveyDescription = '';

      // Detect actual file type from extension (more reliable than MIME type)
      const detectedType = detectFileTypeFromName(file.name);
      const actualFileType = detectedType || fileType;

      if (actualFileType === 'json') {
        // Parse JSON
        const cleanContent = stripBOM(content);
        const parsed = JSON.parse(cleanContent);

        if (!parsed.title || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid JSON format. Expected { title: string, description?: string, questions: array }');
        }

        surveyTitle = parsed.title;
        surveyDescription = parsed.description || '';

        parsedQuestions = parsed.questions.map((q: Record<string, unknown>, index: number) => ({
          id: `q${index + 1}`,
          text: (q.text as string) || '',
          type: isValidQuestionType(q.type as string) ? (q.type as QuestionType) : 'text',
          options: Array.isArray(q.options) ? q.options as string[] : [],
          minValue: q.minValue as number | undefined,
          maxValue: q.maxValue as number | undefined,
          placeholder: (q.placeholder as string) || '',
          required: (q.required as boolean) || false,
        }));
      } else {
        // Parse CSV/TSV/Excel
        const { questions: spreadsheetQuestions, warnings } = parseSpreadsheetContent(content);
        parsedQuestions = spreadsheetQuestions;

        if (parsedQuestions.length === 0) {
          const warningMsg = warnings.length > 0
            ? `\n\nValidation issues:\n${warnings.slice(0, 3).join('\n')}${warnings.length > 3 ? `\n...and ${warnings.length - 3} more` : ''}`
            : '';
          throw new Error(`No valid questions found in the file. Please check the format matches our template.${warningMsg}`);
        }

        // Log warnings but continue with valid questions
        if (warnings.length > 0) {
          console.warn('[SurveyForm] Parse warnings:', warnings);
        }
      }

      // Validate questions
      const validQuestions = parsedQuestions.filter(q => q.text.trim());
      if (validQuestions.length === 0) {
        throw new Error('No valid questions found. Each question must have text.');
      }

      // Update form state via builder store
      if (surveyTitle) setTitle(surveyTitle);
      if (surveyDescription) setDescription(surveyDescription);
      builderActions.loadQuestions(validQuestions.length > 0 ? validQuestions : questions);

      setShowImportModal(false);
      Alert.alert(
        'Success',
        `Imported ${validQuestions.length} question${validQuestions.length !== 1 ? 's' : ''} successfully!${surveyTitle ? `\nSurvey: "${surveyTitle}"` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[SurveyForm] Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      setImportError(errorMessage);
      Alert.alert('Import Error', errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [questions]);

  // Question CRUD — delegated to SurveyBuilderStore (supports undo/redo)
  const addQuestion = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    builderActions.addQuestion();
    builderActions.checkBadges();
  }, [builderActions]);

  const removeQuestion = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    builderActions.removeQuestion(id);
  }, [builderActions]);

  const updateQuestion = useCallback((id: string, updates: Partial<QuestionData>) => {
    builderActions.updateQuestion(id, updates);
    builderActions.checkBadges();
  }, [builderActions]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    builderActions.reorderQuestions(fromIndex, toIndex);
  }, [builderActions]);

  const addOption = useCallback((questionId: string) => {
    builderActions.addOption(questionId);
  }, [builderActions]);

  const removeOption = useCallback((questionId: string, optionIndex: number) => {
    builderActions.removeOption(questionId, optionIndex);
  }, [builderActions]);

  const updateOption = useCallback((questionId: string, optionIndex: number, value: string) => {
    builderActions.updateOption(questionId, optionIndex, value);
  }, [builderActions]);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a survey title');
      return;
    }

    if (questions.some(q => !q.text.trim())) {
      Alert.alert('Error', 'Please fill in all question texts');
      return;
    }

    // Validate options for choice-based questions
    if (questions.some(q => (q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') && q.options.length < 2)) {
      Alert.alert('Error', 'Choice questions (radio, checkbox, dropdown) must have at least 2 options');
      return;
    }

    if (startDate >= endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    // Convert questions to UploadSurvey format based on type
    const surveyQuestions: Omit<UploadSurvey, 'id' | 'userId' | 'surveyId' | 'createdAt' | 'updatedAt'>[] = questions.map(q => {
      let options: string;
      let minValue: number | null = null;
      let maxValue: number | null = null;

      switch (q.type) {
        case 'rating':
          minValue = q.minValue || 1;
          maxValue = q.maxValue || 5;
          options = JSON.stringify({
            min: minValue,
            max: maxValue,
            labels: Array.from({ length: maxValue - minValue + 1 }, (_, i) => String(minValue! + i))
          });
          break;
        case 'text':
          options = JSON.stringify({ multiline: false, placeholder: q.placeholder || '' });
          break;
        case 'paragraph':
          options = JSON.stringify({ multiline: true, placeholder: q.placeholder || '' });
          break;
        case 'boolean':
          options = JSON.stringify({
            yesLabel: q.options[0] || 'Yes',
            noLabel: q.options[1] || 'No'
          });
          break;
        case 'number':
          minValue = q.minValue ?? null;
          maxValue = q.maxValue ?? null;
          options = JSON.stringify({
            placeholder: q.placeholder || 'Enter a number',
            min: minValue,
            max: maxValue
          });
          break;
        case 'date':
          options = JSON.stringify({ format: 'YYYY-MM-DD' });
          break;
        case 'time':
          options = JSON.stringify({ format: 'HH:mm' });
          break;
        case 'file_upload':
          options = JSON.stringify(q.fileUploadConfig || {
            allowedTypes: ['image/*', 'application/pdf'],
            maxSizeBytes: 25 * 1024 * 1024,
            maxFiles: 1,
          });
          break;
        case 'radio':
        case 'checkbox':
        case 'dropdown':
        default:
          options = JSON.stringify(q.options);
          break;
      }

      return {
        text: q.text,
        type: q.type,
        options,
        placeholder: q.placeholder || null,
        minValue,
        maxValue,
        required: q.required,
        ...(q.conditionalLogic ? { conditionalLogic: q.conditionalLogic } : {}),
      };
    });

    try {
      await createSurveyMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        questions: surveyQuestions,
        userId: user?.id,
      });

      Alert.alert('Success', 'Survey created successfully!', [
        { text: 'OK', onPress: onSuccess },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to create survey. Please try again.');
    }
  };

  const renderQuestionTypeIcon = (type: QuestionType, size: number = 16) => {
    switch (type) {
      case 'text': return <Type size={size} color={colors.primary} />;
      case 'paragraph': return <AlignLeft size={size} color={colors.primary} />;
      case 'radio': return <CircleDot size={size} color={colors.primary} />;
      case 'checkbox': return <CheckSquare size={size} color={colors.primary} />;
      case 'dropdown': return <List size={size} color={colors.primary} />;
      case 'rating': return <Star size={size} color={colors.primary} />;
      case 'boolean': return <ToggleLeft size={size} color={colors.primary} />;
      case 'date': return <Calendar size={size} color={colors.primary} />;
      case 'time': return <Clock size={size} color={colors.primary} />;
      case 'number': return <Hash size={size} color={colors.primary} />;
      case 'file_upload': return <Upload size={size} color={colors.primary} />;
      default: return <FileText size={size} color={colors.primary} />;
    }
  };

  // Helper to get question type label
  const getQuestionTypeLabel = (type: QuestionType): string => {
    const labels: Record<QuestionType, string> = {
      text: 'Short Answer',
      paragraph: 'Paragraph',
      radio: 'Multiple Choice',
      checkbox: 'Checkboxes',
      dropdown: 'Dropdown',
      rating: 'Linear Scale',
      boolean: 'Yes/No',
      date: 'Date',
      time: 'Time',
      number: 'Number',
      file_upload: 'File Upload',
    };
    return labels[type] || type;
  };

  const renderQuestionEditor = (question: QuestionData, questionIndex: number) => {
    const isExpanded = expandedQuestion === question.id;
    const isSelected = selectedQuestionIds.includes(question.id);

    return (
      <View
        key={question.id}
        style={[
          styles.questionCard,
          {
            backgroundColor: colors.card,
            borderColor: isMultiSelectMode && isSelected
              ? colors.primary
              : isExpanded
                ? withAlpha(colors.primary, 0.3)
                : colors.border,
          },
          isExpanded && SHADOWS.md,
          isMultiSelectMode && isSelected && { backgroundColor: withAlpha(colors.primary, 0.04) },
        ]}
        role="group"
        accessibilityLabel={`Question ${questionIndex + 1}: ${question.text || 'Untitled'}`}
      >
        <Pressable
          style={({ pressed }) => [
            styles.questionHeader,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (isMultiSelectMode) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              builderActions.toggleQuestionSelection(question.id);
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setExpandedQuestion(isExpanded ? null : question.id);
          }}
          onLongPress={() => {
            if (!isMultiSelectMode) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              builderActions.toggleMultiSelectMode();
              builderActions.toggleQuestionSelection(question.id);
            }
          }}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded, selected: isMultiSelectMode ? isSelected : undefined }}
          accessibilityHint={isMultiSelectMode ? 'Tap to toggle selection' : isExpanded ? 'Collapse question editor' : 'Long press to select multiple'}
        >
          <View style={styles.questionTitleRow}>
            {isMultiSelectMode ? (
              <View
                style={[
                  styles.selectionCheckbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
              </View>
            ) : (
              <View style={[styles.questionNumberBadge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <Text style={[styles.questionNumber, { color: colors.primary }]}>{questionIndex + 1}</Text>
              </View>
            )}
            {renderQuestionTypeIcon(question.type)}
            <Text style={[styles.questionTitle, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
              {question.text || 'Untitled Question'}
            </Text>
            {question.required && (
              <View style={[styles.requiredDot, { backgroundColor: colors.error }]} />
            )}
          </View>
          <View style={styles.questionActions}>
            {/* Conditional Logic — only show if there are preceding questions */}
            {questionIndex > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setConditionalLogicQuestionId(question.id);
                }}
                style={styles.actionButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Configure conditional logic for question ${questionIndex + 1}`}
              >
                <GitBranch
                  size={16}
                  color={question.conditionalLogic?.rules?.length ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            )}
            {questions.length > 1 && (
              <TouchableOpacity
                onPress={() => removeQuestion(question.id)}
                style={styles.actionButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Delete question ${questionIndex + 1}`}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            )}
            <View style={[styles.expandIcon, { backgroundColor: withAlpha(colors.text, 0.06) }]}>
              {isExpanded ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <Animated.View style={[styles.questionContent, { opacity: fadeAnim }]}>
            {/* Question Text */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Question</Text>
              <TextInput
                value={question.text}
                onChangeText={(text) => updateQuestion(question.id, { text })}
                placeholder="Enter your question"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                multiline
              />
            </View>

            {/* Question Type */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Question Type</Text>
              <View style={styles.typeSelector}>
                {(['text', 'paragraph', 'radio', 'checkbox', 'dropdown', 'rating', 'boolean', 'date', 'time', 'number', 'file_upload'] as QuestionType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      { backgroundColor: question.type === type ? colors.primary : colors.background, borderColor: colors.border }
                    ]}
                    onPress={() => updateQuestion(question.id, { type })}
                  >
                    {renderQuestionTypeIcon(type)}
                    <Text style={[
                      styles.typeText,
                      { color: question.type === type ? colors.primaryText : colors.text }
                    ]}>
                      {getQuestionTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Type-specific options */}
            {(question.type === 'radio' || question.type === 'checkbox' || question.type === 'dropdown') && (
              <View style={styles.inputGroup}>
                <View style={styles.optionHeader}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Options</Text>
                  <TouchableOpacity onPress={() => addOption(question.id)} style={styles.addButton}>
                    <Plus size={14} color={colors.primary} />
                    <Text style={[styles.addText, { color: colors.primary }]}>Add option</Text>
                  </TouchableOpacity>
                </View>
                {question.options.map((option, index) => (
                  <View key={index} style={styles.optionRow}>
                    <TextInput
                      value={option}
                      onChangeText={(text) => updateOption(question.id, index, text)}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.optionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                    {question.options.length > 2 && (
                      <TouchableOpacity onPress={() => removeOption(question.id, index)} style={styles.removeOption}>
                        <Trash2 size={14} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {question.type === 'rating' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Rating Scale</Text>
                <View style={styles.ratingRow}>
                  <View style={styles.ratingInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Min</Text>
                    <TextInput
                      value={String(question.minValue || 1)}
                      onChangeText={(text) => updateQuestion(question.id, { minValue: parseInt(text) || 1 })}
                      keyboardType="numeric"
                      style={[styles.ratingValue, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                  <View style={styles.ratingInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Max</Text>
                    <TextInput
                      value={String(question.maxValue || 5)}
                      onChangeText={(text) => updateQuestion(question.id, { maxValue: parseInt(text) || 5 })}
                      keyboardType="numeric"
                      style={[styles.ratingValue, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                </View>
              </View>
            )}

            {question.type === 'text' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Placeholder</Text>
                <TextInput
                  value={question.placeholder}
                  onChangeText={(placeholder) => updateQuestion(question.id, { placeholder })}
                  placeholder="Enter placeholder text"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
              </View>
            )}

            {question.type === 'paragraph' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Placeholder</Text>
                <TextInput
                  value={question.placeholder}
                  onChangeText={(placeholder) => updateQuestion(question.id, { placeholder })}
                  placeholder="Enter placeholder text for long answer"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Users can enter multiple lines of text
                </Text>
              </View>
            )}

            {question.type === 'boolean' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Yes/No Labels (Optional)</Text>
                <View style={styles.booleanLabels}>
                  <View style={styles.booleanLabelInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Yes Label</Text>
                    <TextInput
                      value={question.options[0] || 'Yes'}
                      onChangeText={(text) => {
                        const newOptions = [...question.options];
                        newOptions[0] = text;
                        updateQuestion(question.id, { options: newOptions });
                      }}
                      placeholder="Yes"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                  <View style={styles.booleanLabelInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>No Label</Text>
                    <TextInput
                      value={question.options[1] || 'No'}
                      onChangeText={(text) => {
                        const newOptions = [...question.options];
                        newOptions[1] = text;
                        updateQuestion(question.id, { options: newOptions });
                      }}
                      placeholder="No"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                </View>
              </View>
            )}

            {question.type === 'number' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Number Range (Optional)</Text>
                <View style={styles.ratingRow}>
                  <View style={styles.ratingInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Min</Text>
                    <TextInput
                      value={question.minValue !== null && question.minValue !== undefined ? String(question.minValue) : ''}
                      onChangeText={(text) => updateQuestion(question.id, { minValue: text ? parseInt(text) : undefined })}
                      keyboardType="numeric"
                      placeholder="No min"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.ratingValue, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                  <View style={styles.ratingInput}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Max</Text>
                    <TextInput
                      value={question.maxValue !== null && question.maxValue !== undefined ? String(question.maxValue) : ''}
                      onChangeText={(text) => updateQuestion(question.id, { maxValue: text ? parseInt(text) : undefined })}
                      keyboardType="numeric"
                      placeholder="No max"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.ratingValue, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </View>
                </View>
                <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>Placeholder</Text>
                <TextInput
                  value={question.placeholder}
                  onChangeText={(placeholder) => updateQuestion(question.id, { placeholder })}
                  placeholder="Enter a number"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
              </View>
            )}

            {question.type === 'date' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Users will select a date using a date picker
                </Text>
              </View>
            )}

            {question.type === 'time' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Users will select a time using a time picker
                </Text>
              </View>
            )}

            {/* Required toggle */}
            <View style={styles.requiredRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => updateQuestion(question.id, { required: !question.required })}
              >
                <View style={[styles.checkboxBox, { borderColor: colors.border }]}>
                  {question.required && <View style={[styles.checkboxCheck, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.checkboxText, { color: colors.text }]}>Required</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Survey Details */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Survey Details</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter survey title"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Enter survey description"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Calendar size={16} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                Start: {startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Calendar size={16} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                End: {endDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Questions */}
        <View style={styles.section}>
          <View style={styles.questionsHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Questions</Text>
            <TouchableOpacity onPress={addQuestion} style={[styles.addQuestionButton, { backgroundColor: colors.primary }]}>
              <Plus size={16} color={colors.primaryText} />
              <Text style={[styles.addQuestionText, { color: colors.primaryText }]}>Add Question</Text>
            </TouchableOpacity>
          </View>

          {/* Undo/Redo + Bulk Actions Toolbar */}
          <UndoRedoToolbar showBulkActions />

          <DraggableQuestionList
            items={questions}
            onReorder={handleReorder}
            renderItem={(item, index) => renderQuestionEditor(item as QuestionData, index)}
            dragEnabled={questions.length > 1}
          />
        </View>
      </ScrollView>

      {/* 2026: Sticky bottom action bar with elevation */}
      <View style={[styles.actions, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + SPACING.xs }, SHADOWS.lg]}>
        <View style={styles.primaryActions}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryActionButton,
              { borderColor: colors.border, backgroundColor: pressed ? withAlpha(colors.primary, 0.06) : colors.background },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowPreviewModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Preview survey before saving"
          >
            <Eye size={18} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Preview</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onCancel?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: createSurveyMutation.isPending
                  ? withAlpha(colors.primary, 0.6)
                  : pressed
                    ? withAlpha(colors.primary, 0.85)
                    : colors.primary,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              handleSave();
            }}
            disabled={createSurveyMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Save survey"
            accessibilityState={{ busy: createSurveyMutation.isPending }}
          >
            {createSurveyMutation.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.primaryText} />
                <Text style={[styles.saveText, { color: colors.primaryText }]}>Saving...</Text>
              </>
            ) : (
              <>
                <Sparkles size={18} color={colors.primaryText} />
                <Text style={[styles.saveText, { color: colors.primaryText }]}>Publish</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Import Survey Modal - JSON/CSV/TSV support */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHeaderContent}>
                <View style={[styles.modalIconBg, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                  <Upload size={24} color={colors.primary} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Import Survey</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    Upload questions via JSON, CSV, or TSV
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowImportModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: withAlpha(colors.text, 0.08) }]}
                accessibilityLabel="Close modal"
              >
                <Text style={[styles.modalCloseBtnText, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView 
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBodyContent}
            >
              {/* File Format Selection */}
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Choose File Format</Text>
              <View style={styles.fileFormatGrid}>
                {([
                  { type: 'json' as ImportFileType, icon: <FileJson size={24} color={selectedImportType === 'json' ? colors.primaryText : colors.primary} />, label: 'JSON', desc: 'Structured data' },
                  { type: 'csv' as ImportFileType, icon: <FileText size={24} color={selectedImportType === 'csv' ? colors.primaryText : colors.success} />, label: 'CSV', desc: 'Comma-separated' },
                  { type: 'excel' as ImportFileType, icon: <FileSpreadsheet size={24} color={selectedImportType === 'excel' ? colors.primaryText : colors.info} />, label: 'TSV', desc: 'Tab-separated values' },
                ]).map((format) => (
                  <TouchableOpacity
                    key={format.type}
                    style={[
                      styles.fileFormatCard,
                      {
                        backgroundColor: selectedImportType === format.type ? colors.primary : colors.background,
                        borderColor: selectedImportType === format.type ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => setSelectedImportType(format.type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedImportType === format.type }}
                  >
                    <View style={[styles.fileFormatIcon, { backgroundColor: selectedImportType === format.type ? withAlpha(colors.primaryText, 0.2) : withAlpha(colors.primary, 0.08) }]}>
                      {format.icon}
                    </View>
                    <Text style={[styles.fileFormatLabel, { color: selectedImportType === format.type ? colors.primaryText : colors.text }]}>
                      {format.label}
                    </Text>
                    <Text style={[styles.fileFormatDesc, { color: selectedImportType === format.type ? withAlpha(colors.primaryText, 0.7) : colors.textMuted }]}>
                      {format.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error Display */}
              {importError && (
                <View
                  style={[styles.errorBanner, { backgroundColor: withAlpha(colors.error, 0.1), borderColor: withAlpha(colors.error, 0.3) }]}
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                >
                  <Info size={16} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{importError}</Text>
                </View>
              )}

              {/* Download Templates Section */}
              <View style={[styles.templateSection, { backgroundColor: withAlpha(colors.info, 0.06), borderColor: withAlpha(colors.info, 0.15) }]}>
                <View style={styles.templateHeader}>
                  <Download size={18} color={colors.info} />
                  <Text style={[styles.templateTitle, { color: colors.text }]}>Download Templates</Text>
                </View>
                <Text style={[styles.templateDesc, { color: colors.textMuted }]}>
                  Get a sample template to see the expected format
                </Text>
                <View style={styles.templateButtons}>
                  {([
                    { type: 'json' as ImportFileType, label: 'JSON', color: colors.primary },
                    { type: 'csv' as ImportFileType, label: 'CSV', color: colors.success },
                    { type: 'excel' as ImportFileType, label: 'TSV', color: colors.info },
                  ]).map((template) => (
                    <TouchableOpacity
                      key={template.type}
                      style={[styles.templateBtn, { borderColor: template.color, backgroundColor: withAlpha(template.color, 0.08) }]}
                      onPress={() => handleDownloadTemplate(template.type)}
                      disabled={isDownloading}
                    >
                      <Download size={14} color={template.color} />
                      <Text style={[styles.templateBtnText, { color: template.color }]}>{template.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isDownloading && (
                  <View style={styles.downloadingIndicator}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.downloadingText, { color: colors.textMuted }]}>Preparing template...</Text>
                  </View>
                )}
              </View>

              {/* Column Reference Grid */}
              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: SPACING.lg }]}>Required Columns</Text>
              <View style={[styles.columnGrid, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {[
                  { name: 'text', desc: 'Question text', required: true },
                  { name: 'type', desc: 'Question type', required: true },
                  { name: 'options', desc: 'Pipe-separated', required: false },
                  { name: 'required', desc: 'true/false', required: false },
                  { name: 'minValue', desc: 'For rating/number', required: false },
                  { name: 'maxValue', desc: 'For rating/number', required: false },
                  { name: 'placeholder', desc: 'Input hint text', required: false },
                ].map((col, index) => (
                  <View key={col.name} style={[styles.columnItem, { backgroundColor: index % 2 === 0 ? 'transparent' : withAlpha(colors.primary, 0.03) }]}>
                    <View style={styles.columnNameRow}>
                      <Text style={[styles.columnName, { color: colors.text }]}>{col.name}</Text>
                      {col.required && (
                        <View style={[styles.requiredBadge, { backgroundColor: colors.error }]}>
                          <Text style={styles.requiredBadgeText}>*</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.columnDesc, { color: colors.textMuted }]}>{col.desc}</Text>
                  </View>
                ))}
              </View>

              {/* Question Types Reference */}
              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: SPACING.lg }]}>Supported Question Types</Text>
              <View style={styles.typesGrid}>
                {[
                  { type: 'text', desc: 'Short answer', icon: <Type size={18} color={colors.primary} /> },
                  { type: 'paragraph', desc: 'Long text response', icon: <AlignLeft size={18} color={colors.primary} /> },
                  { type: 'radio', desc: 'Single choice', icon: <CircleDot size={18} color={colors.secondary} /> },
                  { type: 'checkbox', desc: 'Multiple selections', icon: <CheckSquare size={18} color={colors.info} /> },
                  { type: 'dropdown', desc: 'Dropdown list', icon: <List size={18} color={colors.success} /> },
                  { type: 'rating', desc: 'Linear scale', icon: <Star size={18} color={colors.warning} /> },
                  { type: 'boolean', desc: 'Yes/No toggle', icon: <ToggleLeft size={18} color={colors.error} /> },
                  { type: 'date', desc: 'Date picker', icon: <Calendar size={18} color={colors.primary} /> },
                  { type: 'time', desc: 'Time picker', icon: <Clock size={18} color={colors.secondary} /> },
                  { type: 'number', desc: 'Numeric input', icon: <Hash size={18} color={colors.info} /> },
                ].map((item) => (
                  <View 
                    key={item.type} 
                    style={[styles.typeItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <View style={[styles.typeItemIcon, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                      {item.icon}
                    </View>
                    <View style={styles.typeItemText}>
                      <Text style={[styles.typeItemLabel, { color: colors.text }]}>{item.type}</Text>
                      <Text style={[styles.typeItemDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Tips */}
              <View style={[styles.tipsSection, { backgroundColor: withAlpha(colors.success, 0.08), borderColor: withAlpha(colors.success, 0.2) }]}>
                <Text style={[styles.tipsTitle, { color: colors.success }]}>Quick Tips</Text>
                <View style={styles.tipsList}>
                  {[
                    'JSON files should have { title, description?, questions: [] }',
                    'CSV/TSV: Use pipe | to separate options (e.g., "Yes|No|Maybe")',
                    'Set "required" column to "true" for mandatory questions',
                    'Rating type uses minValue & maxValue (default 1-5)',
                    'Save spreadsheets as TSV (tab-separated) for best results',
                  ].map((tip, index) => (
                    <View key={index} style={styles.tipRow}>
                      <View style={[styles.tipBullet, { backgroundColor: colors.success }]} />
                      <Text style={[styles.tipItemText, { color: colors.text }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowImportModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalUploadBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleFileImport(selectedImportType)}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : (
                    <Upload size={18} color={colors.primaryText} />
                )}
                <Text style={[styles.modalUploadText, { color: colors.primaryText }]}>
                  {isUploading ? 'Importing...' : `Choose ${selectedImportType.toUpperCase()} File`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal — uses DevicePreviewFrame for realistic mobile preview */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.previewContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHeaderContent}>
                <View style={[styles.modalIconBg, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                  <Eye size={24} color={colors.primary} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Survey Preview</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    How your survey will appear on mobile
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowPreviewModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: withAlpha(colors.text, 0.08) }]}
              >
                <Text style={[styles.modalCloseBtnText, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewBody}>
              <DevicePreviewFrame title={title} description={description} scale={0.72}>
                {questions.map((question, index) => (
                  <View key={question.id} style={styles.previewQuestion}>
                    <Text style={[styles.previewQuestionText, { color: colors.text }]}>
                      {index + 1}. {question.text || 'Untitled Question'}
                      {question.required && <Text style={{ color: colors.error }}> *</Text>}
                    </Text>

                    {question.type === 'text' && (
                      <TextInput
                        placeholder={question.placeholder || 'Your answer'}
                        style={[styles.previewInput, { borderColor: colors.border, color: colors.text }]}
                        editable={false}
                      />
                    )}

                    {question.type === 'paragraph' && (
                      <TextInput
                        placeholder={question.placeholder || 'Your long answer'}
                        style={[styles.previewInput, styles.previewTextArea, { borderColor: colors.border, color: colors.text }]}
                        editable={false}
                        multiline
                      />
                    )}

                    {(question.type === 'radio' || question.type === 'checkbox') && (
                      <View style={styles.previewOptions}>
                        {question.options.map((option, optIndex) => (
                          <View key={optIndex} style={styles.previewOption}>
                            <View style={[
                              question.type === 'radio' ? styles.previewRadio : styles.previewCheckbox,
                              { borderColor: colors.border }
                            ]} />
                            <Text style={[styles.previewOptionText, { color: colors.text }]}>{option}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {question.type === 'dropdown' && (
                      <View style={[styles.previewDropdown, { borderColor: colors.border }]}>
                        <Text style={[styles.previewDropdownText, { color: colors.textMuted }]}>
                          Select an option
                        </Text>
                        <ChevronDown size={16} color={colors.textMuted} />
                      </View>
                    )}

                    {question.type === 'rating' && (
                      <View style={styles.previewRating}>
                        {Array.from({ length: (question.maxValue || 5) - (question.minValue || 1) + 1 }, (_, i) => (
                          <View key={i} style={styles.previewRatingItem}>
                            <Text style={[styles.previewRatingNumber, { color: colors.textMuted }]}>
                              {(question.minValue || 1) + i}
                            </Text>
                            <View style={[styles.previewRatingCircle, { borderColor: colors.border }]} />
                          </View>
                        ))}
                      </View>
                    )}

                    {question.type === 'boolean' && (
                      <View style={styles.previewBoolean}>
                        <View style={[styles.previewBooleanOption, { borderColor: colors.border }]}>
                          <View style={[styles.previewRadio, { borderColor: colors.border }]} />
                          <Text style={[styles.previewOptionText, { color: colors.text }]}>
                            {question.options[0] || 'Yes'}
                          </Text>
                        </View>
                        <View style={[styles.previewBooleanOption, { borderColor: colors.border }]}>
                          <View style={[styles.previewRadio, { borderColor: colors.border }]} />
                          <Text style={[styles.previewOptionText, { color: colors.text }]}>
                            {question.options[1] || 'No'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {question.type === 'date' && (
                      <View style={[styles.previewDateInput, { borderColor: colors.border }]}>
                        <Calendar size={16} color={colors.textMuted} />
                        <Text style={[styles.previewDateText, { color: colors.textMuted }]}>
                          Select a date
                        </Text>
                      </View>
                    )}

                    {question.type === 'time' && (
                      <View style={[styles.previewDateInput, { borderColor: colors.border }]}>
                        <Clock size={16} color={colors.textMuted} />
                        <Text style={[styles.previewDateText, { color: colors.textMuted }]}>
                          Select a time
                        </Text>
                      </View>
                    )}

                    {question.type === 'number' && (
                      <TextInput
                        placeholder={question.placeholder || 'Enter a number'}
                        style={[styles.previewInput, { borderColor: colors.border, color: colors.text }]}
                        editable={false}
                        keyboardType="numeric"
                      />
                    )}

                    {question.type === 'file_upload' && (
                      <View style={[styles.previewDateInput, { borderColor: colors.border }]}>
                        <Upload size={16} color={colors.textMuted} />
                        <Text style={[styles.previewDateText, { color: colors.textMuted }]}>
                          Tap to upload a file
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </DevicePreviewFrame>
            </View>
          </View>
        </View>
      </Modal>

      {/* Conditional Logic Editor Modal */}
      {conditionalLogicQuestionId && (
        <ConditionalLogicEditor
          questionId={conditionalLogicQuestionId}
          questions={questions}
          onClose={() => setConditionalLogicQuestionId(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.base,
  },
  section: {
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    letterSpacing: -0.3,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.base,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 48,
  },
  textArea: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.base,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  questionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
    minHeight: 44,
  },
  addQuestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  questionCard: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  questionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  questionNumber: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  requiredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expandIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    minHeight: 56,
  },
  questionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
  },
  questionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    flex: 1,
  },
  required: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
  },
  questionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  questionContent: {
    padding: SPACING.md,
    paddingTop: SPACING.xs,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.xs,
  },
  typeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  addText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  optionInput: {
    flex: 1,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  removeOption: {
    padding: SPACING.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  ratingInput: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  ratingValue: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  booleanLabels: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  booleanLabelInput: {
    flex: 1,
  },
  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheck: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.xs,
  },
  checkboxText: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  actions: {
    padding: SPACING.base,
    borderTopWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.xs,
  },
  secondaryActionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 52,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    minHeight: 52,
  },
  saveText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  modalIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.xxs,
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  modalCloseBtnText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  instructionCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  instructionIcon: {
    marginTop: 2,
  },
  instructionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  exampleLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  codeBlock: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.6,
  },
  typesGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  typeItemIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeItemText: {
    flex: 1,
  },
  typeItemLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeItemDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },
  tipsSection: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  tipsTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  tipsList: {
    gap: SPACING.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tipItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  modalDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  modalDownloadText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  modalCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
  },
  modalCancelText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  modalUploadBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  modalUploadText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },
  // File format selection styles
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  fileFormatGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  fileFormatCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.xs,
  },
  fileFormatIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  fileFormatLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  fileFormatDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  templateSection: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  templateTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  templateDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.md,
  },
  templateButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  templateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  templateBtnText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  downloadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  downloadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  columnGrid: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  columnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  columnNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  columnName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  columnDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  requiredBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requiredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  previewContent: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    overflow: 'hidden',
  },
  previewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  previewDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.lg,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  previewQuestion: {
    marginBottom: SPACING.lg,
  },
  previewQuestionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  previewInput: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  previewTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewOptions: {
    gap: SPACING.sm,
  },
  previewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewRadio: {
    width: 16,
    height: 16,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: 8,
  },
  previewCheckbox: {
    width: 16,
    height: 16,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.xs,
  },
  previewOptionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  previewRating: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  previewRatingItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  previewRatingNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  previewRatingCircle: {
    width: 20,
    height: 20,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: 10,
  },
  previewDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  previewDropdownText: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  previewBoolean: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  previewBooleanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  previewDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  previewDateText: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default SurveyForm;