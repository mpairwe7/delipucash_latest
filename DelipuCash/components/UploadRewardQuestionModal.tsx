import React, { useState, useRef } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { FormInput } from "./FormInput";
import { PrimaryButton } from "./PrimaryButton";
import { useToast } from "./ui/Toast";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
} from "@/utils/theme";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useCreateRewardQuestion } from "@/services/hooks";
import useUser from "@/utils/useUser";

interface UploadRewardQuestionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadRewardQuestionModal({
  visible,
  onClose,
}: UploadRewardQuestionModalProps): React.ReactElement {
  const { colors } = useTheme();
  const { data: user } = useUser();
  const createQuestion = useCreateRewardQuestion();
  const { showToast } = useToast();
  const submitDebounceRef = useRef(false);

  const [formData, setFormData] = useState({
    text: "",
    option1: "",
    option2: "",
    option3: "",
    option4: "",
    correctAnswer: "",
    rewardAmount: "",
    maxWinners: "2",
    expiryHours: "24",
    paymentProvider: "MTN",
    phoneNumber: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.text.trim()) {
      newErrors.text = "Question text is required";
    }

    if (!formData.option1.trim() || !formData.option2.trim()) {
      newErrors.options = "At least 2 options are required";
    }

    if (!formData.correctAnswer.trim()) {
      newErrors.correctAnswer = "Correct answer is required";
    } else {
      // Get all non-empty options with their original casing
      const options = [formData.option1, formData.option2, formData.option3, formData.option4]
        .filter(opt => opt.trim())
        .map(opt => opt.trim());
      
      // Find the matching option using case-insensitive comparison
      const matchingOption = options.find(
        opt => opt.toLowerCase() === formData.correctAnswer.trim().toLowerCase()
      );
      
      if (!matchingOption) {
        newErrors.correctAnswer = "Correct answer must match one of the options";
      } else {
        // Normalize correctAnswer to match the exact casing of the option
        formData.correctAnswer = matchingOption;
      }
    }

    const rewardAmount = parseFloat(formData.rewardAmount);
    if (!formData.rewardAmount || isNaN(rewardAmount) || rewardAmount <= 0) {
      newErrors.rewardAmount = "Valid reward amount is required";
    }

    /**
     * Max winners limit (1-10):
     * - Prevents excessive reward payouts that could strain platform budget
     * - Ensures meaningful reward amounts per winner (total pool / winners)
     * - Aligns with common quiz/trivia app patterns for scarcity-driven engagement
     * - Can be adjusted via server-side config if business requirements change
     */
    const maxWinners = parseInt(formData.maxWinners);
    if (!formData.maxWinners || isNaN(maxWinners) || maxWinners < 1 || maxWinners > 10) {
      newErrors.maxWinners = "Max winners must be between 1 and 10";
    }

    /**
     * Expiry hours limit (1-168 hours = 1 week max):
     * - Minimum 1 hour ensures questions remain active long enough for participation
     * - Maximum 168 hours (1 week) prevents stale content and ensures timely payouts
     */
    const expiryHours = parseInt(formData.expiryHours);
    if (!formData.expiryHours || isNaN(expiryHours) || expiryHours < 1 || expiryHours > 168) {
      newErrors.expiryHours = "Expiry hours must be between 1 and 168";
    }

    if (!formData.paymentProvider) {
      newErrors.paymentProvider = "Payment provider is required";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      triggerHaptic('warning');
      return;
    }
    if (submitDebounceRef.current) return;

    if (!user) {
      triggerHaptic('error');
      showToast({ message: 'User not found. Please log in again.', type: 'error' });
      return;
    }

    const options = [formData.option1, formData.option2, formData.option3, formData.option4]
      .filter(opt => opt.trim())
      .map(opt => opt.trim());

    const expiryTime = new Date(Date.now() + parseInt(formData.expiryHours) * 60 * 60 * 1000).toISOString();

    triggerHaptic('medium');
    submitDebounceRef.current = true;

    try {
      await createQuestion.mutateAsync({
        text: formData.text.trim(),
        options,
        correctAnswer: formData.correctAnswer.trim(),
        rewardAmount: parseFloat(formData.rewardAmount),
        expiryTime,
        userId: user.id,
        isInstantReward: true,
        maxWinners: parseInt(formData.maxWinners),
        paymentProvider: formData.paymentProvider,
        phoneNumber: formData.phoneNumber.trim(),
      });

      submitDebounceRef.current = false;
      triggerHaptic('success');
      showToast({
        message: 'Reward question created successfully!',
        type: 'success',
        action: 'Done',
        onAction: handleClose,
      });
    } catch (error) {
      submitDebounceRef.current = false;
      triggerHaptic('error');
      showToast({
        message: error instanceof Error ? error.message : 'Failed to create question',
        type: 'error',
      });
    }
  };

  const handleClose = () => {
    setFormData({
      text: "",
      option1: "",
      option2: "",
      option3: "",
      option4: "",
      correctAnswer: "",
      rewardAmount: "",
      maxWinners: "2",
      expiryHours: "24",
      paymentProvider: "MTN",
      phoneNumber: "",
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Upload Instant Reward Question</Text>
            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.secondary }]}
              onPress={() => { triggerHaptic('light'); handleClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              accessibilityHint="Closes the upload reward question form"
              hitSlop={8}
            >
              <X size={ICON_SIZE.lg} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Question Text */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Question</Text>
              <FormInput
                placeholder="Enter your question"
                value={formData.text}
                onChangeText={(text) => setFormData(prev => ({ ...prev, text }))}
                multiline
                numberOfLines={3}
                error={errors.text}
              />
            </View>

            {/* Options */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Answer Options (at least 2 required)</Text>
              <FormInput
                placeholder="Option 1"
                value={formData.option1}
                onChangeText={(text) => setFormData(prev => ({ ...prev, option1: text }))}
                error={errors.options}
              />
              <FormInput
                placeholder="Option 2"
                value={formData.option2}
                onChangeText={(text) => setFormData(prev => ({ ...prev, option2: text }))}
                error={errors.options}
              />
              <FormInput
                placeholder="Option 3 (optional)"
                value={formData.option3}
                onChangeText={(text) => setFormData(prev => ({ ...prev, option3: text }))}
              />
              <FormInput
                placeholder="Option 4 (optional)"
                value={formData.option4}
                onChangeText={(text) => setFormData(prev => ({ ...prev, option4: text }))}
              />
            </View>

            {/* Correct Answer */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Correct Answer</Text>
              <FormInput
                placeholder="Enter the correct answer (must match one of the options)"
                value={formData.correctAnswer}
                onChangeText={(text) => setFormData(prev => ({ ...prev, correctAnswer: text }))}
                error={errors.correctAnswer}
              />
            </View>

            {/* Reward Settings */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Reward Settings</Text>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <FormInput
                    placeholder="Reward Amount ($)"
                    value={formData.rewardAmount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, rewardAmount: text }))}
                    keyboardType="numeric"
                    error={errors.rewardAmount}
                  />
                </View>
                <View style={styles.halfInput}>
                  <FormInput
                    placeholder="Max Winners"
                    value={formData.maxWinners}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, maxWinners: text }))}
                    keyboardType="numeric"
                    error={errors.maxWinners}
                  />
                </View>
              </View>
              <FormInput
                placeholder="Expiry Hours (1-168)"
                value={formData.expiryHours}
                onChangeText={(text) => setFormData(prev => ({ ...prev, expiryHours: text }))}
                keyboardType="numeric"
                error={errors.expiryHours}
              />
            </View>

            {/* Payment Settings */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Settings</Text>
              <FormInput
                placeholder="Payment Provider (MTN/AIRTEL)"
                value={formData.paymentProvider}
                onChangeText={(text) => setFormData(prev => ({ ...prev, paymentProvider: text.toUpperCase() }))}
                error={errors.paymentProvider}
              />
              <FormInput
                placeholder="Phone Number"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
                keyboardType="phone-pad"
                error={errors.phoneNumber}
              />
            </View>

            {/* Submit Button */}
            <PrimaryButton
              title="Create Question"
              onPress={handleSubmit}
              loading={createQuestion.isPending}
              style={styles.submitButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
  },
  closeButton: {
    width: COMPONENT_SIZE.avatar.sm,
    height: COMPONENT_SIZE.avatar.sm,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    marginTop: SPACING.sm,
  },
});