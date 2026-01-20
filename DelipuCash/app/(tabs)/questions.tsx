  import {
    NotificationBell,
    PrimaryButton,
    QuestionCard,
    SearchBar,
    SectionHeader,
    StatCard,
} from "@/components";
import { formatCurrency } from "@/data/mockData";
import {
    useCreateRewardQuestion,
    useInstantRewardQuestions,
    useQuestions,
    useRecentQuestions,
    useRewardQuestions,
    useUnreadCount,
    useUserStats,
} from "@/services/hooks";
import {
    BORDER_WIDTH,
    COMPONENT_SIZE,
    ICON_SIZE,
    RADIUS,
    SPACING,
    TYPOGRAPHY,
    useTheme,
    withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    Award,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock3,
    Coins,
    FileJson,
    FileSpreadsheet,
    Plus,
    Search,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Upload as UploadIcon,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Instant Reward Upload Form Component
 * Implements actual API integration using useCreateRewardQuestion hook
 */
function InstantRewardUploadForm({ colors, insets }: { colors: any; insets: any }) {
  const { data: user } = useUser();
  const createQuestion = useCreateRewardQuestion();
  
  const [questionText, setQuestionText] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [option4, setOption4] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [maxWinners, setMaxWinners] = useState("2");
  const [expiryHours, setExpiryHours] = useState("24");
  const [paymentProvider, setPaymentProvider] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleUpload = async () => {
    // Validate required fields
    if (!questionText.trim()) {
      Alert.alert("Error", "Question text is required");
      return;
    }
    
    const options = [option1, option2, option3, option4]
      .filter(opt => opt.trim())
      .map(opt => opt.trim());
    
    if (options.length < 2) {
      Alert.alert("Error", "At least 2 options are required");
      return;
    }
    
    if (!correctAnswer.trim()) {
      Alert.alert("Error", "Correct answer is required");
      return;
    }
    
    // Validate correct answer matches one of the options (case-insensitive)
    const matchingOption = options.find(
      opt => opt.toLowerCase() === correctAnswer.trim().toLowerCase()
    );
    if (!matchingOption) {
      Alert.alert("Error", "Correct answer must match one of the options");
      return;
    }
    
    const parsedReward = parseFloat(rewardAmount);
    if (!rewardAmount.trim() || isNaN(parsedReward) || parsedReward <= 0) {
      Alert.alert("Error", "Valid reward amount is required");
      return;
    }
    
    const parsedMaxWinners = parseInt(maxWinners) || 2;
    const parsedExpiryHours = parseInt(expiryHours) || 24;
    
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Phone number is required for payouts");
      return;
    }
    
    if (!user) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    const expiryTime = new Date(Date.now() + parsedExpiryHours * 60 * 60 * 1000).toISOString();

    try {
      await createQuestion.mutateAsync({
        text: questionText.trim(),
        options,
        correctAnswer: matchingOption, // Use the matched option for consistent casing
        rewardAmount: parsedReward,
        expiryTime,
        userId: user.id,
        isInstantReward: true,
        maxWinners: parsedMaxWinners,
        paymentProvider,
        phoneNumber: phoneNumber.trim(),
      });
      
      Alert.alert("Success", "Instant reward question uploaded successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to upload question");
    }
  };

  return (
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Upload Instant Reward Question</Text>
        <View style={{ width: COMPONENT_SIZE.touchTarget }} />
      </View>

      <View style={styles.uploadForm}>
        <SectionHeader
          title="Question Details"
          subtitle="Create a high-impact instant reward question"
          icon={<Sparkles size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />}
        />

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Question Text *</Text>
          <TextInput
            style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="Enter the question"
            placeholderTextColor={colors.textMuted}
            value={questionText}
            onChangeText={setQuestionText}
            multiline
            numberOfLines={3}
          />
        </View>

        <SectionHeader
          title="Answer Options"
          subtitle="Provide 2-4 multiple choice options"
          icon={<CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
        />

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.xs }]}>
            <Text style={[styles.label, { color: colors.text }]}>Option 1 *</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="First option"
              placeholderTextColor={colors.textMuted}
              value={option1}
              onChangeText={setOption1}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
            <Text style={[styles.label, { color: colors.text }]}>Option 2 *</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Second option"
              placeholderTextColor={colors.textMuted}
              value={option2}
              onChangeText={setOption2}
            />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.xs }]}>
            <Text style={[styles.label, { color: colors.text }]}>Option 3</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Third option (optional)"
              placeholderTextColor={colors.textMuted}
              value={option3}
              onChangeText={setOption3}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
            <Text style={[styles.label, { color: colors.text }]}>Option 4</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Fourth option (optional)"
              placeholderTextColor={colors.textMuted}
              value={option4}
              onChangeText={setOption4}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Correct Answer *</Text>
          <TextInput
            style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="Must match one of the options above"
            placeholderTextColor={colors.textMuted}
            value={correctAnswer}
            onChangeText={setCorrectAnswer}
          />
        </View>

        <SectionHeader
          title="Reward Settings"
          subtitle="Configure payout and expiry"
          icon={<Coins size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />}
        />

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.sm }]}>
            <Text style={[styles.label, { color: colors.text }]}>Reward Amount *</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={rewardAmount}
              onChangeText={setRewardAmount}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
            <Text style={[styles.label, { color: colors.text }]}>Max Winners (1-10)</Text>
            <TextInput
              style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="2"
              placeholderTextColor={colors.textMuted}
              value={maxWinners}
              onChangeText={setMaxWinners}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Expiry (hours from now)</Text>
          <TextInput
            style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="24"
            placeholderTextColor={colors.textMuted}
            value={expiryHours}
            onChangeText={setExpiryHours}
            keyboardType="numeric"
          />
        </View>

        <SectionHeader
          title="Payment Details"
          subtitle="How winners will receive rewards"
          icon={<Award size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
        />

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Payment Provider</Text>
          <View style={styles.paymentProviderRow}>
            {["MTN", "Airtel", "Bank"].map((provider) => (
              <TouchableOpacity
                key={provider}
                style={[
                  styles.paymentProviderOption,
                  { 
                    borderColor: paymentProvider === provider ? colors.primary : colors.border,
                    backgroundColor: paymentProvider === provider ? withAlpha(colors.primary, 0.1) : colors.card,
                  }
                ]}
                onPress={() => setPaymentProvider(provider)}
              >
                <Text style={[
                  styles.paymentProviderText, 
                  { color: paymentProvider === provider ? colors.primary : colors.text }
                ]}>
                  {provider}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Phone Number *</Text>
          <TextInput
            style={[styles.uploadInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="+256 700 000 000"
            placeholderTextColor={colors.textMuted}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        <PrimaryButton
          title="Upload Question"
          onPress={handleUpload}
          loading={createQuestion.isPending}
          style={{ marginTop: SPACING.lg }}
        />
      </View>
    </ScrollView>
  );
}

/**
 * Question Screen
 * - Ask a question form
 * - Instant reward questions
 * - Recent questions
 * - Answer & earn CTA
 * - Admin upload questions card (CSV / JSON)
 * - Ad registration card with conditional render and approval steps
 */
export default function QuestionsScreen(): React.ReactElement {
    const insets = useSafeAreaInsets();
    const { colors, statusBarStyle } = useTheme();
    const { data: user } = useUser();
    const params = useLocalSearchParams();
    const intent = params.intent as string | undefined;
    const [refreshing, setRefreshing] = useState(false);
    const [questionText, setQuestionText] = useState("");
    const [category, setCategory] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: questionsData, isLoading, refetch } = useQuestions();
    const { data: instantQuestions } = useInstantRewardQuestions(5);
    const { data: rewardQuestions, isLoading: rewardLoading } = useRewardQuestions();
    const { data: recentQuestions } = useRecentQuestions(6);
    const { data: userStats } = useUserStats();
    const { data: unreadCount } = useUnreadCount();

    const questions = useMemo(() => {
      const list = questionsData?.questions || [];
      if (!searchQuery) return list;
      const lower = searchQuery.toLowerCase();
      return list.filter((q) => q.text.toLowerCase().includes(lower));
    }, [questionsData, searchQuery]);

    const rewardQuestionCards = useMemo(() => {
      return (rewardQuestions || []).map((rq) => ({
        id: rq.id,
        text: rq.text,
        userId: rq.userId,
        createdAt: rq.createdAt,
        updatedAt: rq.updatedAt,
        category: "Rewards",
        rewardAmount: rq.rewardAmount,
        isInstantReward: true,
        totalAnswers: rq.winnersCount ?? 0,
      }));
    }, [rewardQuestions]);

    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      await Promise.all([refetch()]);
      setRefreshing(false);
    }, [refetch]);

    const handleQuestionPress = (id: string): void => {
      router.push(`/question-answer/${id}`);
    };

    const handleRewardQuestionPress = (id: string): void => {
      router.push(`/instant-reward-answer/${id}`);
    };

    const handleAskQuestion = (): void => {
      // Placeholder for ask-question flow
      if (!questionText.trim()) return;
      setQuestionText("");
      setCategory("");
    };

    const handleInstantRewardUpload = (): void => {
      if (!isAdmin) {
        Alert.alert("Admin only", "Instant reward uploads require admin access.");
        return;
      }
      router.push("/instant-reward-questions");
    };

    const handleInstantRewardBrowse = (): void => {
      router.push("/instant-reward-questions");
    };

    const handleFileUploadCard = (): void => {
      if (!isAdmin) {
        Alert.alert("Admin only", "File uploads are limited to administrators.");
        return;
      }
      router.push({ pathname: "/(tabs)/questions", params: { intent: "file-upload" } });
    };

    const handleAnswerEarn = (): void => {
      router.push("/(tabs)/questions");
    };

    /**
     * Role-based access control: Check user's role field from backend
     * instead of inferring from email address (which is insecure)
     */
    const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

    // If intent is instant-reward-upload, show upload form
    if (intent === "instant-reward-upload") {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar style={statusBarStyle} />
          <InstantRewardUploadForm colors={colors} insets={insets} />
        </View>
      );
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Questions</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                Ask, answer, and earn rewards
              </Text>
            </View>
            <View style={styles.headerActions}>
              <NotificationBell
                count={unreadCount ?? 0}
                onPress={() => router.push("/notifications" as Href)}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Ask a question"
                onPress={handleAskQuestion}
              >
                <Plus size={24} color={colors.primaryText} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <SearchBar
            placeholder="Search questions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ marginBottom: SPACING.lg }}
            onSubmit={() => {}}
            icon={<Search size={18} color={colors.textMuted} />}
          />

          {/* Action cards for core flows */}
          <View style={styles.actionGrid}>
            <ActionCard
              title="Upload instant reward questions"
              subtitle="Create high-impact questions with instant payouts"
              icon={<Sparkles size={18} color={colors.warning} strokeWidth={1.5} />}
              badgeLabel="Admin"
              badgeColor={colors.warning}
              onPress={handleInstantRewardUpload}
              disabled={!isAdmin}
              colors={colors}
            />
            <ActionCard
              title="Upload questions via file"
              subtitle="Bulk import questions from JSON or CSV"
              icon={<UploadIcon size={18} color={colors.info} strokeWidth={1.5} />}
              badgeLabel="Admin"
              badgeColor={colors.info}
              onPress={handleFileUploadCard}
              disabled={!isAdmin}
              colors={colors}
            />
            <ActionCard
              title="Answer questions & earn"
              subtitle="Browse open questions and claim rewards"
              icon={<Award size={18} color={colors.success} strokeWidth={1.5} />}
              onPress={handleInstantRewardBrowse}
              colors={colors}
            />
          </View>

          {/* Ask Question Card */}
          <View style={[styles.askCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.askTitle, { color: colors.text }]}>Ask a question</Text>
            <Text style={[styles.askSubtitle, { color: colors.textMuted }]}>
              Get answers from the community and earn rewards for valuable contributions.
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Write your question"
                placeholderTextColor={colors.textMuted}
                value={questionText}
                onChangeText={setQuestionText}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Category (optional)"
                placeholderTextColor={colors.textMuted}
                value={category}
                onChangeText={setCategory}
              />
            </View>
            <PrimaryButton
              title="Submit Question"
              onPress={handleAskQuestion}
              disabled={!questionText.trim()}
            />
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatCard
              icon={<Award size={18} color={colors.primary} strokeWidth={1.5} />}
              title="Answered"
              value={userStats?.totalAnswers || 0}
              subtitle="Total responses"
            />
            <StatCard
              icon={<TrendingUp size={18} color={colors.success} strokeWidth={1.5} />}
              title="Earned"
              value={formatCurrency(userStats?.totalEarnings || 0)}
              subtitle="Lifetime rewards"
            />
          </View>

          {/* Instant Reward Questions */}
          <SectionHeader
            title="Instant-reward questions"
            subtitle="Answer now and earn immediately"
            icon={<Sparkles size={18} color={colors.warning} strokeWidth={1.5} />}
            onSeeAll={handleInstantRewardBrowse}
          />
          <View style={styles.questionsList}>
            {instantQuestions?.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                variant="compact"
                onPress={() => handleQuestionPress(q.id)}
              />
            ))}
            {(!instantQuestions || instantQuestions.length === 0) && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No instant questions right now</Text>
              </View>
            )}
          </View>

          {/* Reward Questions */}
          <SectionHeader
            title="Reward questions"
            subtitle="Answer curated questions for instant payouts"
            icon={<Award size={18} color={colors.success} strokeWidth={1.5} />}
            onSeeAll={() => router.push("/(tabs)/questions")}
          />
          <View style={styles.questionsList}>
            {rewardLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            {!rewardLoading && rewardQuestionCards.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                variant="compact"
                onPress={() => handleRewardQuestionPress(question.id)}
              />
            ))}
            {!rewardLoading && rewardQuestionCards.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No reward questions available</Text>
              </View>
            )}
          </View>

          {/* Recent Questions */}
          <SectionHeader
            title="Recent questions"
            subtitle="Fresh topics to answer"
            icon={<Clock3 size={18} color={colors.info} strokeWidth={1.5} />}
            onSeeAll={() => router.push("/(tabs)/questions")}
          />
          <View style={styles.questionsList}>
            {recentQuestions?.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                variant="compact"
                onPress={() => handleQuestionPress(q.id)}
              />
            ))}
          </View>

          {/* Answer & Earn CTA */}
          <View style={[styles.earnCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Answer questions and earn rewards"
          >
            <View style={styles.earnLeft}>
              <Text style={[styles.earnTitle, { color: colors.text }]}>Answer questions and earn</Text>
              <Text style={[styles.earnSubtitle, { color: colors.textMuted }]}>
                Pick a question, submit quality answers, and get instant or scheduled rewards.
              </Text>
              <PrimaryButton
                title="Start Answering"
                onPress={() => router.push("/(tabs)/questions")}
                variant="secondary"
              />
            </View>
            <View style={[styles.earnBadge, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
              <Coins size={20} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.earnBadgeText, { color: colors.success }]}>Earn rewards</Text>
            </View>
          </View>

          {/* Upload Questions (Admin only) */}
          {isAdmin && (
            <View style={[styles.adminCard, { backgroundColor: colors.card }]}
              accessibilityLabel="Upload questions as admin"
            >
              <View style={styles.adminHeader}>
                <UploadIcon size={18} color={colors.text} strokeWidth={1.5} />
                <Text style={[styles.adminTitle, { color: colors.text }]}>Upload questions (Admin)</Text>
              </View>
              <Text style={[styles.adminSubtitle, { color: colors.textMuted }]}>Bulk import questions to speed up publishing.</Text>
              <View style={styles.uploadRow}>
                <TouchableOpacity style={[styles.uploadButton, { borderColor: colors.border }]}>
                  <FileSpreadsheet size={18} color={colors.text} strokeWidth={1.5} />
                  <Text style={[styles.uploadText, { color: colors.text }]}>Upload CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadButton, { borderColor: colors.border }]}>
                  <FileJson size={18} color={colors.text} strokeWidth={1.5} />
                  <Text style={[styles.uploadText, { color: colors.text }]}>Upload JSON</Text>
                </TouchableOpacity>
              </View>
              <PrimaryButton title="Review & Publish" onPress={() => {}} />
            </View>
          )}

          {/* Ad Registration Card */}
          <View style={[styles.adminCard, { backgroundColor: colors.card }]}
            accessibilityLabel="Ad registration"
          >
            <View style={styles.adminHeader}>
              <BadgeCheck size={18} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.adminTitle, { color: colors.text }]}>Ad registration</Text>
            </View>
            <Text style={[styles.adminSubtitle, { color: colors.textMuted }]}>
              {isAdmin ? "Manage ad slots, verify payments, and approve campaigns." : "Submit your ad and track verification."}
            </Text>

            {/* Stepwise navigation */}
            <View style={styles.stepsRow}>
              <StepPill label="Details" active color={colors.primary} />
              <StepPill label="Payment" active={!isAdmin} color={colors.warning} />
              <StepPill label="Approval" active={isAdmin} color={colors.success} />
            </View>

            {/* Payment verification */}
            <View style={[styles.noteBox, { borderColor: withAlpha(colors.warning, 0.4) }]}>
              <ShieldCheck size={16} color={colors.warning} strokeWidth={1.5} />
              <Text style={[styles.noteText, { color: colors.text }]}>Payment verification required before activation.</Text>
            </View>

            {/* Approval workflow */}
            <View style={[styles.workflowRow, { backgroundColor: withAlpha(colors.secondary, 0.4) }]}>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.workflowText, { color: colors.text }]}>Approval workflow: Submitted → Payment verified → Admin approval → Live</Text>
            </View>

            <PrimaryButton
              title={isAdmin ? "Manage ads" : "Start ad registration"}
              onPress={() => router.push("/ad-registration")}
              variant={isAdmin ? "ghost" : "primary"}
            />
          </View>

          {/* All Questions List */}
          <SectionHeader
            title="All questions"
            subtitle="Browse and answer"
            icon={<Search size={18} color={colors.text} strokeWidth={1.5} />}
          />
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.questionsList}>
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  variant="default"
                  onPress={() => handleQuestionPress(question.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  interface StepPillProps {
    label: string;
    active?: boolean;
    color: string;
  }

  function StepPill({ label, active, color }: StepPillProps): React.ReactElement {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          borderRadius: RADIUS.full,
          backgroundColor: active ? withAlpha(color, 0.15) : "transparent",
          borderWidth: active ? 0 : 1,
          borderColor: withAlpha(color, 0.4),
          gap: SPACING.xs,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
        <Text
          style={{
            fontFamily: TYPOGRAPHY.fontFamily.medium,
            fontSize: TYPOGRAPHY.fontSize.xs,
            color: color,
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactElement;
  badgeLabel?: string;
  badgeColor?: string;
  disabled?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}

function ActionCard({
  title,
  subtitle,
  icon,
  badgeLabel,
  badgeColor,
  disabled,
  onPress,
  colors,
}: ActionCardProps): React.ReactElement {
  return (
    <View
      style={[
        styles.actionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionHeader}>
        <View style={[styles.actionIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          {icon}
        </View>
        {badgeLabel && (
          <View style={[styles.actionBadge, { backgroundColor: withAlpha(badgeColor || colors.textMuted, 0.15) }]}>
            <Text style={[styles.actionBadgeText, { color: badgeColor || colors.textMuted }]}>{badgeLabel}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      <PrimaryButton
        title={disabled ? "Admin only" : "Open"}
        onPress={onPress}
        disabled={disabled}
        style={styles.actionButton}
      />
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
      justifyContent: "space-between",
      alignItems: "center",
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
    addButton: {
      width: COMPONENT_SIZE.touchTarget,
      height: COMPONENT_SIZE.touchTarget,
      borderRadius: RADIUS.base,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      width: COMPONENT_SIZE.touchTarget,
      height: COMPONENT_SIZE.touchTarget,
      borderRadius: RADIUS.base,
      alignItems: "center",
      justifyContent: "center",
    },
    askCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    askTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
      marginBottom: SPACING.xs,
    },
    askSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.md,
    },
    inputGroup: {
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    statsRow: {
      flexDirection: "row",
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    questionsList: {
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    emptyState: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    actionGrid: {
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    actionCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      gap: SPACING.sm,
    },
    actionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    actionIcon: {
      width: ICON_SIZE.lg,
      height: ICON_SIZE.lg,
      borderRadius: RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBadge: {
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    actionBadgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    actionTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    actionSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      lineHeight: 20,
    },
    actionButton: {
      marginTop: SPACING.md,
    },
    earnCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    earnLeft: {
      flex: 1,
      gap: SPACING.sm,
    },
    earnTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    earnSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    earnBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
    },
    earnBadgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    adminCard: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    adminHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    adminTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    adminSubtitle: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.md,
    },
    uploadRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    uploadButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    uploadText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    stepsRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    noteBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    noteText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    workflowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    workflowText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.lg,
    },
    // Upload form styles
    uploadForm: {
      padding: SPACING.lg,
      gap: SPACING.lg,
    },
    formGroup: {
      gap: SPACING.sm,
    },
    formRow: {
      flexDirection: "row",
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    uploadInput: {
      borderWidth: BORDER_WIDTH.thin,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
      minHeight: COMPONENT_SIZE.input.medium,
    },
    paymentProviderRow: {
      flexDirection: "row",
      gap: SPACING.sm,
    },
    paymentProviderOption: {
      flex: 1,
      borderWidth: BORDER_WIDTH.thin,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center",
      justifyContent: "center",
    },
    paymentProviderText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
  });
