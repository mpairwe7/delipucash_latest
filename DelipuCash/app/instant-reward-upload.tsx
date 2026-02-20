/**
 * Instant Reward Upload Screen
 * Admin-only screen for creating instant reward questions
 */

import {
  PrimaryButton,
  SectionHeader,
} from "@/components";
import { useCreateRewardQuestion } from "@/services/hooks";
import { UserRole } from "@/types";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useToast } from "@/components/ui/Toast";
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
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Coins,
  Sparkles,
  RefreshCw,
} from "lucide-react-native";
import React, { useState, useCallback, useRef } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pointsToCash, cashToPoints, REWARD_CONSTANTS } from "@/store/InstantRewardStore";
import { useRewardConfig } from "@/services/configHooks";

export default function InstantRewardUploadScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, loading: userLoading } = useUser();
  const createQuestion = useCreateRewardQuestion();
  const { showToast } = useToast();
  const { data: rewardConfig } = useRewardConfig();
  const submitDebounceRef = useRef(false);

  const [questionText, setQuestionText] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [option4, setOption4] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const isSyncingRef = useRef(false);
  const [maxWinners, setMaxWinners] = useState("2");
  const [expiryHours, setExpiryHours] = useState("24");
  const [paymentProvider, setPaymentProvider] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Bidirectional sync: UGX ↔ Points
  const handleRewardAmountChange = useCallback((text: string) => {
    setRewardAmount(text);
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const ugx = parseFloat(text);
    setRewardPoints(isNaN(ugx) || ugx <= 0 ? '' : String(cashToPoints(ugx)));
    isSyncingRef.current = false;
  }, []);

  const handleRewardPointsChange = useCallback((text: string) => {
    setRewardPoints(text);
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const pts = parseFloat(text);
    setRewardAmount(isNaN(pts) || pts <= 0 ? '' : String(pointsToCash(pts)));
    isSyncingRef.current = false;
  }, []);

  // Admin access check
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

  // Redirect non-admins
  if (!userLoading && !isAdmin) {
    Alert.alert("Access Denied", "Only administrators can upload instant reward questions.", [
      { text: "OK", onPress: () => router.back() }
    ]);
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  const handleUpload = async () => {
    // Debounce protection
    if (submitDebounceRef.current) return;
    submitDebounceRef.current = true;
    setTimeout(() => { submitDebounceRef.current = false; }, 1000);

    // Validate required fields
    if (!questionText.trim()) {
      triggerHaptic('warning');
      showToast({ message: 'Question text is required', type: 'warning' });
      return;
    }

    const options = [option1, option2, option3, option4]
      .filter(opt => opt.trim())
      .map(opt => opt.trim());

    if (options.length < 2) {
      triggerHaptic('warning');
      showToast({ message: 'At least 2 options are required', type: 'warning' });
      return;
    }

    if (!correctAnswer.trim()) {
      triggerHaptic('warning');
      showToast({ message: 'Correct answer is required', type: 'warning' });
      return;
    }

    // Validate correct answer matches one of the options (case-insensitive)
    const matchingOption = options.find(
      opt => opt.toLowerCase() === correctAnswer.trim().toLowerCase()
    );
    if (!matchingOption) {
      triggerHaptic('warning');
      showToast({ message: 'Correct answer must match one of the options', type: 'warning' });
      return;
    }

    const parsedReward = parseFloat(rewardAmount);
    if (!rewardAmount.trim() || isNaN(parsedReward) || parsedReward <= 0) {
      triggerHaptic('warning');
      showToast({ message: 'Valid reward amount is required', type: 'warning' });
      return;
    }

    const parsedMaxWinners = parseInt(maxWinners) || 2;
    const parsedExpiryHours = parseInt(expiryHours) || 24;

    if (!phoneNumber.trim()) {
      triggerHaptic('warning');
      showToast({ message: 'Phone number is required for payouts', type: 'warning' });
      return;
    }

    if (!user) {
      triggerHaptic('error');
      showToast({ message: 'User not found. Please log in again.', type: 'error' });
      return;
    }

    const expiryTime = new Date(Date.now() + parsedExpiryHours * 60 * 60 * 1000).toISOString();

    try {
      await createQuestion.mutateAsync({
        text: questionText.trim(),
        options,
        correctAnswer: matchingOption,
        rewardAmount: parsedReward,
        expiryTime,
        userId: user.id,
        isInstantReward: true,
        maxWinners: parsedMaxWinners,
        paymentProvider,
        phoneNumber: phoneNumber.trim(),
      });

      triggerHaptic('success');
      showToast({
        message: 'Instant reward question uploaded successfully!',
        type: 'success',
        duration: 4000,
        action: 'Go Back',
        onAction: () => router.back(),
      });
    } catch (error) {
      triggerHaptic('error');
      showToast({
        message: error instanceof Error ? error.message : 'Failed to upload question',
        type: 'error',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
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
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.secondary }]}
            onPress={() => { triggerHaptic('light'); router.back(); }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous screen"
            hitSlop={8}
          >
            <ArrowLeft size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Instant Reward</Text>
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
              style={[styles.uploadInput, styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="Enter the question"
              placeholderTextColor={colors.textMuted}
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel="Question text input"
              accessibilityHint="Enter the question text for the instant reward"
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
                style={[styles.uploadInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="First option"
                placeholderTextColor={colors.textMuted}
                value={option1}
                onChangeText={setOption1}
                accessibilityLabel="Answer option 1"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
              <Text style={[styles.label, { color: colors.text }]}>Option 2 *</Text>
              <TextInput
                style={[styles.uploadInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
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
            <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.xs }]}>
              <Text style={[styles.label, { color: colors.text }]}>Reward (UGX) *</Text>
              <TextInput
                style={[styles.uploadInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={rewardAmount}
                onChangeText={handleRewardAmountChange}
                keyboardType="numeric"
                accessibilityLabel="Reward amount in UGX"
              />
            </View>
            <View style={styles.syncIconContainer}>
              <RefreshCw size={14} color={colors.textMuted} />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
              <Text style={[styles.label, { color: colors.text }]}>Points</Text>
              <TextInput
                style={[styles.uploadInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={rewardPoints}
                onChangeText={handleRewardPointsChange}
                keyboardType="numeric"
                accessibilityLabel="Reward amount in points"
              />
            </View>
          </View>
          <Text style={[styles.conversionHint, { color: colors.textMuted }]}>
            {rewardConfig
              ? `${rewardConfig.pointsToCashDenominator} points = ${rewardConfig.pointsToCashNumerator} UGX`
              : '1 point = 100 UGX'}
          </Text>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>Max Winners (1-10)</Text>
              <TextInput
                style={[styles.uploadInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
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
              {(["MTN", "AIRTEL"] as const).map((provider) => (
                <Pressable
                  key={provider}
                  style={[
                    styles.paymentProviderOption,
                    {
                      borderColor: paymentProvider === provider ? colors.primary : colors.border,
                      backgroundColor: paymentProvider === provider ? withAlpha(colors.primary, 0.1) : colors.card,
                    }
                  ]}
                  onPress={() => { triggerHaptic('selection'); setPaymentProvider(provider); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: paymentProvider === provider }}
                  accessibilityLabel={`${provider} payment provider`}
                >
                  <Text style={[
                    styles.paymentProviderText,
                    { color: paymentProvider === provider ? colors.primary : colors.text }
                  ]}>
                    {provider === 'MTN' ? 'MTN' : 'Airtel'}
                  </Text>
                </Pressable>
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
            title="Create Instant Reward"
            onPress={handleUpload}
            loading={createQuestion.isPending}
            style={{ marginTop: SPACING.lg }}
            accessibilityLabel="Create instant reward question"
            accessibilityHint="Submits the form to create a new instant reward question"
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  uploadForm: {
    gap: SPACING.md,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  uploadInput: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.medium,
  },
  multilineInput: {
    minHeight: COMPONENT_SIZE.input.medium * 2,
    paddingTop: SPACING.md,
  },
  paymentProviderRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  paymentProviderOption: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    alignItems: 'center',
  },
  paymentProviderText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  syncIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    width: 24,
  },
  conversionHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
  },
});
