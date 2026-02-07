/**
 * Survey Templates Gallery Component
 * A premium template browser inspired by Typeform, Jotform, and Google Forms (2025/2026)
 * 
 * Features:
 * - Category-based browsing with icons
 * - Search within templates
 * - Featured/Popular templates section
 * - Template preview before use
 * - Premium badges
 * - Smooth animations (respects reduced motion)
 * - Full accessibility support
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  AccessibilityInfo,
} from 'react-native';
import {
  Search,
  X,
  Clock,
  FileText,
  Star,
  ChevronRight,
  MessageCircle,
  Users,
  TrendingUp,
  Package,
  Calendar,
  BookOpen,
  Heart,
  Sparkles,
  Lock,
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
import {
  TEMPLATE_CATEGORIES,
  FEATURED_TEMPLATES,
  SurveyTemplate,
  TemplateCategory,
} from '@/store/SurveyUIStore';

// ============================================================================
// CATEGORY ICON MAPPING
// ============================================================================

const getCategoryIcon = (iconName: string, color: string, size: number = 20) => {
  const icons: Record<string, React.ReactNode> = {
    'message-circle': <MessageCircle size={size} color={color} strokeWidth={2} />,
    'users': <Users size={size} color={color} strokeWidth={2} />,
    'trending-up': <TrendingUp size={size} color={color} strokeWidth={2} />,
    'package': <Package size={size} color={color} strokeWidth={2} />,
    'calendar': <Calendar size={size} color={color} strokeWidth={2} />,
    'book-open': <BookOpen size={size} color={color} strokeWidth={2} />,
    'heart': <Heart size={size} color={color} strokeWidth={2} />,
    'star': <Star size={size} color={color} strokeWidth={2} />,
  };
  return icons[iconName] || <FileText size={size} color={color} strokeWidth={2} />;
};

// ============================================================================
// PROPS
// ============================================================================

interface TemplatesGalleryProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SurveyTemplate) => void;
  hasSubscription?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SurveyTemplatesGallery: React.FC<TemplatesGalleryProps> = ({
  visible,
  onClose,
  onSelectTemplate,
  hasSubscription = false,
}) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SurveyTemplate | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => subscription.remove();
  }, []);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates = [...FEATURED_TEMPLATES];

    if (selectedCategory) {
      templates = templates.filter((t) => t.categoryId === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.includes(query))
      );
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  const handleCategoryPress = useCallback((categoryId: string | null) => {
    if (!reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
  }, [selectedCategory, reducedMotion]);

  const handleTemplatePress = useCallback((template: SurveyTemplate) => {
    if (!reducedMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPreviewTemplate(template);
  }, [reducedMotion]);

  const handleUseTemplate = useCallback((template: SurveyTemplate) => {
    if (template.isPremium && !hasSubscription) {
      // Show upgrade prompt
      return;
    }
    if (!reducedMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSelectTemplate(template);
    onClose();
  }, [hasSubscription, onSelectTemplate, onClose, reducedMotion]);

  // Category chip component
  const CategoryChip: React.FC<{ category: TemplateCategory; selected: boolean }> = ({
    category,
    selected,
  }) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        {
          backgroundColor: selected
            ? withAlpha(colors.primary, 0.15)
            : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={() => handleCategoryPress(category.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.name} category with ${category.count} templates`}
    >
      <View style={[
        styles.categoryIconBg,
        { backgroundColor: withAlpha(colors.primary, selected ? 0.2 : 0.08) },
      ]}>
        {getCategoryIcon(category.icon, selected ? colors.primary : colors.textSecondary, 16)}
      </View>
      <Text
        style={[
          styles.categoryChipText,
          { color: selected ? colors.primary : colors.text },
        ]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
      <View style={[styles.categoryCount, { backgroundColor: withAlpha(colors.text, 0.08) }]}>
        <Text style={[styles.categoryCountText, { color: colors.textMuted }]}>
          {category.count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Template card component
  const TemplateCard: React.FC<{ template: SurveyTemplate }> = ({ template }) => (
    <TouchableOpacity
      style={[
        styles.templateCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => handleTemplatePress(template)}
      accessibilityRole="button"
      accessibilityLabel={`${template.name} template. ${template.questionsCount} questions, ${template.estimatedTime} minutes. ${template.isPremium ? 'Premium' : 'Free'}`}
    >
      <View style={styles.templateHeader}>
        <View style={[styles.templateIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <FileText size={24} color={colors.primary} strokeWidth={1.5} />
        </View>
        {template.isPremium && (
          <View style={[styles.premiumBadge, { backgroundColor: colors.warning }]}>
            <Sparkles size={10} color="#FFF" />
            <Text style={styles.premiumBadgeText}>PRO</Text>
          </View>
        )}
      </View>

      <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={2}>
        {template.name}
      </Text>
      <Text style={[styles.templateDescription, { color: colors.textMuted }]} numberOfLines={2}>
        {template.description}
      </Text>

      <View style={styles.templateMeta}>
        <View style={styles.metaItem}>
          <FileText size={12} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {template.questionsCount} Qs
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={12} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {template.estimatedTime} min
          </Text>
        </View>
      </View>

      <View style={styles.templateTags}>
        {template.tags.slice(0, 2).map((tag) => (
          <View
            key={tag}
            style={[styles.tag, { backgroundColor: withAlpha(colors.primary, 0.08) }]}
          >
            <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  // Stable FlatList callbacks
  const templateKeyExtractor = useCallback((item: SurveyTemplate) => item.id, []);

  const renderTemplate = useCallback(
    ({ item }: { item: SurveyTemplate }) => <TemplateCard template={item} />,
    [colors, handleTemplatePress]
  );

  const templateEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <FileText size={48} color={colors.textMuted} strokeWidth={1} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No templates found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Try adjusting your search or category filter
        </Text>
      </View>
    ),
    [colors]
  );

  // Template preview modal
  const TemplatePreviewModal: React.FC = () => {
    if (!previewTemplate) return null;

    return (
      <Modal
        visible={!!previewTemplate}
        animationType={reducedMotion ? 'none' : 'slide'}
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewTemplate(null)}
      >
        <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.previewHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setPreviewTemplate(null)}
              style={styles.previewCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.previewHeaderTitle, { color: colors.text }]}>
              Template Preview
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
          >
            {/* Template info */}
            <View style={[styles.previewInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.previewIconLarge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <FileText size={40} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {previewTemplate.name}
              </Text>
              {previewTemplate.isPremium && (
                <View style={[styles.premiumBadgeLarge, { backgroundColor: colors.warning }]}>
                  <Sparkles size={14} color="#FFF" />
                  <Text style={styles.premiumBadgeLargeText}>Premium Template</Text>
                </View>
              )}
              <Text style={[styles.previewDescription, { color: colors.textSecondary }]}>
                {previewTemplate.description}
              </Text>

              <View style={styles.previewStats}>
                <View style={[styles.previewStatCard, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                  <FileText size={20} color={colors.primary} />
                  <Text style={[styles.previewStatValue, { color: colors.text }]}>
                    {previewTemplate.questionsCount}
                  </Text>
                  <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>
                    Questions
                  </Text>
                </View>
                <View style={[styles.previewStatCard, { backgroundColor: withAlpha(colors.success, 0.08) }]}>
                  <Clock size={20} color={colors.success} />
                  <Text style={[styles.previewStatValue, { color: colors.text }]}>
                    {previewTemplate.estimatedTime}
                  </Text>
                  <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>
                    Minutes
                  </Text>
                </View>
              </View>
            </View>

            {/* Sample questions */}
            <View style={styles.sampleQuestionsSection}>
              <Text style={[styles.sampleQuestionsTitle, { color: colors.text }]}>
                Sample Questions
              </Text>
              {previewTemplate.previewQuestions.map((question, index) => (
                <View
                  key={index}
                  style={[styles.sampleQuestion, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.questionNumber, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                    <Text style={[styles.questionNumberText, { color: colors.primary }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {question}
                  </Text>
                </View>
              ))}
              <Text style={[styles.moreQuestions, { color: colors.textMuted }]}>
                + {previewTemplate.questionsCount - previewTemplate.previewQuestions.length} more questions
              </Text>
            </View>

            {/* Tags */}
            <View style={styles.previewTags}>
              {previewTemplate.tags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagLarge, { backgroundColor: withAlpha(colors.primary, 0.08) }]}
                >
                  <Text style={[styles.tagLargeText, { color: colors.primary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.previewActions, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            {previewTemplate.isPremium && !hasSubscription ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning }]}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to use this premium template"
              >
                <Lock size={18} color="#FFF" />
                <Text style={styles.actionButtonText}>Upgrade to Use</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => handleUseTemplate(previewTemplate)}
                accessibilityRole="button"
                accessibilityLabel="Use this template"
              >
                <Text style={styles.actionButtonText}>Use This Template</Text>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close templates gallery"
          >
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Templates
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchInput,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Search size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchTextInput, { color: colors.text }]}
              placeholder="Search templates..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Search templates"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.categoriesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  backgroundColor: !selectedCategory
                    ? withAlpha(colors.primary, 0.15)
                    : colors.card,
                  borderColor: !selectedCategory ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleCategoryPress(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedCategory }}
              accessibilityLabel="All categories"
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: !selectedCategory ? colors.primary : colors.text },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {TEMPLATE_CATEGORIES.map((category) => (
              <CategoryChip
                key={category.id}
                category={category}
                selected={selectedCategory === category.id}
              />
            ))}
          </ScrollView>
        </View>

        {/* Templates Grid */}
        <FlatList
            data={filteredTemplates}
            keyExtractor={templateKeyExtractor}
            numColumns={2}
            columnWrapperStyle={styles.templateRow}
            contentContainerStyle={styles.templateList}
            renderItem={renderTemplate}
            ListEmptyComponent={templateEmptyComponent}
            showsVerticalScrollIndicator={false}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={6}
            windowSize={5}
            initialNumToRender={4}
          />

        {/* Template Preview Modal */}
        <TemplatePreviewModal />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  // Search
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchTextInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  // Categories
  categoriesSection: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  categoriesScroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    marginRight: SPACING.xs,
  },
  categoryIconBg: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  categoryCount: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryCountText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Template Grid
  templateList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  templateRow: {
    justifyContent: 'space-between',
  },
  templateCard: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  premiumBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 9,
    color: '#FFF',
  },
  templateName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xxs,
  },
  templateDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  templateTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xxs,
  },
  tag: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  tagText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['3xl'],
  },
  emptyStateTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.md,
  },
  emptyStateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Preview Modal
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: SPACING.lg,
  },
  previewInfo: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  previewIconLarge: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  previewTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  premiumBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    gap: SPACING.xxs,
    marginBottom: SPACING.sm,
  },
  premiumBadgeLargeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFF',
  },
  previewDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  previewStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  previewStatCard: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  previewStatValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginTop: SPACING.xs,
  },
  previewStatLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  sampleQuestionsSection: {
    marginBottom: SPACING.lg,
  },
  sampleQuestionsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.md,
  },
  sampleQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  questionNumber: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  moreQuestions: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  previewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  tagLarge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  tagLargeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  previewActions: {
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
});

export default SurveyTemplatesGallery;
