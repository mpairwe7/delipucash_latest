/**
 * Analytics Dashboard Components
 * Mobile-first analytics dashboard with key metrics, charts, and insights (2025/2026)
 * 
 * Features:
 * - Glanceable key metrics cards at top
 * - Collapsible sections for question breakdowns
 * - Interactive mini-charts
 * - Trend indicators
 * - Responsive grid layout for tablets
 * - Export menu with progress feedback
 * - Full accessibility support
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  CheckCircle2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  X,
  Share2,
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
import { AnalyticsDashboardSkeleton } from './SurveySkeletons';
import type { QuestionAggregate, SurveyAnalytics } from '@/store/SurveyResponseUIStore';

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsDashboardProps {
  analytics: SurveyAnalytics | null;
  isLoading?: boolean;
  surveyTitle: string;
  onExport: (format: 'csv' | 'json' | 'pdf') => Promise<void>;
  onShare: () => void;
  onRefresh: () => void;
}

interface MetricCardData {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Key Metric Card
const MetricCard: React.FC<{
  metric: MetricCardData;
  compact?: boolean;
}> = ({ metric, compact }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.metricCard,
        compact && styles.metricCardCompact,
        { backgroundColor: colors.card, borderColor: withAlpha(metric.color, 0.2) },
      ]}
      accessibilityLabel={`${metric.label}: ${metric.value}${metric.subValue ? `, ${metric.subValue}` : ''}`}
    >
      <View style={[styles.metricIconBg, { backgroundColor: withAlpha(metric.color, 0.12) }]}>
        {metric.icon}
      </View>
      <View style={styles.metricContent}>
        <Text style={[styles.metricValue, compact && styles.metricValueCompact, { color: colors.text }]}>
          {metric.value}
        </Text>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
          {metric.label}
        </Text>
        {metric.subValue && (
          <Text style={[styles.metricSubValue, { color: colors.textSecondary }]}>
            {metric.subValue}
          </Text>
        )}
      </View>
      {metric.trend && (
        <View
          style={[
            styles.trendBadge,
            {
              backgroundColor: withAlpha(
                metric.trend.direction === 'up' ? colors.success :
                metric.trend.direction === 'down' ? colors.error : colors.textMuted,
                0.1
              ),
            },
          ]}
        >
          {metric.trend.direction === 'up' && (
            <TrendingUp size={12} color={colors.success} />
          )}
          {metric.trend.direction === 'down' && (
            <TrendingDown size={12} color={colors.error} />
          )}
          <Text
            style={[
              styles.trendText,
              {
                color:
                  metric.trend.direction === 'up' ? colors.success :
                  metric.trend.direction === 'down' ? colors.error : colors.textMuted,
              },
            ]}
          >
            {metric.trend.value}
          </Text>
        </View>
      )}
    </View>
  );
};

// Mini Bar Chart (for question breakdown)
const MiniBarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
}> = ({ data, maxValue }) => {
  const { colors } = useTheme();
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  const defaultColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.info,
    colors.secondary,
  ];

  return (
    <View style={styles.miniBarChart}>
      {data.slice(0, 5).map((item, index) => {
        const width = (item.value / max) * 100;
        const color = item.color || defaultColors[index % defaultColors.length];
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;

        return (
          <View key={index} style={styles.miniBarRow}>
            <Text
              style={[styles.miniBarLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <View style={styles.miniBarContainer}>
              <View style={[styles.miniBarTrack, { backgroundColor: withAlpha(colors.text, 0.08) }]}>
                <View
                  style={[
                    styles.miniBarFill,
                    { width: `${Math.max(width, 2)}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={[styles.miniBarValue, { color: colors.text }]}>
                {percentage}%
              </Text>
            </View>
          </View>
        );
      })}
      {data.length > 5 && (
        <Text style={[styles.moreItems, { color: colors.textMuted }]}>
          +{data.length - 5} more
        </Text>
      )}
    </View>
  );
};

// Rating Display
const RatingDisplay: React.FC<{
  average: number;
  distribution: number[];
}> = ({ average, distribution }) => {
  const { colors } = useTheme();
  const total = distribution.reduce((sum, d) => sum + d, 0);

  return (
    <View style={styles.ratingDisplay}>
      <View style={styles.ratingAverage}>
        <Text style={[styles.ratingValue, { color: colors.text }]}>
          {average.toFixed(1)}
        </Text>
        <Text style={[styles.ratingMax, { color: colors.textMuted }]}>/5</Text>
      </View>
      <View style={styles.ratingBars}>
        {distribution.map((count, index) => {
          const width = total > 0 ? (count / total) * 100 : 0;
          return (
            <View key={index} style={styles.ratingBarRow}>
              <Text style={[styles.ratingStarLabel, { color: colors.textMuted }]}>
                {5 - index}★
              </Text>
              <View style={[styles.ratingBarTrack, { backgroundColor: withAlpha(colors.warning, 0.2) }]}>
                <View
                  style={[
                    styles.ratingBarFill,
                    { width: `${width}%`, backgroundColor: colors.warning },
                  ]}
                />
              </View>
              <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Collapsible Question Card
const QuestionAnalyticsCard: React.FC<{
  question: QuestionAggregate;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ question, index, isExpanded, onToggle }) => {
  const { colors } = useTheme();

  const renderQuestionContent = () => {
    if (question.questionType === 'rating' && question.ratingDistribution) {
      return (
        <RatingDisplay
          average={question.averageRating || 0}
          distribution={question.ratingDistribution}
        />
      );
    }

    if (['radio', 'checkbox', 'dropdown'].includes(question.questionType)) {
      const chartData = Object.entries(question.answerDistribution).map(([label, value]) => ({
        label,
        value,
      }));
      return <MiniBarChart data={chartData} />;
    }

    if (question.questionType === 'boolean') {
      const yes = question.yesCount || 0;
      const no = question.noCount || 0;
      const total = yes + no;
      return (
        <View style={styles.booleanChart}>
          <View style={styles.booleanRow}>
            <View style={[styles.booleanBar, { backgroundColor: colors.success, flex: yes || 0.1 }]} />
            <View style={[styles.booleanBar, { backgroundColor: colors.error, flex: no || 0.1 }]} />
          </View>
          <View style={styles.booleanLabels}>
            <Text style={[styles.booleanLabel, { color: colors.success }]}>
              Yes: {total > 0 ? ((yes / total) * 100).toFixed(0) : 0}%
            </Text>
            <Text style={[styles.booleanLabel, { color: colors.error }]}>
              No: {total > 0 ? ((no / total) * 100).toFixed(0) : 0}%
            </Text>
          </View>
        </View>
      );
    }

    // Text responses
    if (question.topResponses && question.topResponses.length > 0) {
      return (
        <View style={styles.textResponses}>
          {question.topResponses.slice(0, 3).map((response, i) => (
            <View key={i} style={[styles.textResponse, { backgroundColor: withAlpha(colors.text, 0.04) }]}>
              <Text style={[styles.textResponseText, { color: colors.text }]} numberOfLines={2}>
                &ldquo;{response}&rdquo;
              </Text>
            </View>
          ))}
          {question.topResponses.length > 3 && (
            <Text style={[styles.moreResponses, { color: colors.primary }]}>
              +{question.topResponses.length - 3} more responses
            </Text>
          )}
        </View>
      );
    }

    return (
      <Text style={[styles.noData, { color: colors.textMuted }]}>
        No responses yet
      </Text>
    );
  };

  return (
    <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.questionHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`Question ${index + 1}: ${question.questionText}`}
      >
        <View style={[styles.questionNumber, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <Text style={[styles.questionNumberText, { color: colors.primary }]}>
            Q{index + 1}
          </Text>
        </View>
        <View style={styles.questionInfo}>
          <Text style={[styles.questionText, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
            {question.questionText}
          </Text>
          <View style={styles.questionMeta}>
            <View style={[styles.typeBadge, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
              <Text style={[styles.typeBadgeText, { color: colors.info }]}>
                {question.questionType}
              </Text>
            </View>
            <Text style={[styles.responsesCount, { color: colors.textMuted }]}>
              {question.totalResponses} responses
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={colors.textMuted} />
        ) : (
          <ChevronDown size={20} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.questionContent, { borderTopColor: colors.border }]}>
          {renderQuestionContent()}
        </View>
      )}
    </View>
  );
};

// Export Modal
const ExportModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'json' | 'pdf') => Promise<void>;
}> = ({ visible, onClose, onExport }) => {
  const { colors } = useTheme();
  const [exporting, setExporting] = useState<'csv' | 'json' | 'pdf' | null>(null);

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    setExporting(format);
    try {
      await onExport(format);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExporting(null);
    }
  };

  const exportOptions = [
    { format: 'csv' as const, label: 'CSV', icon: <FileSpreadsheet size={24} />, desc: 'Spreadsheet format' },
    { format: 'json' as const, label: 'JSON', icon: <FileJson size={24} />, desc: 'Structured data' },
    { format: 'pdf' as const, label: 'PDF', icon: <FileText size={24} />, desc: 'Printable report' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.exportModal, { backgroundColor: colors.card }]}>
          <View style={styles.exportHeader}>
            <Text style={[styles.exportTitle, { color: colors.text }]}>Export Responses</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {exportOptions.map((option) => (
            <TouchableOpacity
              key={option.format}
              style={[styles.exportOption, { borderColor: colors.border }]}
              onPress={() => handleExport(option.format)}
              disabled={exporting !== null}
              accessibilityRole="button"
              accessibilityLabel={`Export as ${option.label}`}
            >
              <View style={[styles.exportIconBg, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                {React.cloneElement(option.icon, { color: colors.primary })}
              </View>
              <View style={styles.exportOptionText}>
                <Text style={[styles.exportOptionLabel, { color: colors.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.exportOptionDesc, { color: colors.textMuted }]}>
                  {option.desc}
                </Text>
              </View>
              {exporting === option.format ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Download size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
  isLoading,
  surveyTitle,
  onExport,
  onShare,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  // Generate metrics from analytics
  const metrics: MetricCardData[] = useMemo(() => {
    if (!analytics) return [];

    return [
      {
        label: 'Total Responses',
        value: analytics.totalResponses,
        icon: <Users size={22} />,
        color: colors.primary,
        trend: analytics.totalResponses > 10
          ? { direction: 'up', value: '+12%' }
          : undefined,
      },
      {
        label: 'Completion Rate',
        value: `${analytics.completionRate.toFixed(0)}%`,
        icon: <CheckCircle2 size={22} />,
        color: colors.success,
        trend: analytics.completionRate > 70
          ? { direction: 'up', value: 'Good' }
          : analytics.completionRate < 50
          ? { direction: 'down', value: 'Low' }
          : undefined,
      },
      {
        label: 'Avg. Time',
        value: `${Math.round(analytics.averageCompletionTime / 60)}m`,
        subValue: `${analytics.averageCompletionTime % 60}s`,
        icon: <Clock size={22} />,
        color: colors.warning,
      },
      {
        label: 'Questions',
        value: analytics.questionAggregates.length,
        icon: <BarChart3 size={22} />,
        color: colors.info,
      },
    ];
  }, [analytics, colors]);

  const toggleQuestion = useCallback((questionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return <AnalyticsDashboardSkeleton />;
  }

  if (!analytics) {
    return (
      <View style={styles.emptyState}>
        <BarChart3 size={48} color={colors.textMuted} strokeWidth={1} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Analytics Yet</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Analytics will appear once you receive responses
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Actions */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {surveyTitle}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share survey"
          >
            <Share2 size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowExportModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Export responses"
          >
            <Download size={18} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Key Metrics Grid */}
      <View style={[styles.metricsGrid, isTablet && styles.metricsGridTablet]}>
        {metrics.map((metric, index) => (
          <View key={index} style={[styles.metricWrapper, isTablet && styles.metricWrapperTablet]}>
            <MetricCard metric={metric} compact={!isTablet} />
          </View>
        ))}
      </View>

      {/* Response Trend (Mini chart placeholder) */}
      {analytics.responsesByDay.length > 0 && (
        <View style={[styles.trendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.trendHeader}>
            <Text style={[styles.trendTitle, { color: colors.text }]}>Response Trend</Text>
            <View style={[styles.trendBadgeSmall, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
              <TrendingUp size={12} color={colors.success} />
              <Text style={[styles.trendBadgeText, { color: colors.success }]}>7 days</Text>
            </View>
          </View>
          <View style={styles.trendChart}>
            {analytics.responsesByDay.slice(-7).map((day, index) => {
              const maxCount = Math.max(...analytics.responsesByDay.map((d) => d.count), 1);
              const height = (day.count / maxCount) * 60;
              return (
                <View key={index} style={styles.trendBarWrapper}>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: Math.max(height, 4),
                        backgroundColor: withAlpha(colors.primary, 0.7 + index * 0.04),
                      },
                    ]}
                  />
                  <Text style={[styles.trendBarLabel, { color: colors.textMuted }]}>
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Questions Breakdown */}
      <View style={styles.questionsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Question Breakdown
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Tap to expand and see detailed analytics
        </Text>

        {analytics.questionAggregates.map((question, index) => (
          <QuestionAnalyticsCard
            key={question.questionId}
            question={question}
            index={index}
            isExpanded={expandedQuestions.has(question.questionId)}
            onToggle={() => toggleQuestion(question.questionId)}
          />
        ))}
      </View>

      {/* Last updated */}
      {analytics.lastResponseAt && (
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last response: {new Date(analytics.lastResponseAt).toLocaleString()}
        </Text>
      )}

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={onExport}
      />
    </ScrollView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING['3xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerTitle: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginRight: SPACING.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: SPACING.lg,
  },
  metricsGridTablet: {
    marginHorizontal: -SPACING.sm,
  },
  metricWrapper: {
    width: '50%',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  metricWrapperTablet: {
    width: '25%',
    paddingHorizontal: SPACING.sm,
  },
  metricCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  metricCardCompact: {
    padding: SPACING.sm,
  },
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  metricContent: {},
  metricValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  metricValueCompact: {
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  metricLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  metricSubValue: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xxs,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 2,
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  trendText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },

  // Trend card
  trendCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  trendTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  trendBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
    gap: SPACING.xxs,
  },
  trendBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 80,
  },
  trendBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  trendBar: {
    width: 24,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  trendBarLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },

  // Questions section
  questionsSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xxs,
  },
  sectionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
  },

  // Question card
  questionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  questionNumber: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionInfo: {
    flex: 1,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  responsesCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  questionContent: {
    padding: SPACING.md,
    borderTopWidth: 1,
  },

  // Mini bar chart
  miniBarChart: {},
  miniBarRow: {
    marginBottom: SPACING.sm,
  },
  miniBarLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.xxs,
  },
  miniBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  miniBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
  },
  miniBarValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    width: 35,
    textAlign: 'right',
  },
  moreItems: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Rating display
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  ratingAverage: {
    alignItems: 'center',
  },
  ratingValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
  },
  ratingMax: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  ratingBars: {
    flex: 1,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xxs,
  },
  ratingStarLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    width: 24,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
  },
  ratingCount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    width: 20,
    textAlign: 'right',
  },

  // Boolean chart
  booleanChart: {},
  booleanRow: {
    flexDirection: 'row',
    height: 20,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  booleanBar: {
    height: '100%',
  },
  booleanLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  booleanLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Text responses
  textResponses: {},
  textResponse: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },
  textResponseText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },
  moreResponses: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  noData: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },

  // Export modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  exportModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  exportTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  exportIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOptionText: {
    flex: 1,
  },
  exportOptionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  exportOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['3xl'],
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Last updated
  lastUpdated: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});

export default AnalyticsDashboard;
