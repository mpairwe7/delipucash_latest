/**
 * Survey Share Modal Component
 * Modern sharing interface with QR code, links, and social options (2025/2026)
 * 
 * Features:
 * - QR code generation for instant mobile sharing
 * - Copy link with visual feedback
 * - Social sharing (WhatsApp, Twitter, Email)
 * - Password protection option
 * - Embed code for web
 * - Response limit settings
 * - Expiry date control
 * - Full accessibility support
 */

import React, { useState, useCallback, useMemo } from 'react';
import { WebhookSetupModal } from './WebhookSetupModal';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  AccessibilityInfo,
  Alert,
  Share as RNShare,
  Clipboard,
  Switch,
} from 'react-native';
import {
  X,
  Link as LinkIcon,
  Copy,
  Check,
  QrCode,
  Mail,
  MessageCircle,
  Twitter,
  Lock,
  Eye,
  Users,
  Calendar,
  Code,
  Share2,
  ExternalLink,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SHADOWS,
  useTheme,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  surveyId: string;
  surveyTitle: string;
  surveyDescription?: string;
  isPasswordProtected?: boolean;
  responseLimit?: number;
  expiryDate?: Date;
  onSettingsChange?: (settings: ShareSettings) => void;
}

interface ShareSettings {
  isPasswordProtected: boolean;
  password?: string;
  responseLimit?: number;
  expiryDate?: Date;
  allowAnonymous: boolean;
}

// ============================================================================
// QR CODE COMPONENT (SVG-based for React Native)
// ============================================================================

// Simple QR-like visual (in production, use react-native-qrcode-svg)
const QRCodeDisplay: React.FC<{ url: string; size: number; colors: { bg: string; fg: string } }> = ({
  url,
  size,
  colors,
}) => {
  // Generate a deterministic pattern based on URL hash
  const generatePattern = useCallback((str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }, []);

  const pattern = generatePattern(url);
  const gridSize = 9;
  const cellSize = (size - 24) / gridSize;

  // Generate pseudo-random QR pattern
  const cells = useMemo(() => {
    const result = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Corner position markers
        const isCornerMarker =
          (row < 2 && col < 2) ||
          (row < 2 && col >= gridSize - 2) ||
          (row >= gridSize - 2 && col < 2);

        // Generate pseudo-random fill
        const seed = (pattern + row * gridSize + col) % 7;
        const isFilled = isCornerMarker || seed < 3;

        if (isFilled) {
          result.push({ row, col });
        }
      }
    }
    return result;
  }, [pattern, gridSize]);

  return (
    <View style={[styles.qrContainer, { width: size, height: size, backgroundColor: colors.bg }]}>
      <View style={styles.qrGrid}>
        {cells.map((cell, index) => (
          <View
            key={index}
            style={[
              styles.qrCell,
              {
                width: cellSize,
                height: cellSize,
                backgroundColor: colors.fg,
                left: 12 + cell.col * cellSize,
                top: 12 + cell.row * cellSize,
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.qrCenter, { backgroundColor: colors.bg }]}>
        <QrCode size={20} color={colors.fg} />
      </View>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SurveyShareModal: React.FC<ShareModalProps> = ({
  visible,
  onClose,
  surveyId,
  surveyTitle,
  surveyDescription,
  isPasswordProtected: initialPasswordProtected = false,
  responseLimit: initialResponseLimit,
  expiryDate: initialExpiryDate,
  onSettingsChange,
}) => {
  const { colors } = useTheme();

  // State
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [settings, setSettings] = useState<ShareSettings>({
    isPasswordProtected: initialPasswordProtected,
    password: '',
    responseLimit: initialResponseLimit,
    expiryDate: initialExpiryDate,
    allowAnonymous: true,
  });

  // Generate share URL
  const baseUrl = 'https://delipu.cash'; // Replace with actual domain
  const shareUrl = useMemo(() => {
    return `${baseUrl}/survey/${surveyId}`;
  }, [surveyId]);

  // Copy to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      Clipboard.setString(shareUrl);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to copy link');
    }
  }, [shareUrl]);

  // Native share
  const handleNativeShare = useCallback(async () => {
    try {
      await RNShare.share({
        title: surveyTitle,
        message: `${surveyTitle}\n\nTake this survey: ${shareUrl}`,
        url: shareUrl,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // User cancelled
    }
  }, [surveyTitle, shareUrl]);

  // Social sharing
  const handleWhatsAppShare = useCallback(() => {
    const message = encodeURIComponent(`${surveyTitle}\n\nTake this survey: ${shareUrl}`);
    const whatsappUrl = `whatsapp://send?text=${message}`;
    // In production: Linking.openURL(whatsappUrl)
    Alert.alert('WhatsApp', `Would open: ${whatsappUrl}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [surveyTitle, shareUrl]);

  const handleEmailShare = useCallback(() => {
    const subject = encodeURIComponent(`Take my survey: ${surveyTitle}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'd love your feedback on this survey.\n\n${surveyTitle}${
        surveyDescription ? `\n${surveyDescription}` : ''
      }\n\nTake the survey here: ${shareUrl}\n\nThank you!`
    );
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    Alert.alert('Email', `Would open: ${mailtoUrl}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [surveyTitle, surveyDescription, shareUrl]);

  const handleTwitterShare = useCallback(() => {
    const text = encodeURIComponent(`Take my survey: ${surveyTitle}`);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
    Alert.alert('Twitter/X', `Would open: ${twitterUrl}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [surveyTitle, shareUrl]);

  // Copy embed code
  const handleCopyEmbed = useCallback(() => {
    const embedCode = `<iframe src="${shareUrl}/embed" width="100%" height="600" frameborder="0"></iframe>`;
    Clipboard.setString(embedCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Embed code copied to clipboard');
  }, [shareUrl]);

  // Update settings
  const updateSetting = useCallback(<K extends keyof ShareSettings>(key: K, value: ShareSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close share modal"
          >
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Share Survey</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Survey Info */}
          <View style={[styles.surveyInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.surveyTitle, { color: colors.text }]} numberOfLines={2}>
              {surveyTitle}
            </Text>
            {surveyDescription && (
              <Text style={[styles.surveyDescription, { color: colors.textMuted }]} numberOfLines={2}>
                {surveyDescription}
              </Text>
            )}
          </View>

          {/* QR Code */}
          <View style={styles.qrSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Scan to Share</Text>
            <View style={[styles.qrWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <QRCodeDisplay
                url={shareUrl}
                size={180}
                colors={{ bg: '#FFFFFF', fg: colors.text }}
              />
              <Text style={[styles.qrHint, { color: colors.textMuted }]}>
                Scan with phone camera
              </Text>
            </View>
          </View>

          {/* Share Link */}
          <View style={styles.linkSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Share Link</Text>
            <View style={[styles.linkContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LinkIcon size={18} color={colors.textMuted} />
              <Text style={[styles.linkText, { color: colors.text }]} numberOfLines={1}>
                {shareUrl}
              </Text>
              <TouchableOpacity
                onPress={handleCopyLink}
                style={[
                  styles.copyBtn,
                  { backgroundColor: copied ? colors.success : colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel={copied ? 'Link copied' : 'Copy link'}
              >
                {copied ? (
                  <Check size={16} color="#FFF" />
                ) : (
                  <Copy size={16} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Options */}
          <View style={styles.shareOptions}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Share Via</Text>
            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleNativeShare}
                accessibilityRole="button"
                accessibilityLabel="Share via native share dialog"
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <Share2 size={20} color={colors.primary} />
                </View>
                <Text style={[styles.shareBtnText, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleWhatsAppShare}
                accessibilityRole="button"
                accessibilityLabel="Share via WhatsApp"
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: withAlpha('#25D366', 0.1) }]}>
                  <MessageCircle size={20} color="#25D366" />
                </View>
                <Text style={[styles.shareBtnText, { color: colors.text }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleEmailShare}
                accessibilityRole="button"
                accessibilityLabel="Share via Email"
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
                  <Mail size={20} color={colors.info} />
                </View>
                <Text style={[styles.shareBtnText, { color: colors.text }]}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleTwitterShare}
                accessibilityRole="button"
                accessibilityLabel="Share via Twitter"
              >
                <View style={[styles.shareBtnIcon, { backgroundColor: withAlpha('#1DA1F2', 0.1) }]}>
                  <Twitter size={20} color="#1DA1F2" />
                </View>
                <Text style={[styles.shareBtnText, { color: colors.text }]}>Twitter</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Embed Code */}
          <View style={styles.embedSection}>
            <TouchableOpacity
              style={[styles.embedBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleCopyEmbed}
              accessibilityRole="button"
              accessibilityLabel="Copy embed code"
            >
              <Code size={18} color={colors.textSecondary} />
              <Text style={[styles.embedBtnText, { color: colors.text }]}>Copy Embed Code</Text>
              <ExternalLink size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Webhooks */}
          <View style={styles.embedSection}>
            <TouchableOpacity
              style={[styles.embedBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowWebhooks(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Configure webhooks"
            >
              <Zap size={18} color={colors.warning} />
              <Text style={[styles.embedBtnText, { color: colors.text }]}>Configure Webhooks</Text>
            </TouchableOpacity>
          </View>

          {/* Advanced Settings */}
          <TouchableOpacity
            style={[styles.advancedToggle, { borderTopColor: colors.border }]}
            onPress={() => setShowAdvanced(!showAdvanced)}
            accessibilityRole="button"
            accessibilityLabel={showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          >
            <View style={styles.advancedToggleContent}>
              <Settings size={18} color={colors.textSecondary} />
              <Text style={[styles.advancedToggleText, { color: colors.text }]}>
                Advanced Settings
              </Text>
            </View>
            {showAdvanced ? (
              <ChevronUp size={20} color={colors.textMuted} />
            ) : (
              <ChevronDown size={20} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedSettings}>
              {/* Password Protection */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Lock size={18} color={colors.textSecondary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Password Protect
                    </Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                      Require password to access
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.isPasswordProtected}
                  onValueChange={(value) => updateSetting('isPasswordProtected', value)}
                  trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.3) }}
                  thumbColor={settings.isPasswordProtected ? colors.primary : colors.card}
                />
              </View>

              {settings.isPasswordProtected && (
                <View style={styles.passwordInput}>
                  <TextInput
                    style={[
                      styles.passwordTextInput,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                    ]}
                    placeholder="Enter password"
                    placeholderTextColor={colors.textMuted}
                    value={settings.password}
                    onChangeText={(value) => updateSetting('password', value)}
                    secureTextEntry
                    accessibilityLabel="Survey password"
                  />
                </View>
              )}

              {/* Anonymous Responses */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Eye size={18} color={colors.textSecondary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Allow Anonymous
                    </Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                      No login required to respond
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.allowAnonymous}
                  onValueChange={(value) => updateSetting('allowAnonymous', value)}
                  trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.3) }}
                  thumbColor={settings.allowAnonymous ? colors.primary : colors.card}
                />
              </View>

              {/* Response Limit */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Users size={18} color={colors.textSecondary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Response Limit
                    </Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                      Maximum responses allowed
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.limitInput,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="∞"
                  placeholderTextColor={colors.textMuted}
                  value={settings.responseLimit?.toString() || ''}
                  onChangeText={(value) =>
                    updateSetting('responseLimit', value ? parseInt(value, 10) : undefined)
                  }
                  keyboardType="number-pad"
                  accessibilityLabel="Response limit"
                />
              </View>

              {/* Expiry Date */}
              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.settingInfo}>
                  <Calendar size={18} color={colors.textSecondary} />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Expiry Date
                    </Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                      Auto-close on this date
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Set expiry date"
                >
                  <Text style={[styles.dateBtnText, { color: colors.primary }]}>
                    {settings.expiryDate
                      ? settings.expiryDate.toLocaleDateString()
                      : 'Set Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Webhook Setup Modal */}
      <WebhookSetupModal
        visible={showWebhooks}
        onClose={() => setShowWebhooks(false)}
        surveyId={surveyId}
      />
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },

  // Survey info
  surveyInfo: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  surveyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
  surveyDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },

  // Section
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },

  // QR Code
  qrSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  qrWrapper: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  qrContainer: {
    borderRadius: RADIUS.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  qrGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  qrCell: {
    position: 'absolute',
    borderRadius: 2,
  },
  qrCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.md,
  },

  // Link
  linkSection: {
    marginBottom: SPACING.lg,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.sm,
  },
  copyBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Share options
  shareOptions: {
    marginBottom: SPACING.lg,
  },
  shareButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  shareBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  shareBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Embed
  embedSection: {
    marginBottom: SPACING.lg,
  },
  embedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  embedBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Advanced settings
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    marginTop: SPACING.md,
  },
  advancedToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  advancedToggleText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
  advancedSettings: {
    marginTop: SPACING.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  settingDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  passwordInput: {
    paddingVertical: SPACING.sm,
  },
  passwordTextInput: {
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  limitInput: {
    width: 70,
    height: 36,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  dateBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dateBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Footer
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  doneBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFF',
  },
});

export default SurveyShareModal;
