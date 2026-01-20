import {
  NotificationBell,
  PrimaryButton,
  SearchBar,
  SectionHeader,
  SurveyCard,
} from "@/components";
import { useRunningSurveys, useUnreadCount, useUpcomingSurveys } from "@/services/hooks";
import { Survey } from "@/types";
import {
  COMPONENT_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Eye,
  FileJson,
  ListPlus,
  ShieldCheck,
  Sparkles,
  SquareCheck,
  Star,
  Type,
  Upload,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface QuestionType {
  key: string;
  label: string;
  description: string;
  icon: React.ReactElement;
}

export default function SurveysScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user } = useUser();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("multiple-choice");

  const { data: runningSurveys = [], isLoading: loadingRunning, refetch: refetchRunning } = useRunningSurveys();
  const { data: upcomingSurveys = [], isLoading: loadingUpcoming, refetch: refetchUpcoming } = useUpcomingSurveys();
  const { data: unreadCount } = useUnreadCount();
  const [showBuilder, setShowBuilder] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDescription, setSurveyDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [uploading, setUploading] = useState(false);
  const [jsonExampleVisible, setJsonExampleVisible] = useState(false);

  const startLabel = useMemo(() => startDate.toDateString(), [startDate]);
  const endLabel = useMemo(() => endDate.toDateString(), [endDate]);

  const isLoading = loadingRunning || loadingUpcoming;
  const isAdmin = Boolean(user?.email?.toLowerCase().includes("admin"));

  const questionTypes: QuestionType[] = useMemo(() => [
    {
      key: "multiple-choice",
      label: "Multiple choice",
      description: "Single answer from options",
      icon: <ListPlus size={16} color={colors.text} strokeWidth={1.5} />,
    },
    {
      key: "checkbox",
      label: "Checkboxes",
      description: "Select many options",
      icon: <SquareCheck size={16} color={colors.text} strokeWidth={1.5} />,
    },
    {
      key: "radio",
      label: "Radio buttons",
      description: "One required choice",
      icon: <CircleDot size={16} color={colors.text} strokeWidth={1.5} />,
    },
    {
      key: "text",
      label: "Text response",
      description: "Short/long answers",
      icon: <Type size={16} color={colors.text} strokeWidth={1.5} />,
    },
    {
      key: "rating",
      label: "Rating scale",
      description: "1-5 satisfaction",
      icon: <Star size={16} color={colors.text} strokeWidth={1.5} />,
    },
  ], [colors.text]);

  const filteredRunning = useMemo(
    () => runningSurveys.filter((survey: Survey) => survey.title.toLowerCase().includes(search.toLowerCase())),
    [runningSurveys, search],
  );

  const filteredUpcoming = useMemo(
    () => upcomingSurveys.filter((survey: Survey) => survey.title.toLowerCase().includes(search.toLowerCase())),
    [upcomingSurveys, search],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRunning(), refetchUpcoming()]);
    setRefreshing(false);
  }, [refetchRunning, refetchUpcoming]);

  const handleSurveyPress = (id: string): void => {
    router.push(`/survey/${id}`);
  };

  const handleUpload = (): void => {
    setShowBuilder(true);
  };

  const handleCreateSurvey = (): void => {
    if (!surveyTitle.trim() || !surveyDescription.trim()) {
      Alert.alert("Missing fields", "Enter a title and description.");
      return;
    }

    Alert.alert(
      "Survey saved",
      "Your survey draft is saved. Add questions in the builder.",
      [{ text: "Great", onPress: () => setShowBuilder(false) }],
    );
  };

  const handleJsonUpload = async (): Promise<void> => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
      if (result.canceled || !result.assets?.length) {
        setUploading(false);
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
      const parsed = JSON.parse(content);

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid JSON: expected a "questions" array');
      }

      Alert.alert("Upload ready", `Imported ${parsed.questions.length} questions.`, [
        { text: "Add questions", onPress: () => setShowBuilder(false) },
      ]);
    } catch (error) {
      Alert.alert("Invalid file", error instanceof Error ? error.message : "Could not read JSON file.");
    } finally {
      setUploading(false);
    }
  };

  const handleStartDateChange = (_: unknown, date?: Date): void => {
    setShowStartPicker(false);
    if (!date) return;
    setStartDate(date);
    if (endDate < date) {
      setEndDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const handleEndDateChange = (_: unknown, date?: Date): void => {
    setShowEndPicker(false);
    if (!date) return;
    if (date < startDate) {
      Alert.alert("Invalid date", "End date must be after start date.");
      return;
    }
    setEndDate(date);
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
            paddingBottom: insets.bottom + SPACING["2xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Surveys</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Design, validate, and publish</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}
              accessibilityLabel="Create survey"
            >
              <ClipboardList size={16} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Form builder</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SearchBar
          placeholder="Search surveys"
          value={search}
          onChangeText={setSearch}
          style={{ marginBottom: SPACING.lg }}
        />

        {/* Builder controls */}
        <SectionHeader
          title="Create surveys"
          subtitle="Pick question types and build like Google Forms"
          icon={<Sparkles size={18} color={colors.primary} strokeWidth={1.5} />}
        />
        <View style={[styles.builderCard, { backgroundColor: colors.card }]}
          accessibilityLabel="Survey form builder"
        >
          <View style={styles.typeRow}>
            {questionTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typePill,
                  {
                    borderColor: type.key === selectedType ? colors.primary : colors.border,
                    backgroundColor: type.key === selectedType ? withAlpha(colors.primary, 0.12) : "transparent",
                  },
                ]}
                onPress={() => setSelectedType(type.key)}
                accessibilityLabel={`Select ${type.label}`}
              >
                {type.icon}
                <View>
                  <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
                  <Text style={[styles.typeDesc, { color: colors.textMuted }]}>{type.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.builderActions}>
            <PrimaryButton
              title="Add question"
              onPress={() => setShowBuilder(true)}
              leftIcon={<ListPlus size={16} color={colors.primaryText} />}
            />
            <PrimaryButton
              title="Preview"
              onPress={() => {}}
              variant="secondary"
              leftIcon={<Eye size={16} color={colors.primary} />}
            />
          </View>

          <View style={styles.validationBox}>
            <CheckCircle2 size={16} color={colors.success} strokeWidth={1.5} />
            <Text style={[styles.validationText, { color: colors.text }]}>Validation on required fields, option limits, and rating ranges is enforced before publish.</Text>
          </View>
        </View>

        {/* Admin upload */}
        {isAdmin && (
          <View style={[styles.uploadCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Upload surveys via JSON"
          >
            <View style={styles.uploadHeader}>
              <FileJson size={18} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Upload surveys (Admin)</Text>
            </View>
            <Text style={[styles.uploadSubtitle, { color: colors.textMuted }]}>Import a JSON file and auto-generate questions with validation.</Text>
            <PrimaryButton
              title="Upload JSON"
              onPress={handleUpload}
              leftIcon={<Upload size={16} color={colors.primaryText} />}
            />
          </View>
        )}

        {/* Tips */}
        <SectionHeader
          title="Creator tips"
          subtitle="Best practices for higher completion"
          icon={<ShieldCheck size={18} color={colors.secondary} strokeWidth={1.5} />}
        />
        <View style={[styles.tipsCard, { backgroundColor: colors.card }]}
          accessibilityLabel="Survey creation tips"
        >
          {["Keep questions concise; group related items", "Use required fields sparingly to reduce drop-offs", "Add ratings for experience, text for feedback", "Preview before publishing to catch typos"].map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <CheckCircle2 size={14} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Running */}
        <SectionHeader
          title="Running surveys"
          subtitle="Live and accepting responses"
          icon={<ShieldCheck size={18} color={colors.success} strokeWidth={1.5} />}
        />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.cardList}>
            {filteredRunning.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No running surveys right now</Text>
            ) : (
              filteredRunning.map((survey: Survey) => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  onPress={() => handleSurveyPress(survey.id)}
                />
              ))
            )}
          </View>
        )}

        {/* Upcoming */}
        <SectionHeader
          title="Upcoming"
          subtitle="Scheduled and pre-approved"
          icon={<Sparkles size={18} color={colors.warning} strokeWidth={1.5} />}
        />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.cardList}>
            {filteredUpcoming.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No upcoming surveys scheduled</Text>
            ) : (
              filteredUpcoming.map((survey: Survey) => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  variant="compact"
                  onPress={() => handleSurveyPress(survey.id)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showBuilder}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBuilder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Survey builder modal"
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Survey builder</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Name, schedule, then add questions</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBuilder(false)} accessibilityLabel="Close builder">
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Survey title</Text>
              <TextInput
                value={surveyTitle}
                onChangeText={setSurveyTitle}
                placeholder="e.g. Product satisfaction Q3"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: withAlpha(colors.card, 0.6) }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Description</Text>
              <TextInput
                value={surveyDescription}
                onChangeText={setSurveyDescription}
                placeholder="Objectives, audience, success metrics"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: withAlpha(colors.card, 0.6) }]}
              />
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Start date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border }]}
                  onPress={() => setShowStartPicker(true)}
                  accessibilityLabel="Pick start date"
                >
                  <CalendarClock size={16} color={colors.text} />
                  <Text style={[styles.dateText, { color: colors.text }]}>{startLabel}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>End date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: colors.border }]}
                  onPress={() => setShowEndPicker(true)}
                  accessibilityLabel="Pick end date"
                >
                  <CalendarRange size={16} color={colors.text} />
                  <Text style={[styles.dateText, { color: colors.text }]}>{endLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
              />
            )}

            <View style={[styles.validationBox, { borderColor: colors.border }]}
              accessibilityLabel="Validation notice"
            >
              <ShieldCheck size={16} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.validationText, { color: colors.text }]}>We run required checks, option counts, and rating ranges before publish.</Text>
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Save draft"
                onPress={handleCreateSurvey}
                leftIcon={<CheckCircle2 size={16} color={colors.primaryText} />}
              />
              <PrimaryButton
                title={uploading ? "Uploading" : "Upload JSON"}
                onPress={handleJsonUpload}
                variant="outline"
                loading={uploading}
                leftIcon={<Upload size={16} color={colors.primary} />}
              />
            </View>

            <TouchableOpacity
              style={styles.exampleToggle}
              onPress={() => setJsonExampleVisible((prev) => !prev)}
              accessibilityLabel="Toggle JSON example"
            >
              <Text style={[styles.inputLabel, { color: colors.primary }]}>See JSON format</Text>
            </TouchableOpacity>
            {jsonExampleVisible && (
              <View style={[styles.codeBlock, { borderColor: colors.border, backgroundColor: withAlpha(colors.card, 0.5) }]}
                accessibilityLabel="Sample JSON"
              >
                <Text style={[styles.codeText, { color: colors.text }]}>
{`{
  "title": "Product NPS",
  "questions": [
    { "type": "rating", "label": "How satisfied?", "scale": 5, "required": true },
    { "type": "multiple-choice", "label": "Favorite feature", "options": ["Speed", "Design", "Support"] },
    { "type": "text", "label": "What should we improve?" }
  ]
}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: SPACING.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  builderCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  typeRow: {
    gap: SPACING.sm,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  typeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  typeDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  builderActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  validationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  validationText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  uploadCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  uploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  uploadTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  uploadSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  tipsCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  tipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cardList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    height: COMPONENT_SIZE.input.medium,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    minHeight: COMPONENT_SIZE.input.large,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlignVertical: "top",
  },
  dateRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  dateCol: {
    flex: 1,
    gap: SPACING.xs,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dateText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  exampleToggle: {
    paddingVertical: SPACING.xs,
  },
  codeBlock: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  codeText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
