/**
 * AdFeedbackModal - User Feedback & Ad Transparency Modal
 * 
 * Industry-standard ad feedback system allowing users to:
 * - Understand why they see an ad ("Why this ad?")
 * - Report inappropriate content
 * - Mark ads as "Not interested"
 * - Manage ad preferences
 * 
 * Inspired by:
 * - Google Ads "Why this ad?" transparency
 * - Facebook/Instagram ad feedback system
 * - TikTok ad reporting
 * 
 * Features:
 * - GDPR-compliant transparency information
 * - Multiple feedback options
 * - User preference storage
 * - Accessibility support
 * - Smooth animations
 * 
 * @example
 * ```tsx
 * <AdFeedbackModal
 *   visible={showFeedback}
 *   ad={currentAd}
 *   onClose={() => setShowFeedback(false)}
 *   onFeedback={handleFeedback}
 * />
 * ```
 */

import React, { memo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import {
  X,
  Info,
  ThumbsDown,
  Flag,
  Eye,
  EyeOff,
  Settings,
  Shield,
  HelpCircle,
  ChevronRight,
  AlertTriangle,
  Ban,
  MessageSquare,
  Check,
  ExternalLink,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import type { Ad } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAdUIStore } from '@/store/AdUIStore';

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackType = 
  | 'not_interested'
  | 'not_relevant'
  | 'seen_too_often'
  | 'inappropriate'
  | 'misleading'
  | 'offensive'
  | 'hide_advertiser'
  | 'other';

export interface AdFeedbackResult {
  feedbackType: FeedbackType;
  adId: string;
  advertiserId?: string;
  timestamp: number;
  comment?: string;
}

export interface AdFeedbackModalProps {
  /** Modal visibility */
  visible: boolean;
  /** Ad data */
  ad: Ad;
  /** Close callback */
  onClose: () => void;
  /** Feedback submitted callback */
  onFeedback?: (result: AdFeedbackResult) => void;
  /** Show "Why this ad?" section (default: true) */
  showWhyThisAd?: boolean;
  /** Allow hiding advertiser (default: true) */
  allowHideAdvertiser?: boolean;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FEEDBACK_OPTIONS: {
  type: FeedbackType;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  severity: 'low' | 'medium' | 'high';
}[] = [
  {
    type: 'not_interested',
    title: 'Not interested',
    description: "I don't want to see this ad",
    icon: ThumbsDown,
    severity: 'low',
  },
  {
    type: 'not_relevant',
    title: 'Not relevant to me',
    description: "This ad doesn't match my interests",
    icon: Eye,
    severity: 'low',
  },
  {
    type: 'seen_too_often',
    title: 'Seen it too many times',
    description: "I've seen this ad repeatedly",
    icon: EyeOff,
    severity: 'low',
  },
  {
    type: 'misleading',
    title: 'Misleading or clickbait',
    description: 'Ad content is deceptive',
    icon: AlertTriangle,
    severity: 'medium',
  },
  {
    type: 'inappropriate',
    title: 'Inappropriate content',
    description: 'Contains objectionable material',
    icon: Ban,
    severity: 'high',
  },
  {
    type: 'offensive',
    title: 'Offensive or harmful',
    description: 'Violates community guidelines',
    icon: Flag,
    severity: 'high',
  },
];

const TARGETING_REASONS = [
  { key: 'interests', label: 'Your interests and activity' },
  { key: 'demographics', label: 'Your demographics (age, location)' },
  { key: 'similar', label: 'Similar users who engaged' },
  { key: 'topic', label: 'Topic of content you viewed' },
  { key: 'general', label: 'General audience targeting' },
];

const AD_PREFERENCES_KEY = '@ad_preferences';
const AD_FEEDBACK_KEY = '@ad_feedback_history';

// ============================================================================
// COMPONENT
// ============================================================================

const AdFeedbackModalComponent: React.FC<AdFeedbackModalProps> = ({
  visible,
  ad,
  onClose,
  onFeedback,
  showWhyThisAd = true,
  allowHideAdvertiser = true,
  testID,
}) => {
  const { colors } = useTheme();
  const blockAdvertiser = useAdUIStore(s => s.blockAdvertiser);

  // ========== STATE ==========
  const [activeTab, setActiveTab] = useState<'feedback' | 'why'>('feedback');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(null);
  const [hideAdvertiser, setHideAdvertiser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ========== ANIMATIONS ==========
  const backdropOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(300);

  // ========== EFFECTS ==========

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslate.value = withSpring(0, { damping: 20 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      sheetTranslate.value = withTiming(300, { duration: 150 });
      // Reset state
      setSelectedFeedback(null);
      setHideAdvertiser(false);
      setShowConfirmation(false);
      setActiveTab('feedback');
    }
  }, [visible, backdropOpacity, sheetTranslate]);

  // ========== HANDLERS ==========

  const handleFeedbackSelect = useCallback((type: FeedbackType) => {
    setSelectedFeedback(type);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFeedback) return;

    setIsSubmitting(true);

    try {
      const result: AdFeedbackResult = {
        feedbackType: selectedFeedback,
        adId: ad.id,
        advertiserId: ad.userId,
        timestamp: Date.now(),
      };

      // Store feedback locally
      const existingFeedback = await AsyncStorage.getItem(AD_FEEDBACK_KEY);
      const feedbackHistory = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedbackHistory.push(result);
      await AsyncStorage.setItem(AD_FEEDBACK_KEY, JSON.stringify(feedbackHistory));

      // Store advertiser preference if hiding — use AdUIStore (persisted via Zustand)
      if (hideAdvertiser && ad.userId) {
        blockAdvertiser(ad.userId);
      }

      // Callback
      onFeedback?.(result);

      // Show confirmation
      setShowConfirmation(true);
      
      // Auto-close after delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFeedback, ad, hideAdvertiser, onFeedback, onClose]);

  const handleOpenPrivacyPolicy = useCallback(() => {
    // Replace with actual privacy policy URL
    Linking.openURL('https://delipucash.com/privacy').catch(console.error);
  }, []);

  const handleOpenAdSettings = useCallback(() => {
    // Navigate to in-app ad settings
    Alert.alert('Ad Settings', 'Ad personalization settings would open here.');
  }, []);

  // ========== ANIMATED STYLES ==========

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  // ========== COMPUTED ==========

  const selectedOption = FEEDBACK_OPTIONS.find(o => o.type === selectedFeedback);
  const isSevereReport = selectedOption?.severity === 'high';

  // Get mock targeting reasons
  const targetingReasons = TARGETING_REASONS.slice(0, 3);

  // ========== RENDER ==========

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { backgroundColor: withAlpha('#000000', 0.5) },
            backdropStyle,
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
            accessibilityLabel="Close modal"
            accessibilityRole="button"
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card },
            sheetStyle,
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTabs}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'feedback' && { backgroundColor: withAlpha(colors.primary, 0.1) },
                ]}
                onPress={() => setActiveTab('feedback')}
              >
                <MessageSquare
                  size={18}
                  color={activeTab === 'feedback' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'feedback' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Feedback
                </Text>
              </TouchableOpacity>

              {showWhyThisAd && (
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'why' && { backgroundColor: withAlpha(colors.primary, 0.1) },
                  ]}
                  onPress={() => setActiveTab('why')}
                >
                  <HelpCircle
                    size={18}
                    color={activeTab === 'why' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: activeTab === 'why' ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    Why this ad?
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Confirmation State */}
            {showConfirmation ? (
              <Animated.View
                style={styles.confirmationContainer}
                entering={FadeIn}
              >
                <View style={[styles.confirmationIcon, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                  <Check size={32} color={colors.success} />
                </View>
                <Text style={[styles.confirmationTitle, { color: colors.text }]}>
                  Thanks for your feedback
                </Text>
                <Text style={[styles.confirmationText, { color: colors.textSecondary }]}>
                  We&apos;ll use this to improve your ad experience
                </Text>
              </Animated.View>
            ) : activeTab === 'feedback' ? (
              <>
                {/* Ad Preview */}
                <View style={[styles.adPreview, { backgroundColor: withAlpha(colors.primary, 0.05) }]}>
                  <Text style={[styles.adPreviewLabel, { color: colors.textSecondary }]}>
                    About this ad
                  </Text>
                  <Text style={[styles.adPreviewTitle, { color: colors.text }]} numberOfLines={2}>
                    {ad.title || 'Sponsored Ad'}
                  </Text>
                  {ad.user?.firstName && (
                    <Text style={[styles.adPreviewAdvertiser, { color: colors.textSecondary }]}>
                      By {ad.user?.firstName}
                    </Text>
                  )}
                </View>

                {/* Feedback Options */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  What&apos;s wrong with this ad?
                </Text>

                <View style={styles.optionsContainer}>
                  {FEEDBACK_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedFeedback === option.type;
                    const severityColor = option.severity === 'high' 
                      ? colors.error 
                      : option.severity === 'medium' 
                        ? colors.warning 
                        : colors.textSecondary;

                    return (
                      <TouchableOpacity
                        key={option.type}
                        style={[
                          styles.optionButton,
                          { backgroundColor: colors.card },
                          isSelected && {
                            borderColor: colors.primary,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => handleFeedbackSelect(option.type)}
                        accessibilityLabel={`${option.title}. ${option.description}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={[styles.optionIcon, { backgroundColor: withAlpha(severityColor, 0.1) }]}>
                          <Icon size={20} color={severityColor} />
                        </View>
                        <View style={styles.optionContent}>
                          <Text style={[styles.optionTitle, { color: colors.text }]}>
                            {option.title}
                          </Text>
                          <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                            {option.description}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                            <Check size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Hide Advertiser Toggle */}
                {allowHideAdvertiser && ad.user?.firstName && (
                  <TouchableOpacity
                    style={[styles.hideAdvertiserRow, { backgroundColor: colors.card }]}
                    onPress={() => setHideAdvertiser(!hideAdvertiser)}
                    accessibilityLabel={`Stop seeing ads from ${ad.user?.firstName}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: hideAdvertiser }}
                  >
                    <Ban size={20} color={colors.textSecondary} />
                    <Text style={[styles.hideAdvertiserText, { color: colors.text }]}>
                      Stop seeing ads from {ad.user?.firstName}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: colors.border },
                        hideAdvertiser && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      {hideAdvertiser && <Check size={14} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                )}

                {/* Severe Report Notice */}
                {isSevereReport && (
                  <View style={[styles.severeNotice, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
                    <AlertTriangle size={16} color={colors.error} />
                    <Text style={[styles.severeNoticeText, { color: colors.error }]}>
                      This ad will be reviewed by our team. False reports may affect your account.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              /* Why This Ad Tab */
              <>
                <View style={styles.whySection}>
                  <View style={[styles.whyIcon, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
                    <Info size={24} color={colors.info} />
                  </View>
                  <Text style={[styles.whyTitle, { color: colors.text }]}>
                    Why you&apos;re seeing this ad
                  </Text>
                  <Text style={[styles.whyDescription, { color: colors.textSecondary }]}>
                    Advertisers can target people based on various factors. Here&apos;s why this ad might be shown to you:
                  </Text>
                </View>

                {/* Targeting Reasons */}
                <View style={styles.reasonsContainer}>
                  {targetingReasons.map((reason, index) => (
                    <View
                      key={reason.key}
                      style={[styles.reasonItem, { backgroundColor: colors.card }]}
                    >
                      <View style={[styles.reasonBullet, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.reasonText, { color: colors.text }]}>
                        {reason.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Advertiser Info */}
                {ad.user?.firstName && (
                  <View style={[styles.advertiserInfo, { backgroundColor: colors.card }]}>
                    <Shield size={20} color={colors.success} />
                    <View style={styles.advertiserContent}>
                      <Text style={[styles.advertiserName, { color: colors.text }]}>
                        {ad.user?.firstName}
                      </Text>
                      <Text style={[styles.advertiserLabel, { color: colors.textSecondary }]}>
                        Verified advertiser
                      </Text>
                    </View>
                  </View>
                )}

                {/* Privacy Links */}
                <View style={styles.linksContainer}>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={handleOpenAdSettings}
                    accessibilityLabel="Manage ad preferences"
                    accessibilityRole="button"
                  >
                    <Settings size={18} color={colors.primary} />
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      Manage ad preferences
                    </Text>
                    <ChevronRight size={18} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={handleOpenPrivacyPolicy}
                    accessibilityLabel="View privacy policy"
                    accessibilityRole="link"
                  >
                    <ExternalLink size={18} color={colors.primary} />
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      Learn about our privacy policy
                    </Text>
                    <ChevronRight size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>

          {/* Submit Button (Feedback Tab Only) */}
          {activeTab === 'feedback' && !showConfirmation && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  !selectedFeedback && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={!selectedFeedback || isSubmitting}
                accessibilityLabel="Submit feedback"
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectedFeedback || isSubmitting }}
              >
                {isSubmitting ? (
                  <Text style={[styles.submitText, { color: colors.primaryText }]}>
                    Submitting...
                  </Text>
                ) : (
                  <Text style={[styles.submitText, { color: colors.primaryText }]}>
                    Submit feedback
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
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
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
  },

  // Handle
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  headerTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  closeButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
    gap: SPACING.md,
  },

  // Ad Preview
  adPreview: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  adPreviewLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adPreviewTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  adPreviewAdvertiser: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Section
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
  },

  // Options
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: SPACING.sm,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  optionDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hide Advertiser
  hideAdvertiserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  hideAdvertiserText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Severe Notice
  severeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  severeNoticeText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * 1.4,
  },

  // Why This Ad
  whySection: {
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  whyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  whyDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  // Reasons
  reasonsContainer: {
    gap: SPACING.sm,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  reasonBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reasonText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Advertiser Info
  advertiserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  advertiserContent: {
    flex: 1,
  },
  advertiserName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  advertiserLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Links
  linksContainer: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  linkText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Confirmation
  confirmationContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  confirmationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  confirmationText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // Footer
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  submitText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const AdFeedbackModal = memo(AdFeedbackModalComponent);
export default AdFeedbackModal;
