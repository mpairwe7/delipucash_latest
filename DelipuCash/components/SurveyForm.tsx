import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Type,
  List,
  CheckSquare,
  Star,
  Calendar,
  Save,
  Upload,
  Eye,
  Info,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, BORDER_WIDTH, withAlpha } from '@/utils/theme';
import { useCreateSurvey } from '@/services/hooks';
import { UploadSurvey } from '@/types';
import useUser from '@/utils/useUser';

type QuestionType = 'text' | 'radio' | 'checkbox' | 'rating';

interface QuestionData {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
  required: boolean;
}

interface SurveyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** When true, automatically open the JSON import modal (used by Import tab) */
  startWithImport?: boolean;
}

const SurveyForm: React.FC<SurveyFormProps> = ({ onSuccess, onCancel, startWithImport }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const createSurveyMutation = useCreateSurvey();
  const { data: user } = useUser();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [questions, setQuestions] = useState<QuestionData[]>([
    {
      id: 'q1',
      text: '',
      type: 'text',
      options: [],
      placeholder: '',
      required: false,
    },
  ]);

  // UI state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>('q1');
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
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

  // Auto-open JSON import when the Import tab is active
  useEffect(() => {
    if (startWithImport && !hasAutoOpenedImport.current) {
      setShowJsonModal(true);
      hasAutoOpenedImport.current = true;
    }

    if (!startWithImport) {
      hasAutoOpenedImport.current = false;
    }
  }, [startWithImport]);

  const addQuestion = () => {
    const newId = `q${questions.length + 1}`;
    const newQuestion: QuestionData = {
      id: newId,
      text: '',
      type: 'text',
      options: [],
      placeholder: '',
      required: false,
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newId);
  };

  const removeQuestion = (id: string) => {
    if (questions.length > 1) {
      setQuestions(questions.filter(q => q.id !== id));
      if (expandedQuestion === id) {
        setExpandedQuestion(questions[0].id);
      }
    }
  };

  const updateQuestion = (id: string, updates: Partial<QuestionData>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options.length < 10) {
      const newOptions = [...question.options, `Option ${question.options.length + 1}`];
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const handleJsonUpload = async () => {
    try {
      setUploadingJson(true);
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets?.length) {
        setUploadingJson(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });
      const parsed = JSON.parse(content);

      // Validate JSON structure
      if (!parsed.title || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid JSON format. Expected { title: string, description?: string, questions: array }');
      }

      // Update form with parsed data
      setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);

      // Convert questions
      const convertedQuestions: QuestionData[] = parsed.questions.map((q: any, index: number) => ({
        id: `q${index + 1}`,
        text: q.text || '',
        type: q.type || 'text',
        options: Array.isArray(q.options) ? q.options : [],
        minValue: q.minValue || 1,
        maxValue: q.maxValue || 5,
        placeholder: q.placeholder || '',
        required: q.required || false,
      }));

      setQuestions(convertedQuestions.length > 0 ? convertedQuestions : [{
        id: 'q1',
        text: '',
        type: 'text',
        options: [],
        placeholder: '',
        required: false,
      }]);

      setShowJsonModal(false);
      Alert.alert('Success', `Imported ${convertedQuestions.length} questions from JSON`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to parse JSON file');
    } finally {
      setUploadingJson(false);
    }
  };

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

    if (questions.some(q => (q.type === 'radio' || q.type === 'checkbox') && q.options.length < 2)) {
      Alert.alert('Error', 'Choice questions must have at least 2 options');
      return;
    }

    if (startDate >= endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    // Convert questions to UploadSurvey format
    const surveyQuestions: Omit<UploadSurvey, 'id' | 'userId' | 'surveyId' | 'createdAt' | 'updatedAt'>[] = questions.map(q => ({
      text: q.text,
      type: q.type,
      options: q.type === 'rating' 
        ? JSON.stringify({ min: q.minValue || 1, max: q.maxValue || 5, labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] })
        : q.type === 'text'
        ? JSON.stringify({ multiline: true, placeholder: q.placeholder || '' })
        : JSON.stringify(q.options),
      placeholder: q.placeholder || null,
      minValue: q.type === 'rating' ? q.minValue || 1 : null,
      maxValue: q.type === 'rating' ? q.maxValue || 5 : null,
    }));

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

  const renderQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'text': return <Type size={16} color={colors.primary} />;
      case 'radio': return <List size={16} color={colors.primary} />;
      case 'checkbox': return <CheckSquare size={16} color={colors.primary} />;
      case 'rating': return <Star size={16} color={colors.primary} />;
    }
  };

  const renderQuestionEditor = (question: QuestionData) => {
    const isExpanded = expandedQuestion === question.id;

    return (
      <View key={question.id} style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.questionHeader}
          onPress={() => setExpandedQuestion(isExpanded ? null : question.id)}
        >
          <View style={styles.questionTitleRow}>
            {renderQuestionTypeIcon(question.type)}
            <Text style={[styles.questionTitle, { color: colors.text }]}>
              {question.text || 'Untitled Question'}
            </Text>
            {question.required && <Text style={[styles.required, { color: colors.error }]}>*</Text>}
          </View>
          <View style={styles.questionActions}>
            {questions.length > 1 && (
              <TouchableOpacity onPress={() => removeQuestion(question.id)} style={styles.actionButton}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            )}
            {isExpanded ? <ChevronUp size={16} color={colors.text} /> : <ChevronDown size={16} color={colors.text} />}
          </View>
        </TouchableOpacity>

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
                {(['text', 'radio', 'checkbox', 'rating'] as QuestionType[]).map((type) => (
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
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Type-specific options */}
            {(question.type === 'radio' || question.type === 'checkbox') && (
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

          {questions.map(renderQuestionEditor)}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.secondaryActionButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={() => setShowPreviewModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Preview survey"
          >
            <Eye size={18} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={createSurveyMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Save survey"
          >
            {createSurveyMutation.isPending ? (
              <Text style={[styles.saveText, { color: colors.primaryText }]}>Saving...</Text>
            ) : (
              <>
                <Save size={18} color={colors.primaryText} />
                <Text style={[styles.saveText, { color: colors.primaryText }]}>Save</Text>
              </>
            )}
          </TouchableOpacity>
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

      {/* JSON Upload Modal - Improved Readability */}
      <Modal
        visible={showJsonModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowJsonModal(false)}
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
                    Upload a JSON file with your questions
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowJsonModal(false)}
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
              {/* Instructions Card */}
              <View style={[styles.instructionCard, { backgroundColor: withAlpha(colors.info, 0.08), borderColor: withAlpha(colors.info, 0.2) }]}>
                <Info size={20} color={colors.info} style={styles.instructionIcon} />
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Your JSON file should include a title and an array of questions. Each question needs a type, text, and optional properties.
                </Text>
              </View>

              {/* Example Section */}
              <Text style={[styles.exampleLabel, { color: colors.text }]}>Example Format</Text>
              <View style={[styles.codeBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.codeText, { color: colors.text }]}>
{`{
  "title": "Customer Feedback",
  "description": "Help us improve",
  "questions": [
    {
      "text": "How satisfied are you?",
      "type": "rating",
      "required": true,
      "minValue": 1,
      "maxValue": 5
    },
    {
      "text": "Select your favorites",
      "type": "checkbox",
      "options": ["Speed", "Design", "Support"]
    },
    {
      "text": "Any suggestions?",
      "type": "text",
      "placeholder": "Your feedback..."
    }
  ]
}`}
                </Text>
              </View>

              {/* Question Types Reference */}
              <Text style={[styles.exampleLabel, { color: colors.text }]}>Supported Question Types</Text>
              <View style={styles.typesGrid}>
                {[
                  { type: 'text', desc: 'Open-ended responses', icon: <Type size={18} color={colors.primary} /> },
                  { type: 'radio', desc: 'Single choice from options', icon: <List size={18} color={colors.secondary} /> },
                  { type: 'checkbox', desc: 'Multiple selections', icon: <CheckSquare size={18} color={colors.info} /> },
                  { type: 'rating', desc: 'Scale ratings (1-5)', icon: <Star size={18} color={colors.warning} /> },
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
                    'Set "required": true for mandatory questions',
                    'Radio/checkbox need an "options" array',
                    'Rating uses minValue & maxValue (default 1-5)',
                    'Add "placeholder" for text input hints',
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
                onPress={() => setShowJsonModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalUploadBtn, { backgroundColor: colors.primary }]}
                onPress={handleJsonUpload}
                disabled={uploadingJson}
              >
                <Upload size={18} color={colors.primaryText} />
                <Text style={[styles.modalUploadText, { color: colors.primaryText }]}>
                  {uploadingJson ? 'Uploading...' : 'Choose File'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
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
                    How your survey will appear
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

            <ScrollView style={styles.previewBody} contentContainerStyle={styles.previewBodyContent}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>{title || 'Untitled Survey'}</Text>
              {description ? (
                <Text style={[styles.previewDescription, { color: colors.textMuted }]}>{description}</Text>
              ) : null}

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

                  {(question.type === 'radio' || question.type === 'checkbox') && (
                    <View style={styles.previewOptions}>
                      {question.options.map((option, optIndex) => (
                        <View key={optIndex} style={styles.previewOption}>
                          <View style={[styles.previewRadio, { borderColor: colors.border }]} />
                          <Text style={[styles.previewOptionText, { color: colors.text }]}>{option}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {question.type === 'rating' && (
                    <View style={styles.previewRating}>
                      {Array.from({ length: question.maxValue || 5 }, (_, i) => (
                        <Star key={i} size={20} color={colors.primary} fill="none" />
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.base,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
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
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  textArea: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: 80,
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
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  addQuestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  questionCard: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
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
    padding: SPACING.sm,
    paddingTop: 0,
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
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
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
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
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
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
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
  previewContent: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  previewBody: {
    flex: 1,
  },
  previewBodyContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
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
  previewOptionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  previewRating: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
});

export default SurveyForm;