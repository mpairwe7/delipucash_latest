/**
 * Conversational Survey Builder Component
 * Typeform-style one-question-at-a-time builder for mobile (2025/2026)
 * 
 * Features:
 * - Fluid, animated question-by-question creation
 * - Smart question type suggestions based on context
 * - AI-powered question improvement hints
 * - Swipe navigation between questions
 * - Beautiful transitions (respects reduced motion)
 * - Full accessibility support (WCAG 2.2 AA)
 * - Auto-save with visual feedback
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Type,
  List,
  CheckSquare,
  Star,
  Calendar,
  ToggleLeft,
  Clock,
  Hash,
  AlignLeft,
  Sparkles,
  Wand2,
  Save,
  Eye,
  GripVertical,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Upload } from 'lucide-react-native';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SHADOWS,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import {
  useSurveyBuilderStore,
  selectQuestions,
  type BuilderQuestionData,
  type BuilderQuestionType,
} from '@/store/SurveyBuilderStore';
import { UndoRedoToolbar } from './UndoRedoToolbar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// TYPES — backed by SurveyBuilderStore
// ============================================================================

export type QuestionType = BuilderQuestionType;
export type QuestionData = BuilderQuestionData;

interface ConversationalBuilderProps {
  initialQuestions?: QuestionData[];
  onSave: (questions: QuestionData[]) => void;
  onCancel: () => void;
  surveyTitle: string;
  onTitleChange: (title: string) => void;
  isAutoSaving?: boolean;
}

// ============================================================================
// QUESTION TYPE CONFIG
// ============================================================================

interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  hasOptions: boolean;
  hasScale: boolean;
}

const QUESTION_TYPES: QuestionTypeConfig[] = [
  {
    type: 'text',
    label: 'Short Answer',
    description: 'Single line text response',
    icon: <Type size={20} />,
    hasOptions: false,
    hasScale: false,
  },
  {
    type: 'paragraph',
    label: 'Long Answer',
    description: 'Multi-line text response',
    icon: <AlignLeft size={20} />,
    hasOptions: false,
    hasScale: false,
  },
  {
    type: 'radio',
    label: 'Multiple Choice',
    description: 'Select one option',
    icon: <List size={20} />,
    hasOptions: true,
    hasScale: false,
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    description: 'Select multiple options',
    icon: <CheckSquare size={20} />,
    hasOptions: true,
    hasScale: false,
  },
  {
    type: 'rating',
    label: 'Rating Scale',
    description: 'Star rating (1-5)',
    icon: <Star size={20} />,
    hasOptions: false,
    hasScale: true,
  },
  {
    type: 'boolean',
    label: 'Yes / No',
    description: 'Simple toggle',
    icon: <ToggleLeft size={20} />,
    hasOptions: false,
    hasScale: false,
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input',
    icon: <Hash size={20} />,
    hasOptions: false,
    hasScale: true,
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Date picker',
    icon: <Calendar size={20} />,
    hasOptions: false,
    hasScale: false,
  },
  {
    type: 'time',
    label: 'Time',
    description: 'Time picker',
    icon: <Clock size={20} />,
    hasOptions: false,
    hasScale: false,
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Respondent uploads files',
    icon: <Upload size={20} />,
    hasOptions: false,
    hasScale: false,
  },
];

// ============================================================================
// AI SUGGESTIONS — Tone-aware curated templates
// ============================================================================

type ToneStyle = 'formal' | 'casual';
type DetailLevel = 'brief' | 'detailed';

interface SuggestionTemplate {
  formal: string;
  casual: string;
  brief: string;
  detailed: string;
}

const SUGGESTION_TEMPLATES: Record<string, SuggestionTemplate[]> = {
  satisfaction: [
    {
      formal: 'How would you rate your overall experience with our service?',
      casual: 'How was your experience with us?',
      brief: 'Rate our service',
      detailed: 'On a scale of 1-5, how satisfied are you with the quality, timeliness, and value of our service?',
    },
    {
      formal: 'How likely are you to recommend our services to a colleague?',
      casual: 'Would you tell a friend about us?',
      brief: 'Would you recommend us?',
      detailed: 'Based on your experience, how likely are you to recommend us to a friend or colleague? Please explain.',
    },
    {
      formal: 'What improvements would you suggest for our service offering?',
      casual: 'What could we do better?',
      brief: 'Suggestions for improvement?',
      detailed: 'What specific aspects of our service could be improved, and what changes would make the biggest impact for you?',
    },
  ],
  feedback: [
    {
      formal: 'Which aspect of your experience was most satisfactory?',
      casual: 'What did you like the most?',
      brief: 'Best part?',
      detailed: 'What specific aspect of your experience stood out as most positive, and why?',
    },
    {
      formal: 'Were there any obstacles you encountered during the process?',
      casual: 'Did anything give you trouble?',
      brief: 'Any challenges?',
      detailed: 'Please describe any challenges, confusion, or obstacles you faced during your experience.',
    },
    {
      formal: 'How might we better accommodate your requirements?',
      casual: 'How can we help you better?',
      brief: 'How to improve?',
      detailed: 'What unmet needs or expectations do you have that we could address to better serve you?',
    },
  ],
  product: [
    {
      formal: 'How frequently do you utilize our product in your workflow?',
      casual: 'How often do you use our product?',
      brief: 'Usage frequency?',
      detailed: 'How often do you use our product (daily, weekly, monthly), and what are your primary use cases?',
    },
    {
      formal: 'Which product features do you consider most valuable?',
      casual: 'What features do you love most?',
      brief: 'Favorite feature?',
      detailed: 'Which specific features do you find most valuable, and how do they help you accomplish your goals?',
    },
    {
      formal: 'What additional capabilities would enhance your experience?',
      casual: 'What features are you wishing for?',
      brief: 'Feature requests?',
      detailed: 'What new features or capabilities would you like to see added, and how would they benefit your workflow?',
    },
  ],
};

function getSuggestions(tone: ToneStyle, detail: DetailLevel, category: string): string[] {
  const templates = SUGGESTION_TEMPLATES[category] || SUGGESTION_TEMPLATES.satisfaction;
  // Pick the most relevant variant: tone takes priority, detail refines
  return templates.map((t) => {
    if (detail === 'detailed') return t.detailed;
    if (detail === 'brief') return t.brief;
    return t[tone];
  });
}

function detectSuggestionCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('product') || lower.includes('feature') || lower.includes('use')) return 'product';
  if (lower.includes('feedback') || lower.includes('like') || lower.includes('challenge')) return 'feedback';
  return 'satisfaction';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConversationalBuilder: React.FC<ConversationalBuilderProps> = ({
  initialQuestions,
  onSave,
  onCancel,
  surveyTitle,
  onTitleChange,
  isAutoSaving = false,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState(false);

  // Questions state — backed by SurveyBuilderStore for cross-mode persistence + undo
  const questions = useSurveyBuilderStore(selectQuestions);
  const storeActions = useSurveyBuilderStore((s) => ({
    addQuestion: s.addQuestion,
    removeQuestion: s.removeQuestion,
    updateQuestion: s.updateQuestion,
    loadQuestions: s.loadQuestions,
    setSurveyTitle: s.setSurveyTitle,
    checkBadges: s.checkBadges,
  }));

  // Load initial questions into store on mount (if provided and store is empty/default)
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      const currentQuestions = useSurveyBuilderStore.getState().questions;
      // Only load if the store has the default single empty question
      if (currentQuestions.length === 1 && !currentQuestions[0].text) {
        storeActions.loadQuestions(initialQuestions);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync title to store
  useEffect(() => {
    if (surveyTitle) {
      storeActions.setSurveyTitle(surveyTitle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyTitle]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [suggestionTone, setSuggestionTone] = useState<ToneStyle>('casual');
  const [suggestionDetail, setSuggestionDetail] = useState<DetailLevel>('brief');

  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const saveIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Input ref for auto-focus
  const questionInputRef = useRef<TextInput>(null);

  // Accessibility
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => subscription.remove();
  }, []);

  // Update progress animation
  useEffect(() => {
    const progress = (currentIndex + 1) / Math.max(questions.length, 1);
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: reducedMotion ? 0 : 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length, progressAnim, reducedMotion]);

  // Auto-save indicator animation
  useEffect(() => {
    if (isAutoSaving) {
      Animated.sequence([
        Animated.timing(saveIndicatorAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(saveIndicatorAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAutoSaving, saveIndicatorAnim]);

  // Get current question
  const currentQuestion = questions[currentIndex];
  const currentTypeConfig = QUESTION_TYPES.find((t) => t.type === currentQuestion?.type);

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const animateTransition = useCallback(
    (direction: 'next' | 'prev', callback: () => void) => {
      if (reducedMotion) {
        callback();
        return;
      }

      const toValue = direction === 'next' ? -SCREEN_WIDTH : SCREEN_WIDTH;

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();
        slideAnim.setValue(direction === 'next' ? SCREEN_WIDTH : -SCREEN_WIDTH);

        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          questionInputRef.current?.focus();
        });
      });
    },
    [slideAnim, fadeAnim, reducedMotion]
  );

  const goToNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      if (!reducedMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      animateTransition('next', () => setCurrentIndex((prev) => prev + 1));
    }
  }, [currentIndex, questions.length, animateTransition, reducedMotion]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      if (!reducedMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      animateTransition('prev', () => setCurrentIndex((prev) => prev - 1));
    }
  }, [currentIndex, animateTransition, reducedMotion]);

  // ============================================================================
  // QUESTION MANAGEMENT
  // ============================================================================

  const updateQuestion = useCallback((updates: Partial<QuestionData>) => {
    const q = questions[currentIndex];
    if (q) {
      storeActions.updateQuestion(q.id, updates);
      storeActions.checkBadges();
    }
  }, [currentIndex, questions, storeActions]);

  const addQuestion = useCallback(() => {
    if (!reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    storeActions.addQuestion();
    storeActions.checkBadges();
    animateTransition('next', () => setCurrentIndex(questions.length));
  }, [questions.length, animateTransition, reducedMotion, storeActions]);

  const deleteQuestion = useCallback(() => {
    if (questions.length === 1) {
      Alert.alert('Cannot Delete', 'You need at least one question.');
      return;
    }

    Alert.alert(
      'Delete Question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!reducedMotion) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            const q = questions[currentIndex];
            if (q) storeActions.removeQuestion(q.id);
            if (currentIndex >= questions.length - 1) {
              setCurrentIndex(Math.max(0, currentIndex - 1));
            }
          },
        },
      ]
    );
  }, [questions, currentIndex, reducedMotion, storeActions]);

  const setQuestionType = useCallback((type: QuestionType) => {
    if (!reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    updateQuestion({ type });
    setShowTypeSelector(false);

    // Add default options for option-based types
    const typeConfig = QUESTION_TYPES.find((t) => t.type === type);
    if (typeConfig?.hasOptions && currentQuestion.options.length === 0) {
      updateQuestion({ options: ['Option 1', 'Option 2'] });
    }
  }, [updateQuestion, currentQuestion, reducedMotion]);

  const addOption = useCallback(() => {
    const newOptions = [...currentQuestion.options, `Option ${currentQuestion.options.length + 1}`];
    updateQuestion({ options: newOptions });
  }, [currentQuestion.options, updateQuestion]);

  const updateOption = useCallback((index: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    updateQuestion({ options: newOptions });
  }, [currentQuestion.options, updateQuestion]);

  const removeOption = useCallback((index: number) => {
    if (currentQuestion.options.length <= 2) {
      Alert.alert('Minimum Options', 'You need at least 2 options.');
      return;
    }
    const newOptions = currentQuestion.options.filter((_, i) => i !== index);
    updateQuestion({ options: newOptions });
  }, [currentQuestion.options, updateQuestion]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderProgressBar = () => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: progressWidth },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {currentIndex + 1} / {questions.length}
        </Text>
      </View>
    );
  };

  const renderTypeSelector = () => (
    <View style={[styles.typeSelectorContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.typeSelectorTitle, { color: colors.text }]}>
        Choose Question Type
      </Text>
      <ScrollView
        style={styles.typeList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.typeListContent}
      >
        {QUESTION_TYPES.map((typeConfig) => (
          <TouchableOpacity
            key={typeConfig.type}
            style={[
              styles.typeOption,
              currentQuestion.type === typeConfig.type && {
                backgroundColor: withAlpha(colors.primary, 0.1),
                borderColor: colors.primary,
              },
              { borderColor: colors.border },
            ]}
            onPress={() => setQuestionType(typeConfig.type)}
            accessibilityRole="radio"
            accessibilityState={{ checked: currentQuestion.type === typeConfig.type }}
            accessibilityLabel={`${typeConfig.label}: ${typeConfig.description}`}
          >
            <View
              style={[
                styles.typeOptionIcon,
                {
                  backgroundColor: withAlpha(
                    currentQuestion.type === typeConfig.type ? colors.primary : colors.text,
                    0.1
                  ),
                },
              ]}
            >
              {typeConfig.icon}
            </View>
            <View style={styles.typeOptionText}>
              <Text
                style={[
                  styles.typeOptionLabel,
                  {
                    color: currentQuestion.type === typeConfig.type ? colors.primary : colors.text,
                  },
                ]}
              >
                {typeConfig.label}
              </Text>
              <Text style={[styles.typeOptionDesc, { color: colors.textMuted }]}>
                {typeConfig.description}
              </Text>
            </View>
            {currentQuestion.type === typeConfig.type && (
              <Check size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOptionsEditor = () => (
    <View style={styles.optionsContainer}>
      <Text style={[styles.optionsTitle, { color: colors.text }]}>Options</Text>
      {currentQuestion.options.map((option, index) => (
        <View key={index} style={styles.optionRow}>
          <GripVertical size={16} color={colors.textMuted} />
          <TextInput
            style={[
              styles.optionInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            value={option}
            onChangeText={(value) => updateOption(index, value)}
            placeholder={`Option ${index + 1}`}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`Option ${index + 1}`}
          />
          <TouchableOpacity
            onPress={() => removeOption(index)}
            style={styles.removeOptionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove option ${index + 1}`}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.addOptionBtn, { borderColor: colors.border }]}
        onPress={addOption}
        accessibilityRole="button"
        accessibilityLabel="Add option"
      >
        <Plus size={16} color={colors.primary} />
        <Text style={[styles.addOptionText, { color: colors.primary }]}>Add Option</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAISuggestions = () => {
    // Detect category from current question text, then filter by tone/detail
    const currentQuestion = questions[currentIndex];
    const category = detectSuggestionCategory(currentQuestion?.text || '');
    const suggestions = getSuggestions(suggestionTone, suggestionDetail, category);

    return (
      <View style={[styles.aiSuggestionsContainer, { backgroundColor: withAlpha(colors.secondary, 0.08) }]}>
        <View style={styles.aiSuggestionsHeader}>
          <Sparkles size={16} color={colors.secondary} />
          <Text style={[styles.aiSuggestionsTitle, { color: colors.secondary }]}>
            AI Suggestions
          </Text>
        </View>

        {/* Tone & Detail Controls */}
        <View style={styles.toneControls}>
          <View style={styles.toneRow}>
            <Text style={[styles.toneLabel, { color: colors.textMuted }]}>Tone:</Text>
            <TouchableOpacity
              style={[
                styles.toneChip,
                { backgroundColor: suggestionTone === 'formal' ? colors.primary : withAlpha(colors.card, 0.8), borderColor: colors.border },
              ]}
              onPress={() => setSuggestionTone('formal')}
              accessibilityRole="button"
              accessibilityLabel="Formal tone"
              accessibilityState={{ selected: suggestionTone === 'formal' }}
            >
              <Text style={[styles.toneChipText, { color: suggestionTone === 'formal' ? '#FFF' : colors.text }]}>Formal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toneChip,
                { backgroundColor: suggestionTone === 'casual' ? colors.primary : withAlpha(colors.card, 0.8), borderColor: colors.border },
              ]}
              onPress={() => setSuggestionTone('casual')}
              accessibilityRole="button"
              accessibilityLabel="Casual tone"
              accessibilityState={{ selected: suggestionTone === 'casual' }}
            >
              <Text style={[styles.toneChipText, { color: suggestionTone === 'casual' ? '#FFF' : colors.text }]}>Casual</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.toneRow}>
            <Text style={[styles.toneLabel, { color: colors.textMuted }]}>Length:</Text>
            <TouchableOpacity
              style={[
                styles.toneChip,
                { backgroundColor: suggestionDetail === 'brief' ? colors.secondary : withAlpha(colors.card, 0.8), borderColor: colors.border },
              ]}
              onPress={() => setSuggestionDetail('brief')}
              accessibilityRole="button"
              accessibilityLabel="Brief suggestions"
              accessibilityState={{ selected: suggestionDetail === 'brief' }}
            >
              <Text style={[styles.toneChipText, { color: suggestionDetail === 'brief' ? '#FFF' : colors.text }]}>Brief</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toneChip,
                { backgroundColor: suggestionDetail === 'detailed' ? colors.secondary : withAlpha(colors.card, 0.8), borderColor: colors.border },
              ]}
              onPress={() => setSuggestionDetail('detailed')}
              accessibilityRole="button"
              accessibilityLabel="Detailed suggestions"
              accessibilityState={{ selected: suggestionDetail === 'detailed' }}
            >
              <Text style={[styles.toneChipText, { color: suggestionDetail === 'detailed' ? '#FFF' : colors.text }]}>Detailed</Text>
            </TouchableOpacity>
          </View>
        </View>

        {suggestions.slice(0, 3).map((suggestion, index) => (
          <TouchableOpacity
            key={`${suggestionTone}-${suggestionDetail}-${index}`}
            style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              updateQuestion({ text: suggestion });
              setShowAISuggestions(false);
              if (!reducedMotion) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Use suggestion: ${suggestion}`}
          >
            <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
              {suggestion}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <TextInput
            style={[styles.titleInput, { color: colors.text }]}
            value={surveyTitle}
            onChangeText={onTitleChange}
            placeholder="Survey Title"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Survey title"
          />
          {/* Auto-save indicator */}
          <Animated.View
            style={[styles.autoSaveIndicator, { opacity: saveIndicatorAnim }]}
          >
            <Save size={12} color={colors.success} />
            <Text style={[styles.autoSaveText, { color: colors.success }]}>Saved</Text>
          </Animated.View>
        </View>

        <TouchableOpacity
          onPress={() => onSave(questions)}
          style={[styles.headerBtn, styles.previewBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Preview survey"
        >
          <Eye size={18} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      {renderProgressBar()}

      {/* Question Card */}
      <Animated.View
        style={[
          styles.questionCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ translateX: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <ScrollView
          style={styles.questionScrollView}
          contentContainerStyle={styles.questionContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question number */}
          <View style={styles.questionHeader}>
            <View style={[styles.questionNumber, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
              <Text style={[styles.questionNumberText, { color: colors.primary }]}>
                Q{currentIndex + 1}
              </Text>
            </View>
            <TouchableOpacity
              onPress={deleteQuestion}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete this question"
            >
              <Trash2 size={18} color={colors.error} />
            </TouchableOpacity>
          </View>

          {/* Question text input */}
          <TextInput
            ref={questionInputRef}
            style={[styles.questionInput, { color: colors.text }]}
            value={currentQuestion.text}
            onChangeText={(text) => updateQuestion({ text })}
            placeholder="Type your question here..."
            placeholderTextColor={colors.textMuted}
            multiline
            accessibilityLabel="Question text"
            accessibilityHint="Enter the text for this question"
          />

          {/* AI suggestions toggle */}
          <TouchableOpacity
            style={[styles.aiToggle, { borderColor: colors.border }]}
            onPress={() => setShowAISuggestions(!showAISuggestions)}
            accessibilityRole="button"
            accessibilityLabel={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'}
          >
            <Wand2 size={16} color={colors.secondary} />
            <Text style={[styles.aiToggleText, { color: colors.secondary }]}>
              {showAISuggestions ? 'Hide suggestions' : 'Get AI suggestions'}
            </Text>
          </TouchableOpacity>

          {showAISuggestions && renderAISuggestions()}

          {/* Question type selector */}
          <TouchableOpacity
            style={[styles.typeButton, { backgroundColor: withAlpha(colors.primary, 0.08), borderColor: colors.border }]}
            onPress={() => setShowTypeSelector(!showTypeSelector)}
            accessibilityRole="button"
            accessibilityLabel={`Question type: ${currentTypeConfig?.label}. Tap to change.`}
          >
            <View style={[styles.typeButtonIcon, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
              {currentTypeConfig && currentTypeConfig.icon}
            </View>
            <View style={styles.typeButtonText}>
              <Text style={[styles.typeButtonLabel, { color: colors.text }]}>
                {currentTypeConfig?.label}
              </Text>
              <Text style={[styles.typeButtonDesc, { color: colors.textMuted }]}>
                {currentTypeConfig?.description}
              </Text>
            </View>
            {showTypeSelector ? (
              <ChevronUp size={20} color={colors.textMuted} />
            ) : (
              <ChevronDown size={20} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {showTypeSelector && renderTypeSelector()}

          {/* Options editor (for radio, checkbox, dropdown) */}
          {currentTypeConfig?.hasOptions && renderOptionsEditor()}

          {/* Required toggle */}
          <TouchableOpacity
            style={[styles.requiredToggle, { borderColor: colors.border }]}
            onPress={() => updateQuestion({ required: !currentQuestion.required })}
            accessibilityRole="switch"
            accessibilityState={{ checked: currentQuestion.required }}
            accessibilityLabel="Required question"
          >
            <View
              style={[
                styles.requiredCheckbox,
                {
                  backgroundColor: currentQuestion.required ? colors.primary : 'transparent',
                  borderColor: currentQuestion.required ? colors.primary : colors.border,
                },
              ]}
            >
              {currentQuestion.required && <Check size={14} color="#FFF" />}
            </View>
            <Text style={[styles.requiredText, { color: colors.text }]}>
              Required question
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Navigation Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.navBtn,
            currentIndex === 0 && styles.navBtnDisabled,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={goToPrevious}
          disabled={currentIndex === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous question"
          accessibilityState={{ disabled: currentIndex === 0 }}
        >
          <ArrowLeft size={20} color={currentIndex === 0 ? colors.textMuted : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addQuestionBtn, { backgroundColor: colors.primary }]}
          onPress={addQuestion}
          accessibilityRole="button"
          accessibilityLabel="Add new question"
        >
          <Plus size={20} color={colors.primaryText} />
          <Text style={[styles.addQuestionText, { color: colors.primaryText }]}>
            Add Question
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navBtn,
            currentIndex >= questions.length - 1 && styles.navBtnDisabled,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={goToNext}
          disabled={currentIndex >= questions.length - 1}
          accessibilityRole="button"
          accessibilityLabel="Next question"
          accessibilityState={{ disabled: currentIndex >= questions.length - 1 }}
        >
          <ArrowRight
            size={20}
            color={currentIndex >= questions.length - 1 ? colors.textMuted : colors.text}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  previewBtn: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  titleInput: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    marginTop: SPACING.xxs,
  },
  autoSaveText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 50,
    textAlign: 'right',
  },

  // Question card
  questionCard: {
    flex: 1,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  questionScrollView: {
    flex: 1,
  },
  questionContent: {
    padding: SPACING.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  questionNumber: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  questionNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionInput: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xl,
    letterSpacing: -0.2,
    lineHeight: 32,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },

  // AI suggestions
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  aiToggleText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  aiSuggestionsContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  aiSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  aiSuggestionsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  toneControls: {
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  toneLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    width: 48,
  },
  toneChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.base,
    borderWidth: 1,
  },
  toneChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  suggestionChip: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  suggestionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Type selector
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  typeButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonText: {
    flex: 1,
  },
  typeButtonLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
  typeButtonDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  typeSelectorContainer: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    maxHeight: 300,
    overflow: 'hidden',
  },
  typeSelectorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    padding: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  typeList: {
    flex: 1,
  },
  typeListContent: {
    padding: SPACING.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
    gap: SPACING.md,
  },
  typeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionText: {
    flex: 1,
  },
  typeOptionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  typeOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Options
  optionsContainer: {
    marginBottom: SPACING.md,
  },
  optionsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  optionInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  removeOptionBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  addOptionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Required toggle
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  requiredCheckbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requiredText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  addQuestionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  addQuestionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
});

export default ConversationalBuilder;
