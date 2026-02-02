import React, { useState, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CreditCard,
  ChevronRight,
  DollarSign,
  Phone,
  AlertCircle,
  CheckCircle,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import {
  useTheme,
  ThemeColors,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  COMPONENT_SIZE,
  BORDER_WIDTH,
} from "@/utils/theme";
import { router, Href } from "expo-router";
import {
  paymentMethods,
  formatCurrency,
} from "@/services/api";
import { useWithdraw, useUnreadCount } from "@/services/hooks";
import useUser from "@/utils/useUser";
import { useFormValidation, validators } from "@/utils/validation";
import { NotificationBell } from "@/components";

interface PaymentMethod {
  id: string;
  name: string;
  minWithdrawal: number;
  maxWithdrawal: number;
  processingTime: string;
}

interface FormValues {
  amount: string;
  phoneNumber: string;
}

interface FormState {
  values: FormValues;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  handleChange: (name: string, value: string) => void;
  handleBlur: (name: string) => void;
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
  colors: ThemeColors;
  onPress: () => void;
}

const PaymentMethodCard = memo<PaymentMethodCardProps>(
  ({ method, colors, onPress }) => (
    <TouchableOpacity
      style={[styles.methodCard, { backgroundColor: colors.card }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${method.name}`}
    >
      <View style={[styles.methodIcon, { backgroundColor: colors.secondary }]}>
        <CreditCard size={24} color={colors.text} strokeWidth={1.5} />
      </View>

      <View style={styles.methodInfo}>
        <Text style={[styles.methodName, { color: colors.text }]}>
          {method.name}
        </Text>
        <Text style={[styles.methodDetails, { color: colors.textMuted }]}>
          {formatCurrency(method.minWithdrawal)} -{" "}
          {formatCurrency(method.maxWithdrawal)} • {method.processingTime}
        </Text>
      </View>

      <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.5} />
    </TouchableOpacity>
  )
);

PaymentMethodCard.displayName = "PaymentMethodCard";

/**
 * Withdraw screen component
 * Handles the multi-step withdrawal process
 */
export default function WithdrawScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  
  const { data: user } = useUser();
  const { data: unreadCount } = useUnreadCount();
  const withdrawMutation = useWithdraw();
  
  const walletBalance = user?.walletBalance || 0;
  const phoneNumber = user?.phone || user?.telephone || "";

  const validationSchema = {
    amount: [
      validators.required,
      validators.numeric,
      validators.min(selectedMethod?.minWithdrawal || 5),
      validators.max(
        Math.min(
          selectedMethod?.maxWithdrawal || 1000,
          walletBalance
        )
      ),
    ],
    phoneNumber: [validators.required, validators.phoneNumber],
  };

  const form = useFormValidation(
    { amount: "", phoneNumber },
    validationSchema
  ) as FormState;

  const handleMethodSelect = (method: PaymentMethod): void => {
    setSelectedMethod(method);
    setStep(2);
  };

  const handleSubmit = (): void => {
    const isValid = Object.keys(validationSchema).every((key) => {
      const value = form.values[key as keyof FormValues];
      const rules = validationSchema[key as keyof typeof validationSchema];
      return !rules.some((rule) => rule(value, key));
    });

    if (!isValid) {
      Alert.alert("Validation Error", "Please check your inputs");
      return;
    }

    setStep(3);
  };

  const handleConfirm = async (): Promise<void> => {
    if (!selectedMethod) return;

    withdrawMutation.mutate(
      {
        amount: parseFloat(form.values.amount),
        provider: selectedMethod.id,
        phoneNumber: form.values.phoneNumber,
      },
      {
        onSuccess: () => {
          setStep(4);
        },
        onError: () => {
          Alert.alert("Error", "Withdrawal failed. Please try again.");
        },
      }
    );
  };

  const handleDone = (): void => {
    router.back();
  };

  const renderStepIndicator = (): React.ReactElement => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.stepBar,
            {
              backgroundColor: s <= step ? colors.primary : colors.secondary,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = (): React.ReactElement => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Select Payment Method
      </Text>

      <View style={styles.methodsList}>
        {(paymentMethods as PaymentMethod[]).map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            colors={colors}
            onPress={() => handleMethodSelect(method)}
          />
        ))}
      </View>
    </View>
  );

  const renderStep2 = (): React.ReactElement | null => {
    if (!selectedMethod) return null;

    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Enter Details
        </Text>

        {/* Selected Method Card */}
        <View style={[styles.selectedMethodCard, { backgroundColor: colors.card }]}>
          <CreditCard size={20} color={colors.primary} strokeWidth={1.5} />
          <Text style={[styles.selectedMethodText, { color: colors.text }]}>
            {selectedMethod.name}
          </Text>
        </View>

        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Amount *</Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderColor:
                  form.errors.amount && form.touched.amount
                    ? colors.error
                    : colors.border,
              },
            ]}
          >
            <DollarSign size={20} color={colors.textMuted} strokeWidth={1.5} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={form.values.amount}
              onChangeText={(value) => form.handleChange("amount", value)}
              onBlur={() => form.handleBlur("amount")}
            />
          </View>
          {form.errors.amount && form.touched.amount && (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color={colors.error} strokeWidth={1.5} />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {form.errors.amount}
              </Text>
            </View>
          )}
          <Text style={[styles.inputHint, { color: colors.textMuted }]}>
            Min: {formatCurrency(selectedMethod.minWithdrawal)} • Max:{" "}
            {formatCurrency(
              Math.min(selectedMethod.maxWithdrawal, walletBalance)
            )}
          </Text>
        </View>

        {/* Phone Number Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Phone Number *
          </Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderColor:
                  form.errors.phoneNumber && form.touched.phoneNumber
                    ? colors.error
                    : colors.border,
              },
            ]}
          >
            <Phone size={20} color={colors.textMuted} strokeWidth={1.5} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="+256 XXX XXX XXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={form.values.phoneNumber}
              onChangeText={(value) => form.handleChange("phoneNumber", value)}
              onBlur={() => form.handleBlur("phoneNumber")}
            />
          </View>
          {form.errors.phoneNumber && form.touched.phoneNumber && (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color={colors.error} strokeWidth={1.5} />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {form.errors.phoneNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
            onPress={() => setStep(1)}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep3 = (): React.ReactElement | null => {
    if (!selectedMethod) return null;

    return (
      <View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Confirm Withdrawal
        </Text>

        <View style={[styles.confirmCard, { backgroundColor: colors.card }]}>
          {/* Amount */}
          <View style={styles.confirmAmount}>
            <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>
              Withdrawal Amount
            </Text>
            <Text style={[styles.confirmValue, { color: colors.text }]}>
              {formatCurrency(parseFloat(form.values.amount) || 0)}
            </Text>
          </View>

          {/* Details */}
          <View style={styles.confirmDetails}>
            <View style={styles.confirmRow}>
              <Text style={[styles.confirmDetailLabel, { color: colors.textMuted }]}>
                Payment Method
              </Text>
              <Text style={[styles.confirmDetailValue, { color: colors.text }]}>
                {selectedMethod.name}
              </Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmDetailLabel, { color: colors.textMuted }]}>
                Phone Number
              </Text>
              <Text style={[styles.confirmDetailValue, { color: colors.text }]}>
                {form.values.phoneNumber}
              </Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmDetailLabel, { color: colors.textMuted }]}>
                Processing Time
              </Text>
              <Text style={[styles.confirmDetailValue, { color: colors.text }]}>
                {selectedMethod.processingTime}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmTotalLabel, { color: colors.text }]}>
                New Balance
              </Text>
              <Text style={[styles.confirmTotalValue, { color: colors.text }]}>
                {formatCurrency(
                  walletBalance -
                    parseFloat(form.values.amount || "0")
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
            onPress={() => setStep(2)}
            disabled={withdrawMutation.isPending}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
            disabled={withdrawMutation.isPending}
          >
            {withdrawMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Confirm Withdrawal
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep4 = (): React.ReactElement | null => {
    if (!selectedMethod) return null;

    return (
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
          <CheckCircle size={48} color={colors.success} strokeWidth={1.5} />
        </View>

        <Text style={[styles.successTitle, { color: colors.text }]}>
          Withdrawal Initiated
        </Text>

        <Text style={[styles.successMessage, { color: colors.textMuted }]}>
          Your withdrawal of {formatCurrency(parseFloat(form.values.amount) || 0)} has been
          submitted.{"\n"}
          Funds will arrive within {selectedMethod.processingTime}.
        </Text>

        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={handleDone}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Withdraw
            </Text>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Available balance: {formatCurrency(walletBalance)}
          </Text>
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
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
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
  },
  headerSubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  stepBar: {
    flex: 1,
    height: 4,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  stepContent: {
    gap: 12,
  },
  stepTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 20,
    marginBottom: 12,
  },
  methodsList: {
    gap: 12,
  },
  methodCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
    marginBottom: 4,
  },
  methodDetails: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
  },
  selectedMethodCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedMethodText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 15,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 8,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  errorText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    marginLeft: 4,
  },
  inputHint: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 15,
  },
  confirmCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  confirmAmount: {
    alignItems: "center",
    marginBottom: 24,
  },
  confirmLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginBottom: 8,
  },
  confirmValue: {
    fontFamily: "Roboto_700Bold",
    fontSize: 36,
  },
  confirmDetails: {
    gap: 16,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmDetailLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
  },
  confirmDetailValue: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  confirmTotalLabel: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
  confirmTotalValue: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 24,
    marginBottom: 8,
  },
  successMessage: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
  },
  doneButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
