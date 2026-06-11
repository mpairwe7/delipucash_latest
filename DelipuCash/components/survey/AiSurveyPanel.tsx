/**
 * AI Survey Panel — describe a survey in plain language, get editable draft
 * questions. Backed by the server's NVIDIA NIM + Groq generation endpoint.
 *
 * The generated questions are loaded into the builder for review/editing; this
 * panel never publishes. On success the parent switches to the build tab.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { Sparkles, AlertCircle } from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, BORDER_WIDTH, withAlpha } from '@/utils/theme';
import { generateAiSurvey, type AiGenerateResult } from '@/services/aiSurveyApi';

interface AiSurveyPanelProps {
  /** Called with the generated draft so the parent can load it into the builder. */
  onGenerated: (result: { title: string; description: string; questions: NonNullable<AiGenerateResult['questions']> }) => void;
  existingQuestions?: { text: string }[];
}

const EXAMPLES = [
  'Customer satisfaction for a coffee shop',
  'Employee engagement pulse check',
  'Post-event feedback for a workshop',
  'Product-market fit discovery',
];

const MAX_PROMPT = 1000;

export const AiSurveyPanel: React.FC<AiSurveyPanelProps> = ({ onGenerated, existingQuestions }) => {
  const { colors } = useTheme();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const result = await generateAiSurvey({
      prompt: trimmed,
      existingQuestions: existingQuestions?.length ? existingQuestions : undefined,
    });

    setLoading(false);
    if (result.success && result.questions && result.questions.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onGenerated({
        title: result.title || '',
        description: result.description || '',
        questions: result.questions,
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(result.error || 'AI generation failed. Please try again or build manually.');
    }
  }, [prompt, loading, existingQuestions, onGenerated]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { backgroundColor: withAlpha(colors.primary, 0.08), borderColor: withAlpha(colors.primary, 0.2) }]}>
        <Sparkles size={22} color={colors.primary} />
        <Text style={[styles.heroTitle, { color: colors.text }]}>Describe your survey</Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Tell us the topic and goal — we&apos;ll draft questions you can edit before publishing.
        </Text>
      </View>

      <TextInput
        value={prompt}
        onChangeText={(t) => { setPrompt(t); if (error) setError(null); }}
        placeholder="e.g. Measure customer satisfaction for a new coffee blend, 6 questions"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={MAX_PROMPT}
        editable={!loading}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        accessibilityLabel="Describe the survey you want to generate"
      />
      <Text style={[styles.counter, { color: colors.textMuted }]}>{prompt.length}/{MAX_PROMPT}</Text>

      <View style={styles.examplesRow}>
        {EXAMPLES.map((ex) => (
          <Pressable
            key={ex}
            onPress={() => { setPrompt(ex); setError(null); }}
            disabled={loading}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            accessibilityRole="button"
            accessibilityLabel={`Use example: ${ex}`}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1}>{ex}</Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: withAlpha(colors.error, 0.1), borderColor: withAlpha(colors.error, 0.3) }]} accessibilityLiveRegion="assertive">
          <AlertCircle size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <Pressable
        onPress={handleGenerate}
        disabled={loading || prompt.trim().length === 0}
        style={[
          styles.generateBtn,
          { backgroundColor: colors.primary, opacity: loading || prompt.trim().length === 0 ? 0.5 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Generate survey with AI"
        accessibilityState={{ disabled: loading || prompt.trim().length === 0, busy: loading }}
      >
        {loading ? (
          <>
            <ActivityIndicator size="small" color={colors.primaryText} />
            <Text style={[styles.generateText, { color: colors.primaryText }]}>Generating…</Text>
          </>
        ) : (
          <>
            <Sparkles size={18} color={colors.primaryText} />
            <Text style={[styles.generateText, { color: colors.primaryText }]}>Generate questions</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, gap: SPACING.md },
  hero: { borderRadius: RADIUS.lg, borderWidth: BORDER_WIDTH.thin, padding: SPACING.lg, gap: SPACING.xs, alignItems: 'flex-start' },
  heroTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: '700' },
  heroSub: { fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 20 },
  input: {
    minHeight: 110,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlignVertical: 'top',
  },
  counter: { fontSize: TYPOGRAPHY.fontSize.xs, textAlign: 'right', marginTop: -SPACING.xs },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: BORDER_WIDTH.thin, maxWidth: '100%' },
  chipText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: '600' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: BORDER_WIDTH.thin },
  errorText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 52,
  },
  generateText: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: '700' },
});
