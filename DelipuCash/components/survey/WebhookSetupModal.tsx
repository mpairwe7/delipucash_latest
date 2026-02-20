/**
 * WebhookSetupModal — Configure webhook integrations for a survey
 *
 * Features:
 * - URL input with validation
 * - Event type checkboxes (response.submitted, etc.)
 * - Secret field with auto-generate option
 * - Active/inactive toggle
 * - Test button with delivery status indicator
 * - List existing webhooks with edit/delete
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  Trash2,
  Zap,
  Send,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SPACING, RADIUS, TYPOGRAPHY, SHADOWS, useTheme, withAlpha } from '@/utils/theme';
import {
  useSurveyWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useUpdateWebhook,
  useTestWebhook,
} from '@/services/surveyWebhookHooks';
import type { SurveyWebhook } from '@/services/surveyWebhookApi';

// ============================================================================
// TYPES
// ============================================================================

interface WebhookSetupModalProps {
  visible: boolean;
  onClose: () => void;
  surveyId: string;
}

const WEBHOOK_EVENTS = [
  { key: 'response.submitted', label: 'Response Submitted', description: 'When someone completes the survey' },
  { key: 'response.started', label: 'Response Started', description: 'When someone begins the survey' },
  { key: 'survey.closed', label: 'Survey Closed', description: 'When the survey reaches its end date' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const WebhookSetupModal: React.FC<WebhookSetupModalProps> = ({
  visible,
  onClose,
  surveyId,
}) => {
  const { colors } = useTheme();

  // Data
  const { data: webhooks = [], isLoading } = useSurveyWebhooks(surveyId);
  const createMutation = useCreateWebhook(surveyId);
  const deleteMutation = useDeleteWebhook(surveyId);
  const updateMutation = useUpdateWebhook(surveyId);
  const testMutation = useTestWebhook(surveyId);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['response.submitted']);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'loading'>>({});

  const resetForm = useCallback(() => {
    setUrl('');
    setSecret('');
    setSelectedEvents(['response.submitted']);
    setShowAddForm(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!url.trim() || !url.match(/^https?:\/\/.+/)) {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }
    if (selectedEvents.length === 0) {
      Alert.alert('No Events', 'Please select at least one event');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    createMutation.mutate(
      { url: url.trim(), events: selectedEvents, secret: secret || undefined },
      {
        onSuccess: (result) => {
          if (result.success) {
            resetForm();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else {
            Alert.alert('Error', result.message || 'Failed to create webhook');
          }
        },
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }, [url, secret, selectedEvents, createMutation, resetForm]);

  const handleDelete = useCallback((webhookId: string) => {
    Alert.alert('Delete Webhook', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          deleteMutation.mutate(webhookId);
        },
      },
    ]);
  }, [deleteMutation]);

  const handleToggleActive = useCallback((webhook: SurveyWebhook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateMutation.mutate({
      webhookId: webhook.id,
      payload: { isActive: !webhook.isActive },
    });
  }, [updateMutation]);

  const handleTest = useCallback((webhookId: string) => {
    setTestResults((prev) => ({ ...prev, [webhookId]: 'loading' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    testMutation.mutate(webhookId, {
      onSuccess: (result) => {
        setTestResults((prev) => ({ ...prev, [webhookId]: result.success ? 'success' : 'error' }));
        setTimeout(() => setTestResults((prev) => { const next = { ...prev }; delete next[webhookId]; return next; }), 3000);
      },
      onError: () => {
        setTestResults((prev) => ({ ...prev, [webhookId]: 'error' }));
        setTimeout(() => setTestResults((prev) => { const next = { ...prev }; delete next[webhookId]; return next; }), 3000);
      },
    });
  }, [testMutation]);

  const toggleEvent = useCallback((event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }, []);

  const generateSecret = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecret(result);
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Webhooks</Text>
          <TouchableOpacity
            onPress={() => setShowAddForm(!showAddForm)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Add webhook"
          >
            <Plus size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Add Form */}
          {showAddForm && (
            <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.text }]}>New Webhook</Text>

              {/* URL */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabel}>
                  <Globe size={14} color={colors.textMuted} />
                  <Text style={[styles.label, { color: colors.textMuted }]}>Endpoint URL</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://example.com/webhook"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  accessibilityLabel="Webhook URL"
                />
              </View>

              {/* Secret */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabel}>
                  <Key size={14} color={colors.textMuted} />
                  <Text style={[styles.label, { color: colors.textMuted }]}>Signing Secret (optional)</Text>
                </View>
                <View style={styles.secretRow}>
                  <TextInput
                    style={[styles.input, styles.secretInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={secret}
                    onChangeText={setSecret}
                    placeholder="whsec_..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    accessibilityLabel="Webhook secret"
                  />
                  <TouchableOpacity
                    onPress={generateSecret}
                    style={[styles.generateBtn, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
                    accessibilityRole="button"
                    accessibilityLabel="Auto-generate secret"
                  >
                    <RefreshCw size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Events */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Events</Text>
                {WEBHOOK_EVENTS.map((event) => (
                  <TouchableOpacity
                    key={event.key}
                    style={[
                      styles.eventRow,
                      {
                        backgroundColor: selectedEvents.includes(event.key) ? withAlpha(colors.primary, 0.06) : 'transparent',
                        borderColor: selectedEvents.includes(event.key) ? withAlpha(colors.primary, 0.3) : colors.border,
                      },
                    ]}
                    onPress={() => toggleEvent(event.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedEvents.includes(event.key) }}
                    accessibilityLabel={event.label}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: selectedEvents.includes(event.key) ? colors.primary : colors.border,
                          backgroundColor: selectedEvents.includes(event.key) ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {selectedEvents.includes(event.key) && (
                        <CheckCircle2 size={12} color="#FFF" />
                      )}
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={[styles.eventLabel, { color: colors.text }]}>{event.label}</Text>
                      <Text style={[styles.eventDesc, { color: colors.textMuted }]}>{event.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  onPress={resetForm}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={createMutation.isPending}
                  style={[styles.createBtn, { backgroundColor: colors.primary, opacity: createMutation.isPending ? 0.6 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Create webhook"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.createBtnText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Webhook List */}
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: SPACING.xl }} />
          ) : webhooks.length === 0 && !showAddForm ? (
            <View style={styles.emptyState}>
              <Zap size={48} color={withAlpha(colors.text, 0.15)} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Webhooks</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Add a webhook to get real-time notifications when someone responds to your survey.
              </Text>
            </View>
          ) : (
            webhooks.map((webhook) => (
              <View
                key={webhook.id}
                style={[styles.webhookCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: webhook.isActive ? 1 : 0.6 }]}
              >
                <View style={styles.webhookHeader}>
                  <View style={styles.webhookUrlRow}>
                    <View style={[styles.statusDot, { backgroundColor: webhook.isActive ? colors.success : colors.textMuted }]} />
                    <Text style={[styles.webhookUrl, { color: colors.text }]} numberOfLines={1}>
                      {webhook.url}
                    </Text>
                  </View>
                  <Switch
                    value={webhook.isActive}
                    onValueChange={() => handleToggleActive(webhook)}
                    trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.3) }}
                    thumbColor={webhook.isActive ? colors.primary : colors.card}
                  />
                </View>

                <View style={styles.webhookEvents}>
                  {webhook.events.map((event) => (
                    <View key={event} style={[styles.eventChip, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                      <Text style={[styles.eventChipText, { color: colors.primary }]}>{event}</Text>
                    </View>
                  ))}
                </View>

                {webhook.lastFired && (
                  <Text style={[styles.lastFired, { color: colors.textMuted }]}>
                    Last fired: {new Date(webhook.lastFired).toLocaleString()} — Status: {webhook.lastStatus}
                  </Text>
                )}

                <View style={styles.webhookActions}>
                  <TouchableOpacity
                    onPress={() => handleTest(webhook.id)}
                    disabled={testResults[webhook.id] === 'loading'}
                    style={[styles.testBtn, { backgroundColor: withAlpha(colors.info, 0.08) }]}
                    accessibilityRole="button"
                    accessibilityLabel="Test webhook"
                  >
                    {testResults[webhook.id] === 'loading' ? (
                      <ActivityIndicator size="small" color={colors.info} />
                    ) : testResults[webhook.id] === 'success' ? (
                      <CheckCircle2 size={16} color={colors.success} />
                    ) : testResults[webhook.id] === 'error' ? (
                      <AlertCircle size={16} color={colors.error} />
                    ) : (
                      <Send size={16} color={colors.info} />
                    )}
                    <Text style={[styles.testBtnText, { color: colors.info }]}>Test</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(webhook.id)}
                    style={[styles.deleteBtn, { backgroundColor: withAlpha(colors.error, 0.08) }]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete webhook"
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.lg },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },

  // Add Form
  addForm: { padding: SPACING.md, borderRadius: RADIUS.xl, borderWidth: 1, marginBottom: SPACING.lg },
  formTitle: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.base, marginBottom: SPACING.md },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxs, marginBottom: SPACING.xs },
  label: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs },
  input: { height: 44, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.sm },
  secretRow: { flexDirection: 'row', gap: SPACING.xs },
  secretInput: { flex: 1 },
  generateBtn: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACING.xs, gap: SPACING.sm },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1 },
  eventLabel: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm },
  eventDesc: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs },
  formActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: { flex: 1, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm },
  createBtn: { flex: 1, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm, color: '#FFF' },

  // Webhook Card
  webhookCard: { padding: SPACING.md, borderRadius: RADIUS.xl, borderWidth: 1, marginBottom: SPACING.sm },
  webhookHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  webhookUrlRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1, marginRight: SPACING.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  webhookUrl: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.sm, flex: 1 },
  webhookEvents: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  eventChip: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xxs, borderRadius: RADIUS.base },
  eventChipText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.xs },
  lastFired: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, marginTop: SPACING.sm },
  webhookActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.md },
  testBtnText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm },
  deleteBtn: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: SPACING['3xl'], gap: SPACING.sm },
  emptyTitle: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.lg },
  emptyDesc: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.sm, textAlign: 'center', maxWidth: 280 },
});

export default WebhookSetupModal;
