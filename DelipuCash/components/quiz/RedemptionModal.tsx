/**
 * Reward Redemption Modal Component
 * 
 * A modal for redeeming instant reward earnings to Cash or Airtime.
 * Features:
 * - Type selection (Cash/Airtime)
 * - Amount selection with predefined options
 * - Provider selection (MTN/Airtel)
 * - Phone number input
 * - Confirmation and status feedback
 * - Industry-standard design patterns
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  X,
  Banknote,
  Smartphone,
  Check,
  AlertCircle,
  Phone,
  ChevronRight,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { formatCurrency } from '@/data/mockData';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  REWARD_CONSTANTS,
  RewardRedemptionType,
  PaymentProvider,
  pointsToCash,
} from '@/store/InstantRewardStore';
import { triggerHaptic } from '@/utils/quiz-utils';

// ===========================================
// Types
// ===========================================

export interface RedemptionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Total available points for redemption (in UGX) */
  availableAmount: number;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when redemption is confirmed */
  onRedeem: (
    amount: number,
    type: RewardRedemptionType,
    provider: PaymentProvider,
    phoneNumber: string
  ) => Promise<{ success: boolean; message?: string }>;
  /** Whether redemption is in progress */
  isLoading?: boolean;
}

type RedemptionStep = 'SELECT_TYPE' | 'SELECT_AMOUNT' | 'ENTER_DETAILS' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

// ===========================================
// Main Component
// ===========================================

export const RedemptionModal: React.FC<RedemptionModalProps> = ({
  visible,
  availableAmount,
  onClose,
  onRedeem,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  
  // State
  const [step, setStep] = useState<RedemptionStep>('SELECT_TYPE');
  const [selectedType, setSelectedType] = useState<RewardRedemptionType | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('SELECT_TYPE');
      setSelectedType(null);
      setSelectedAmount(0);
      setPhoneNumber('');
      setError(null);
      setSuccessMessage(null);
    }
  }, [visible]);

  // Get available redemption options based on available amount
  const availablePoints = Math.floor(availableAmount / REWARD_CONSTANTS.POINTS_TO_UGX_RATE);
  const redemptionOptions = REWARD_CONSTANTS.REDEMPTION_OPTIONS.filter(
    opt => opt.points <= availablePoints
  );

  // Handlers
  const handleSelectType = useCallback((type: RewardRedemptionType) => {
    triggerHaptic('selection');
    setSelectedType(type);
    setStep('SELECT_AMOUNT');
  }, []);

  const handleSelectAmount = useCallback((points: number) => {
    triggerHaptic('selection');
    setSelectedAmount(points);
    setStep('ENTER_DETAILS');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedType || !selectedAmount || !phoneNumber) {
      setError('Please fill in all details');
      return;
    }

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      setError('Please enter a valid phone number');
      return;
    }

    triggerHaptic('medium');
    setStep('PROCESSING');
    setError(null);

    try {
      const cashValue = pointsToCash(selectedAmount);
      const result = await onRedeem(
        cashValue,
        selectedType,
        selectedProvider,
        cleanPhone
      );

      if (result.success) {
        triggerHaptic('success');
        setSuccessMessage(result.message || `${formatCurrency(cashValue)} sent to your ${selectedProvider} number!`);
        setStep('SUCCESS');
      } else {
        triggerHaptic('error');
        setError(result.message || 'Redemption failed. Please try again.');
        setStep('ERROR');
      }
    } catch (err) {
      triggerHaptic('error');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('ERROR');
    }
  }, [selectedType, selectedAmount, phoneNumber, selectedProvider, onRedeem]);

  const handleBack = useCallback(() => {
    switch (step) {
      case 'SELECT_AMOUNT':
        setStep('SELECT_TYPE');
        break;
      case 'ENTER_DETAILS':
      case 'CONFIRM':
        setStep('SELECT_AMOUNT');
        break;
      case 'ERROR':
        setStep('ENTER_DETAILS');
        break;
      default:
        break;
    }
  }, [step]);

  const handleClose = useCallback(() => {
    triggerHaptic('light');
    onClose();
  }, [onClose]);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'SELECT_TYPE':
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Choose Redemption Type
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              How would you like to receive your rewards?
            </Text>
            
            <View style={styles.typeOptions}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { backgroundColor: withAlpha(colors.success, 0.1), borderColor: colors.success },
                ]}
                onPress={() => handleSelectType('CASH')}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIconContainer, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
                  <Banknote size={32} color={colors.success} strokeWidth={1.5} />
                </View>
                <Text style={[styles.typeLabel, { color: colors.success }]}>Cash</Text>
                <Text style={[styles.typeDescription, { color: colors.textMuted }]}>
                  Receive money directly to your mobile money account
                </Text>
                <ChevronRight size={ICON_SIZE.md} color={colors.success} strokeWidth={1.5} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { backgroundColor: withAlpha(colors.info, 0.1), borderColor: colors.info },
                ]}
                onPress={() => handleSelectType('AIRTIME')}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIconContainer, { backgroundColor: withAlpha(colors.info, 0.15) }]}>
                  <Smartphone size={32} color={colors.info} strokeWidth={1.5} />
                </View>
                <Text style={[styles.typeLabel, { color: colors.info }]}>Airtime</Text>
                <Text style={[styles.typeDescription, { color: colors.textMuted }]}>
                  Get airtime top-up instantly on your phone
                </Text>
                <ChevronRight size={ICON_SIZE.md} color={colors.info} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'SELECT_AMOUNT':
        return (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Select Amount
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              Available: {formatCurrency(availableAmount)} ({availablePoints} pts)
            </Text>
            
            <View style={styles.amountOptions}>
              {redemptionOptions.length > 0 ? (
                redemptionOptions.map((option) => (
                  <TouchableOpacity
                    key={option.points}
                    style={[
                      styles.amountOption,
                      selectedAmount === option.points && styles.amountOptionSelected,
                      {
                        borderColor: selectedAmount === option.points ? colors.primary : colors.border,
                        backgroundColor: selectedAmount === option.points
                          ? withAlpha(colors.primary, 0.1)
                          : colors.card,
                      },
                    ]}
                    onPress={() => handleSelectAmount(option.points)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.amountPoints,
                      { color: selectedAmount === option.points ? colors.primary : colors.text },
                    ]}>
                      {option.points} pts
                    </Text>
                    <Text style={[styles.amountCash, { color: colors.textMuted }]}>
                      {formatCurrency(option.cashValue)}
                    </Text>
                    {selectedAmount === option.points && (
                      <Check size={ICON_SIZE.sm} color={colors.primary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={[styles.noOptionsCard, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
                  <AlertCircle size={ICON_SIZE.lg} color={colors.warning} strokeWidth={1.5} />
                  <Text style={[styles.noOptionsText, { color: colors.text }]}>
                    You need at least {REWARD_CONSTANTS.MIN_REDEMPTION_POINTS} points to redeem
                  </Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'ENTER_DETAILS':
        return (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Enter Details
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              {selectedType === 'CASH' ? 'Mobile Money' : 'Airtime'} - {formatCurrency(pointsToCash(selectedAmount))}
            </Text>
            
            {/* Provider Selection */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Select Provider
            </Text>
            <View style={styles.providerOptions}>
              <TouchableOpacity
                style={[
                  styles.providerOption,
                  selectedProvider === 'MTN' && { backgroundColor: '#FFCC00', borderColor: '#FFCC00' },
                  selectedProvider !== 'MTN' && { borderColor: colors.border },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedProvider('MTN');
                }}
              >
                <Text style={[
                  styles.providerText,
                  { color: selectedProvider === 'MTN' ? '#000' : colors.text },
                ]}>
                  MTN
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.providerOption,
                  selectedProvider === 'AIRTEL' && { backgroundColor: '#FF0000', borderColor: '#FF0000' },
                  selectedProvider !== 'AIRTEL' && { borderColor: colors.border },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedProvider('AIRTEL');
                }}
              >
                <Text style={[
                  styles.providerText,
                  { color: selectedProvider === 'AIRTEL' ? '#fff' : colors.text },
                ]}>
                  Airtel
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Phone Number Input */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Phone Number
            </Text>
            <View style={[styles.phoneInputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Phone size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
              <TextInput
                style={[styles.phoneInput, { color: colors.text }]}
                placeholder="07XX XXX XXX"
                placeholderTextColor={colors.textMuted}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>
            
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
                <AlertCircle size={ICON_SIZE.sm} color={colors.error} strokeWidth={1.5} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}
            
            <PrimaryButton
              title="Continue"
              onPress={() => setStep('CONFIRM')}
              disabled={!phoneNumber || phoneNumber.length < 9}
            />
          </View>
        );

      case 'CONFIRM':
        return (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              Confirm Redemption
            </Text>
            
            <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Type</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>
                  {selectedType === 'CASH' ? 'Mobile Money' : 'Airtime'}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Amount</Text>
                <Text style={[styles.confirmValue, { color: colors.success }]}>
                  {formatCurrency(pointsToCash(selectedAmount))}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Points</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>
                  {selectedAmount} pts
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Provider</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>{selectedProvider}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Phone</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>{phoneNumber}</Text>
              </View>
            </View>
            
            <PrimaryButton
              title="Confirm & Redeem"
              onPress={handleConfirm}
              loading={isLoading}
            />
          </View>
        );

      case 'PROCESSING':
        return (
          <View style={[styles.stepContent, styles.centerContent]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.text }]}>
              Processing your redemption...
            </Text>
            <Text style={[styles.processingSubtext, { color: colors.textMuted }]}>
              Please wait while we send your {selectedType === 'CASH' ? 'money' : 'airtime'}
            </Text>
          </View>
        );

      case 'SUCCESS':
        return (
          <View style={[styles.stepContent, styles.centerContent]}>
            <View style={[styles.successIcon, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
              <Check size={48} color={colors.success} strokeWidth={2} />
            </View>
            <Text style={[styles.successTitle, { color: colors.success }]}>
              Success!
            </Text>
            <Text style={[styles.successMessage, { color: colors.text }]}>
              {successMessage}
            </Text>
            <PrimaryButton
              title="Done"
              onPress={handleClose}
            />
          </View>
        );

      case 'ERROR':
        return (
          <View style={[styles.stepContent, styles.centerContent]}>
            <View style={[styles.errorIcon, { backgroundColor: withAlpha(colors.error, 0.15) }]}>
              <AlertCircle size={48} color={colors.error} strokeWidth={2} />
            </View>
            <Text style={[styles.errorTitle, { color: colors.error }]}>
              Redemption Failed
            </Text>
            <Text style={[styles.errorMessage, { color: colors.text }]}>
              {error}
            </Text>
            <View style={styles.errorActions}>
              <PrimaryButton
                title="Try Again"
                onPress={handleBack}
                variant="primary"
              />
              <PrimaryButton
                title="Close"
                onPress={handleClose}
                variant="secondary"
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <BlurView intensity={isDark ? 40 : 60} style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Redeem Rewards
              </Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.secondary }]}
                onPress={handleClose}
              >
                <X size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {renderStepContent()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

// ===========================================
// Styles
// ===========================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  closeButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  stepContent: {
    gap: SPACING.lg,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  backText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  stepSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: -SPACING.sm,
  },
  typeOptions: {
    gap: SPACING.md,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  typeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  typeDescription: {
    position: 'absolute',
    bottom: SPACING.md,
    left: 56 + SPACING.lg + SPACING.md,
    right: SPACING.lg + ICON_SIZE.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  amountOptions: {
    gap: SPACING.sm,
  },
  amountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  amountOptionSelected: {},
  amountPoints: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  amountCash: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginLeft: SPACING.md,
  },
  noOptionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  noOptionsText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  fieldLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  providerOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  providerOption: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    alignItems: 'center',
  },
  providerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.md,
  },
  phoneInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    padding: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  confirmCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  confirmValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  processingText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.lg,
  },
  processingSubtext: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginTop: SPACING.lg,
  },
  successMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginTop: SPACING.lg,
  },
  errorMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  errorActions: {
    gap: SPACING.sm,
    width: '100%',
  },
});

export default RedemptionModal;
