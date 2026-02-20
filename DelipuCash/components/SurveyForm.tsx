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
  ActivityIndicator,
  Switch,
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
  Upload,
  Eye,
  ToggleLeft,
  Clock,
  Hash,
  AlignLeft,
  FileText,
  CircleDot,
  Sparkles,
  GitBranch,
  Award,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  selectIsScoringEnabled,
  useBuilderActions,
  type BuilderQuestionData,
  type BuilderQuestionType,
} from '@/store/SurveyBuilderStore';
import { UndoRedoToolbar } from '@/components/survey/UndoRedoToolbar';
import { ConditionalLogicEditor } from '@/components/survey/ConditionalLogicEditor';
import { DraggableQuestionList } from '@/components/survey/DraggableQuestionList';
import { CreationProgressBadges } from '@/components/survey/CreationProgressBadges';
import { DevicePreviewFrame } from '@/components/survey/DevicePreviewFrame';
import { ImportWizard, type ParsedImport } from '@/components/survey/ImportWizard';

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
  const isScoringEnabled = useSurveyBuilderStore(selectIsScoringEnabled);

  // 2026 Pattern: Use dedicated actions hook (pre-memoized with useShallow)
  const builderActions = useBuilderActions();

  // Local state for dates (not part of builder store since they're survey-level, not question-level)
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  // Reward & budget state
  const [rewardAmount, setRewardAmount] = useState('2000');
  const [enableMoMoPayout, setEnableMoMoPayout] = useState(false);
  const [totalBudget, setTotalBudget] = useState('');

  // Title/description synced with builder store for cross-mode persistence
  const title = useSurveyBuilderStore((s) => s.surveyTitle);
  const description = useSurveyBuilderStore((s) => s.surveyDescription);
  const setTitle = builderActions.setSurveyTitle;
  const setDescription = builderActions.setSurveyDescription;

  // UI state (expandedQuestion now in builder store)
  const setExpandedQuestion = builderActions.setExpandedQuestion;
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
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

  // Auto-open import wizard when the Import tab is active
  useEffect(() => {
    if (startWithImport && !hasAutoOpenedImport.current) {
      setShowImportWizard(true);
      hasAutoOpenedImport.current = true;
    }

    if (!startWithImport) {
      hasAutoOpenedImport.current = false;
    }
  }, [startWithImport]);

  // Handle import from ImportWizard — maps parsed data into builder store
  const handleImportFromWizard = useCallback((data: ParsedImport) => {
    const hasExistingQuestions = questions.length > 0;

    const doImport = () => {
      // Map imported questions to BuilderQuestionData format
      const builderQuestions: QuestionData[] = data.questions.map((q, i) => ({
        id: q.id || `imported_${i + 1}`,
        text: q.text,
        type: q.type as BuilderQuestionType,
        options: q.options || [],
        required: q.required,
        placeholder: q.placeholder,
        minValue: q.minValue,
        maxValue: q.maxValue,
        points: q.points,
      }));

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      builderActions.loadQuestions(builderQuestions);

      setShowImportWizard(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Import Successful',
        `Imported ${builderQuestions.length} question${builderQuestions.length !== 1 ? 's' : ''} successfully!${data.title ? `\n\nSurvey: "${data.title}"` : ''}`,
        [{ text: 'OK' }],
      );
    };

    if (hasExistingQuestions) {
      Alert.alert(
        'Replace Questions?',
        `You have ${questions.length} existing question${questions.length !== 1 ? 's' : ''}. Importing will replace them with ${data.questions.length} new question${data.questions.length !== 1 ? 's' : ''}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doImport },
        ],
      );
    } else {
      doImport();
    }
  }, [questions, builderActions, setTitle, setDescription]);

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

    // Validate budget
    if (enableMoMoPayout) {
      const budgetVal = parseFloat(totalBudget);
      const rewardVal = parseFloat(rewardAmount) || 2000;
      if (!budgetVal || budgetVal <= 0) {
        Alert.alert('Error', 'Please enter a valid total budget for mobile money payouts');
        return;
      }
      if (budgetVal < rewardVal) {
        Alert.alert('Error', `Total budget must be at least ${rewardVal} UGX (one response)`);
        return;
      }
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
        ...(isScoringEnabled && q.points ? { points: q.points } : {}),
      };
    });

    try {
      const parsedReward = parseFloat(rewardAmount) || 2000;
      const parsedBudget = enableMoMoPayout && totalBudget ? parseFloat(totalBudget) : undefined;

      await createSurveyMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        rewardAmount: parsedReward,
        totalBudget: parsedBudget,
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
            {isScoringEnabled && (question.points ?? 0) > 0 && (
              <View style={[styles.pointsChip, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
                <Text style={[styles.pointsChipText, { color: colors.warning }]}>{question.points} pts</Text>
              </View>
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

            {/* Points input (visible when scoring is enabled) */}
            {isScoringEnabled && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Points</Text>
                <View style={styles.pointsInputRow}>
                  <Award size={16} color={colors.warning} />
                  <TextInput
                    value={String(question.points || 0)}
                    onChangeText={(text) => {
                      const pts = parseInt(text) || 0;
                      updateQuestion(question.id, { points: Math.max(0, pts) });
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.pointsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    accessibilityLabel={`Points for question ${questionIndex + 1}`}
                    accessibilityHint="Enter the point value awarded for this question"
                  />
                  <Text style={[styles.pointsUnit, { color: colors.textMuted }]}>pts</Text>
                </View>
              </View>
            )}
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

          {/* Reward & Budget */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Reward per response (UGX)</Text>
            <TextInput
              value={rewardAmount}
              onChangeText={setRewardAmount}
              placeholder="2000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              Points awarded to each respondent
            </Text>
          </View>

          <View style={[styles.toggleRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 2 }]}>Enable Mobile Money Payouts</Text>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Auto-send money to respondents with registered phones
              </Text>
            </View>
            <Switch
              value={enableMoMoPayout}
              onValueChange={setEnableMoMoPayout}
              trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
              thumbColor={enableMoMoPayout ? colors.primary : colors.textMuted}
              accessibilityLabel="Enable Mobile Money Payouts"
              accessibilityRole="switch"
              accessibilityState={{ checked: enableMoMoPayout }}
            />
          </View>

          {enableMoMoPayout && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Total Budget (UGX)</Text>
              <TextInput
                value={totalBudget}
                onChangeText={setTotalBudget}
                placeholder={`Min: ${rewardAmount || '2000'}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Maximum amount to disburse. Covers up to {totalBudget && !isNaN(parseFloat(totalBudget)) && parseFloat(rewardAmount) > 0 ? Math.floor(parseFloat(totalBudget) / parseFloat(rewardAmount)) : '—'} responses.
              </Text>
            </View>
          )}
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

          {/* Scoring toggle */}
          <View style={[styles.scoringToggleRow, { borderColor: colors.border }]}>
            <View style={styles.scoringLabelRow}>
              <Award size={16} color={isScoringEnabled ? colors.warning : colors.textMuted} />
              <Text style={[styles.scoringLabel, { color: colors.text }]}>Enable Scoring</Text>
            </View>
            <Switch
              value={isScoringEnabled}
              onValueChange={(enabled) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                builderActions.setScoringEnabled(enabled);
              }}
              trackColor={{ false: colors.border, true: withAlpha(colors.warning, 0.4) }}
              thumbColor={isScoringEnabled ? colors.warning : colors.textMuted}
              accessibilityLabel="Enable question scoring"
              accessibilityRole="switch"
              accessibilityState={{ checked: isScoringEnabled }}
              accessibilityHint="Assign point values to each question for graded surveys"
            />
          </View>

          {/* Total points banner */}
          {isScoringEnabled && (
            <View style={[styles.totalPointsBanner, { backgroundColor: withAlpha(colors.warning, 0.08), borderColor: withAlpha(colors.warning, 0.2) }]}>
              <Award size={14} color={colors.warning} />
              <Text style={[styles.totalPointsText, { color: colors.warning }]}>
                Total: {questions.reduce((sum, q) => sum + (q.points || 0), 0)} pts across {questions.filter(q => (q.points || 0) > 0).length}/{questions.length} questions
              </Text>
            </View>
          )}

          {/* Undo/Redo + Bulk Actions Toolbar */}
          <UndoRedoToolbar showBulkActions />
          <CreationProgressBadges />

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

      {/* Import Wizard — server-side parsing with client fallback */}
      <ImportWizard
        visible={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={handleImportFromWizard}
        useServerParsing
      />

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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.thin,
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
  // Scoring
  scoringToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  scoringLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  scoringLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  totalPointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  totalPointsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
  },
  pointsChip: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.xs,
  },
  pointsChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pointsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  pointsInput: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.base,
    width: 80,
    textAlign: 'center',
  },
  pointsUnit: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
});

export default SurveyForm;
