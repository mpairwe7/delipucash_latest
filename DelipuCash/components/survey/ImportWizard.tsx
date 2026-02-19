/**
 * Survey Import Wizard Component
 * CSV/Excel/JSON import wizard for bulk question creation (2025/2026)
 * 
 * Features:
 * - Step-by-step import flow
 * - File type detection and preview
 * - Column mapping for CSV/Excel
 * - Validation with clear error messages
 * - Editable preview before import
 * - Progress feedback during parsing
 * - Full accessibility support
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  FileJson,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SHADOWS,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import {
  autoMapColumns,
  isHighConfidence,
  getConfidenceLabel,
  type ColumnMapping,
  type TargetField,
} from '@/utils/columnAutoMapper';

// ============================================================================
// TYPES
// ============================================================================

type ImportFileType = 'json' | 'csv' | 'excel';
type ImportStep = 'select' | 'preview' | 'validate' | 'complete';

interface QuestionData {
  id: string;
  text: string;
  type: string;
  options: string[];
  required: boolean;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
  points?: number;
}

interface InvalidRow {
  rowIndex: number;
  reason: string;
  rawValues: string[];
}

interface ParsedImport {
  title?: string;
  description?: string;
  questions: QuestionData[];
  warnings: string[];
  errors: string[];
  /** Rows that failed per-row validation (partial import support) */
  invalidRows?: InvalidRow[];
  /** Auto-mapped column mappings (for CSV/TSV) */
  columnMappings?: ColumnMapping[];
}

interface ImportWizardProps {
  visible: boolean;
  onClose: () => void;
  onImport: (data: ParsedImport) => void;
}

// ============================================================================
// TEMPLATE CONTENT
// ============================================================================

const SAMPLE_JSON_TEMPLATE = {
  title: "Customer Feedback Survey",
  description: "Help us improve our services",
  questions: [
    { text: "How would you rate our service?", type: "rating", required: true, minValue: 1, maxValue: 5, points: 10 },
    { text: "Which features do you use most?", type: "checkbox", options: ["Speed", "Design", "Support"], required: true, points: 5 },
    { text: "Any additional feedback?", type: "paragraph", required: false, points: 0 },
  ],
};

const SAMPLE_CSV_TEMPLATE = `text,type,options,required,minValue,maxValue,points
"How would you rate our service?",rating,,true,1,5,10
"Which features do you use most?",checkbox,"Speed|Design|Support",true,,,5
"How did you hear about us?",dropdown,"Social Media|Friend|Search Engine",false,,,5
"Any additional feedback?",paragraph,,false,,,0`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
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

function detectDelimiter(content: string): ',' | '\t' | ';' {
  const firstLine = content.split('\n')[0] || '';
  let tabCount = 0, commaCount = 0, semicolonCount = 0;
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (char === '\t') tabCount++;
      else if (char === ',') commaCount++;
      else if (char === ';') semicolonCount++;
    }
  }

  if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

function isValidQuestionType(type: string): boolean {
  const validTypes = ['text', 'paragraph', 'radio', 'checkbox', 'dropdown', 'rating', 'boolean', 'date', 'time', 'number'];
  return validTypes.includes(type?.toLowerCase());
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ImportWizard: React.FC<ImportWizardProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedFileType, setSelectedFileType] = useState<ImportFileType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedImport | null>(null);

  const resetWizard = useCallback(() => {
    setStep('select');
    setSelectedFileType(null);
    setIsLoading(false);
    setParsedData(null);
  }, []);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  // ============================================================================
  // FILE PARSING
  // ============================================================================

  const parseJSONContent = useCallback((content: string): ParsedImport => {
    const cleanContent = stripBOM(content);
    const parsed = JSON.parse(cleanContent);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      errors.push('Invalid JSON format: missing "questions" array');
      return { questions: [], errors, warnings };
    }

    const questions: QuestionData[] = [];
    parsed.questions.forEach((q: Record<string, unknown>, index: number) => {
      if (!q.text) {
        warnings.push(`Question ${index + 1}: Missing question text`);
        return;
      }

      const type = String(q.type || 'text').toLowerCase();
      if (!isValidQuestionType(type)) {
        warnings.push(`Question ${index + 1}: Invalid type "${q.type}", defaulting to "text"`);
      }

      questions.push({
        id: `imported_${index + 1}`,
        text: String(q.text),
        type: isValidQuestionType(type) ? type : 'text',
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        required: Boolean(q.required),
        placeholder: q.placeholder ? String(q.placeholder) : undefined,
        minValue: typeof q.minValue === 'number' ? q.minValue : undefined,
        maxValue: typeof q.maxValue === 'number' ? q.maxValue : undefined,
        points: typeof q.points === 'number' ? q.points : undefined,
      });
    });

    return {
      title: parsed.title ? String(parsed.title) : undefined,
      description: parsed.description ? String(parsed.description) : undefined,
      questions,
      warnings,
      errors,
    };
  }, []);

  const parseSpreadsheetContent = useCallback((content: string): ParsedImport => {
    const cleanContent = normalizeLineEndings(stripBOM(content));
    const lines = cleanContent.split('\n').filter(line => line.trim());
    const errors: string[] = [];
    const warnings: string[] = [];
    const invalidRows: InvalidRow[] = [];

    if (lines.length < 2) {
      errors.push('File must have a header row and at least one data row');
      return { questions: [], errors, warnings, invalidRows };
    }

    const delimiter = detectDelimiter(cleanContent);
    const rawHeaders = parseCSVLine(lines[0], delimiter).map(h => h.replace(/['"]/g, '').trim());

    // Auto-map columns using intelligent matching
    const columnMappings = autoMapColumns(rawHeaders);

    // Build index lookup from auto-mapped results
    const fieldIndex = (field: TargetField): number => {
      const mapping = columnMappings.find(m => m.targetField === field);
      return mapping ? mapping.headerIndex : -1;
    };

    const textIndex = fieldIndex('text');
    const typeIndex = fieldIndex('type');
    const optionsIndex = fieldIndex('options');
    const requiredIndex = fieldIndex('required');
    const minValueIndex = fieldIndex('minValue');
    const maxValueIndex = fieldIndex('maxValue');
    const pointsIndex = fieldIndex('points');

    if (textIndex === -1) {
      errors.push('Missing required column: "text" or "question". No column could be auto-mapped.');
      return { questions: [], errors, warnings, invalidRows, columnMappings };
    }

    // Log low-confidence mappings as warnings
    columnMappings.forEach((m) => {
      if (m.targetField && !isHighConfidence(m.confidence)) {
        warnings.push(`Column "${m.headerText}" → "${m.targetField}" (${getConfidenceLabel(m.confidence)}) — verify mapping`);
      }
    });

    const questions: QuestionData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const text = values[textIndex]?.replace(/^["']|["']$/g, '').trim();

      if (!text) {
        invalidRows.push({ rowIndex: i + 1, reason: 'Empty question text', rawValues: values });
        continue;
      }

      const rawType = typeIndex !== -1 ? values[typeIndex]?.toLowerCase().trim() : 'text';
      const type = isValidQuestionType(rawType) ? rawType : 'text';
      if (typeIndex !== -1 && !isValidQuestionType(rawType)) {
        warnings.push(`Row ${i + 1}: Invalid type "${rawType}", using "text"`);
      }

      let options: string[] = [];
      if (optionsIndex !== -1 && values[optionsIndex]) {
        const optVal = values[optionsIndex].replace(/^["']|["']$/g, '');
        if (optVal.startsWith('[')) {
          try { options = JSON.parse(optVal); } catch { options = optVal.split('|').filter(Boolean); }
        } else {
          options = optVal.split('|').map(o => o.trim()).filter(Boolean);
        }
      }

      // Per-row validation: options required for multi-choice types
      if (['radio', 'checkbox', 'dropdown'].includes(type) && options.length < 2) {
        invalidRows.push({ rowIndex: i + 1, reason: `Type "${type}" requires at least 2 options`, rawValues: values });
        continue;
      }

      questions.push({
        id: `imported_${questions.length + 1}`,
        text,
        type,
        options,
        required: requiredIndex !== -1 ? values[requiredIndex]?.toLowerCase() === 'true' : false,
        minValue: minValueIndex !== -1 && values[minValueIndex] ? Number(values[minValueIndex]) : undefined,
        maxValue: maxValueIndex !== -1 && values[maxValueIndex] ? Number(values[maxValueIndex]) : undefined,
        points: pointsIndex !== -1 && values[pointsIndex] ? Number(values[pointsIndex]) || 0 : undefined,
      });
    }

    // Surface invalid row count as a warning
    if (invalidRows.length > 0) {
      warnings.push(`${invalidRows.length} row(s) skipped due to validation errors`);
    }

    return { questions, warnings, errors, invalidRows, columnMappings };
  }, []);

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  const handleFilePick = useCallback(async () => {
    if (!selectedFileType) return;

    setIsLoading(true);
    try {
      const mimeTypes: Record<ImportFileType, string[]> = {
        json: ['application/json'],
        csv: ['text/csv', 'text/comma-separated-values'],
        excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/tab-separated-values'],
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes[selectedFileType],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setIsLoading(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });

      let parsed: ParsedImport;
      if (selectedFileType === 'json') {
        parsed = parseJSONContent(content);
      } else {
        parsed = parseSpreadsheetContent(content);
      }

      setParsedData(parsed);
      setStep(parsed.errors.length > 0 ? 'validate' : 'preview');
      Haptics.notificationAsync(
        parsed.errors.length > 0
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    } catch (error) {
      Alert.alert('Import Error', 'Failed to parse file. Please check the format and try again.');
      console.error('[ImportWizard] Parse error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFileType, parseJSONContent, parseSpreadsheetContent]);

  const handleDownloadTemplate = useCallback(async (type: ImportFileType) => {
    try {
      let content: string;
      let fileName: string;
      let mimeType: string;

      if (type === 'json') {
        content = JSON.stringify(SAMPLE_JSON_TEMPLATE, null, 2);
        fileName = 'survey_template.json';
        mimeType = 'application/json';
      } else {
        content = SAMPLE_CSV_TEMPLATE;
        fileName = 'survey_template.csv';
        mimeType = 'text/csv';
      }

      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: `Download ${type.toUpperCase()} Template` });
      } else {
        Alert.alert('Template Ready', `Template saved to: ${fileUri}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to create template file.');
    }
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!parsedData || parsedData.questions.length === 0) {
      Alert.alert('No Questions', 'No valid questions to import.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onImport(parsedData);
    handleClose();
  }, [parsedData, onImport, handleClose]);

  const removeQuestion = useCallback((index: number) => {
    if (!parsedData) return;
    const newQuestions = parsedData.questions.filter((_, i) => i !== index);
    setParsedData({ ...parsedData, questions: newQuestions });
  }, [parsedData]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderFileTypeSelector = () => (
    <View style={styles.fileTypeContainer}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Choose Import Format
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
        Select the file format you want to import from
      </Text>

      {([
        { type: 'json', label: 'JSON', icon: <FileJson size={28} color={colors.primary} />, desc: 'Structured data format' },
        { type: 'csv', label: 'CSV', icon: <FileSpreadsheet size={28} color={colors.success} />, desc: 'Comma-separated values' },
        { type: 'excel', label: 'Excel/TSV', icon: <FileText size={28} color={colors.warning} />, desc: 'Spreadsheet formats' },
      ] as const).map((item) => (
        <TouchableOpacity
          key={item.type}
          style={[
            styles.fileTypeCard,
            {
              backgroundColor: selectedFileType === item.type
                ? withAlpha(colors.primary, 0.1)
                : colors.card,
              borderColor: selectedFileType === item.type ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            setSelectedFileType(item.type);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedFileType === item.type }}
          accessibilityLabel={`${item.label}: ${item.desc}`}
        >
          <View style={[styles.fileTypeIcon, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
            {item.icon}
          </View>
          <View style={styles.fileTypeText}>
            <Text style={[styles.fileTypeLabel, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.fileTypeDesc, { color: colors.textMuted }]}>{item.desc}</Text>
          </View>
          {selectedFileType === item.type && (
            <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
              <Check size={14} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Template download */}
      <View style={styles.templateSection}>
        <Text style={[styles.templateTitle, { color: colors.textSecondary }]}>
          Need a template?
        </Text>
        <View style={styles.templateButtons}>
          <TouchableOpacity
            style={[styles.templateBtn, { borderColor: colors.border }]}
            onPress={() => handleDownloadTemplate('json')}
            accessibilityRole="button"
            accessibilityLabel="Download JSON template"
          >
            <Download size={14} color={colors.primary} />
            <Text style={[styles.templateBtnText, { color: colors.primary }]}>JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.templateBtn, { borderColor: colors.border }]}
            onPress={() => handleDownloadTemplate('csv')}
            accessibilityRole="button"
            accessibilityLabel="Download CSV template"
          >
            <Download size={14} color={colors.success} />
            <Text style={[styles.templateBtnText, { color: colors.success }]}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Upload button */}
      <TouchableOpacity
        style={[
          styles.uploadBtn,
          {
            backgroundColor: selectedFileType ? colors.primary : withAlpha(colors.primary, 0.3),
          },
        ]}
        onPress={handleFilePick}
        disabled={!selectedFileType || isLoading}
        accessibilityRole="button"
        accessibilityLabel="Upload file"
        accessibilityState={{ disabled: !selectedFileType }}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Upload size={20} color="#FFF" />
            <Text style={styles.uploadBtnText}>Upload File</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPreview = () => {
    if (!parsedData) return null;
    const { invalidRows = [], columnMappings = [] } = parsedData;

    return (
      <View style={styles.previewContainer}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Review Import
        </Text>
        <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
          {parsedData.questions.length} questions ready to import
          {invalidRows.length > 0 ? ` (${invalidRows.length} skipped)` : ''}
        </Text>

        {/* Auto-mapping summary (CSV/TSV only) */}
        {columnMappings.length > 0 && (
          <View style={[styles.mappingBox, { backgroundColor: withAlpha(colors.info, 0.06), borderColor: withAlpha(colors.info, 0.15) }]}>
            <View style={styles.warningsHeader}>
              <Check size={16} color={colors.info} />
              <Text style={[styles.warningsTitle, { color: colors.info }]}>
                Column Mapping
              </Text>
            </View>
            {columnMappings.filter(m => m.targetField).map((m) => (
              <View key={m.headerIndex} style={styles.mappingRow}>
                <View style={[
                  styles.confidenceDot,
                  { backgroundColor: isHighConfidence(m.confidence) ? colors.success : colors.warning },
                ]} />
                <Text style={[styles.mappingText, { color: colors.text }]}>
                  "{m.headerText}" → {m.targetField}
                </Text>
                <Text style={[styles.mappingConfidence, { color: isHighConfidence(m.confidence) ? colors.success : colors.warning }]}>
                  {getConfidenceLabel(m.confidence)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Warnings */}
        {parsedData.warnings.length > 0 && (
          <View style={[styles.warningsBox, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
            <View style={styles.warningsHeader}>
              <AlertCircle size={16} color={colors.warning} />
              <Text style={[styles.warningsTitle, { color: colors.warning }]}>
                {parsedData.warnings.length} Warning{parsedData.warnings.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {parsedData.warnings.slice(0, 3).map((warning, index) => (
              <Text key={index} style={[styles.warningText, { color: colors.warning }]}>
                • {warning}
              </Text>
            ))}
            {parsedData.warnings.length > 3 && (
              <Text style={[styles.warningText, { color: colors.warning }]}>
                + {parsedData.warnings.length - 3} more
              </Text>
            )}
          </View>
        )}

        {/* Invalid rows (partial import) */}
        {invalidRows.length > 0 && (
          <View style={[styles.invalidRowsBox, { backgroundColor: withAlpha(colors.error, 0.05), borderColor: withAlpha(colors.error, 0.15) }]}>
            <View style={styles.warningsHeader}>
              <X size={16} color={colors.error} />
              <Text style={[styles.warningsTitle, { color: colors.error }]}>
                {invalidRows.length} Skipped Row{invalidRows.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {invalidRows.slice(0, 5).map((row) => (
              <Text key={row.rowIndex} style={[styles.warningText, { color: colors.error }]}>
                • Row {row.rowIndex}: {row.reason}
              </Text>
            ))}
            {invalidRows.length > 5 && (
              <Text style={[styles.warningText, { color: colors.error }]}>
                + {invalidRows.length - 5} more
              </Text>
            )}
          </View>
        )}

        {/* Questions list */}
        <FlatList
          data={parsedData.questions}
          keyExtractor={(item) => item.id}
          style={styles.questionsList}
          renderItem={({ item, index }) => (
            <View style={[styles.questionPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.questionNum, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <Text style={[styles.questionNumText, { color: colors.primary }]}>{index + 1}</Text>
              </View>
              <View style={styles.questionPreviewContent}>
                <Text style={[styles.questionPreviewText, { color: colors.text }]} numberOfLines={2}>
                  {item.text}
                </Text>
                <View style={styles.questionPreviewMeta}>
                  <View style={[styles.typeBadge, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
                    <Text style={[styles.typeBadgeText, { color: colors.info }]}>{item.type}</Text>
                  </View>
                  {item.required && (
                    <View style={[styles.requiredBadge, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
                      <Text style={[styles.requiredBadgeText, { color: colors.error }]}>Required</Text>
                    </View>
                  )}
                  {(item.points ?? 0) > 0 && (
                    <View style={[styles.typeBadge, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
                      <Text style={[styles.typeBadgeText, { color: colors.warning }]}>{item.points} pts</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => removeQuestion(index)}
                style={styles.removeQuestionBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove question ${index + 1}`}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyPreview}>
              <Text style={[styles.emptyPreviewText, { color: colors.textMuted }]}>
                No valid questions found
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderValidation = () => {
    if (!parsedData) return null;

    return (
      <View style={styles.validationContainer}>
        <View style={[styles.errorIcon, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
          <AlertCircle size={48} color={colors.error} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text, textAlign: 'center' }]}>
          Import Errors Found
        </Text>
        <Text style={[styles.stepDescription, { color: colors.textMuted, textAlign: 'center' }]}>
          Please fix the following issues and try again
        </Text>

        <View style={[styles.errorsBox, { backgroundColor: withAlpha(colors.error, 0.05) }]}>
          {parsedData.errors.map((error, index) => (
            <View key={index} style={styles.errorRow}>
              <X size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={step === 'select' ? handleClose : () => setStep('select')}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={step === 'select' ? 'Close' : 'Go back'}
          >
            {step === 'select' ? (
              <X size={24} color={colors.text} />
            ) : (
              <ChevronLeft size={24} color={colors.text} />
            )}
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'select' && 'Import Questions'}
            {step === 'preview' && 'Review Import'}
            {step === 'validate' && 'Fix Errors'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Step progress */}
        <View style={styles.progressSteps}>
          {(['select', 'preview'] as const).map((s, index) => (
            <React.Fragment key={s}>
              <View
                style={[
                  styles.progressDot,
                  {
                    backgroundColor:
                      step === s
                        ? colors.primary
                        : index < ['select', 'preview'].indexOf(step)
                        ? colors.success
                        : withAlpha(colors.text, 0.2),
                  },
                ]}
              >
                {index < ['select', 'preview'].indexOf(step) && (
                  <Check size={10} color="#FFF" />
                )}
              </View>
              {index < 1 && (
                <View
                  style={[
                    styles.progressLine,
                    {
                      backgroundColor:
                        index < ['select', 'preview'].indexOf(step)
                          ? colors.success
                          : withAlpha(colors.text, 0.2),
                    },
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 'select' && renderFileTypeSelector()}
          {step === 'preview' && renderPreview()}
          {step === 'validate' && renderValidation()}
        </ScrollView>

        {/* Footer */}
        {step === 'preview' && parsedData && parsedData.questions.length > 0 && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.primary }]}
              onPress={handleImportConfirm}
              accessibilityRole="button"
              accessibilityLabel={`Import ${parsedData.questions.length} questions`}
            >
              <Text style={styles.importBtnText}>
                Import {parsedData.questions.length} Questions
              </Text>
              <ChevronRight size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {step === 'validate' && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setStep('select')}
              accessibilityRole="button"
              accessibilityLabel="Try again with a different file"
            >
              <Text style={[styles.retryBtnText, { color: colors.text }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  // Progress steps
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLine: {
    width: 60,
    height: 2,
    marginHorizontal: SPACING.xs,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },

  // Step content
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    letterSpacing: -0.2,
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.lg,
  },

  // File type selector
  fileTypeContainer: {},
  fileTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  fileTypeIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTypeText: {
    flex: 1,
  },
  fileTypeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
  fileTypeDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Template section
  templateSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  templateTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  templateButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  templateBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Upload button
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
  },
  uploadBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
    color: '#FFF',
  },

  // Preview
  previewContainer: {
    flex: 1,
  },
  // Auto-mapping display
  mappingBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.md,
    marginTop: 2,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mappingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
  mappingConfidence: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },
  // Invalid rows (partial import)
  invalidRowsBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  warningsBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  warningsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  warningText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: SPACING.md,
  },
  questionsList: {
    flex: 1,
  },
  questionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  questionNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionPreviewContent: {
    flex: 1,
  },
  questionPreviewText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xxs,
  },
  questionPreviewMeta: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  typeBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },
  requiredBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  requiredBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },
  removeQuestionBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreview: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyPreviewText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Validation
  validationContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  errorsBox: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  errorText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Footer
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  importBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFF',
  },
  retryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  retryBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default ImportWizard;
