/**
 * Survey Responses Screen
 * Google Forms-style survey response analysis and presentation
 * For survey owners to view and analyze their survey responses
 * 
 * Features:
 * - Summary, Questions, and Individual response views
 * - Export to CSV, JSON, and PDF formats
 * - Responsive design for phones and tablets
 * - Full accessibility support (WCAG 2.1 compliant)
 * 
 * Architecture (Industry Standard):
 * - TanStack Query: Server state (data fetching, caching, sync)
 * - Zustand: Client state (view mode, filters, UI preferences)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Clipboard,
  DimensionValue,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  PieChart,
  RefreshCw,
  Search,
  Share2,
  User,
  Users,
  X,
} from 'lucide-react-native';
import { PrimaryButton } from '@/components';
import {
  BarChart,
  BooleanChart,
  PieChart as PieChartComponent,
  RatingDisplay,
  StatCard,
  WordCloud,
} from '@/components/ui/SurveyCharts';

// TanStack Query hooks for server state
import { useSurveyResponseData } from '@/services/surveyResponseHooks';

// Zustand store for UI state
import {
  useSurveyResponseUIStore,
  parseResponses,
  filterResponses,
  computeAnalytics,
  exportToCSV,
  exportToJSON,
  exportToPDFHtml,
  type QuestionAggregate,
} from '@/store/SurveyResponseUIStore';

import { useAuth } from '@/utils/auth';
import {
  BORDER_WIDTH,
  ICON_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from '@/utils/theme';

// Responsive breakpoints
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
} as const;

type DeviceType = 'phone' | 'tablet' | 'desktop';

type ViewMode = 'summary' | 'questions' | 'individual';

// Hook to determine device type based on screen width
const useDeviceType = (): DeviceType => {
  const { width } = useWindowDimensions();
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

// Responsive values helper
const getResponsiveValue = <T,>(
  deviceType: DeviceType,
  values: { phone: T; tablet?: T; desktop?: T }
): T => {
  if (deviceType === 'desktop' && values.desktop !== undefined) return values.desktop;
  if (deviceType === 'tablet' && values.tablet !== undefined) return values.tablet;
  return values.phone;
};

const SurveyResponsesScreen = (): React.ReactElement => {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { auth } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const surveyId = Array.isArray(id) ? id?.[0] : id;
  const userId = auth?.user?.id;
  const deviceType = useDeviceType();
  const { width: screenWidth } = useWindowDimensions();

  // ============================================================================
  // ZUSTAND UI STATE (client-side only)
  // ============================================================================
  const uiStore = useSurveyResponseUIStore();
  const {
    viewMode,
    setViewMode,
    filters,
    searchQuery,
    setSearchQuery,
    currentResponseIndex,
    nextResponse,
    previousResponse,
    expandedQuestionId,
    setExpandedQuestion,
    updateLastSync,
  } = uiStore;
  // Additional store methods available via uiStore:
  // - setFilters: for filter UI component
  // - setCurrentResponseIndex: for direct navigation
  // - reset: for cleanup on unmount

  // Local UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ============================================================================
  // TANSTACK QUERY SERVER STATE (data fetching with caching)
  // ============================================================================
  const {
    survey: currentSurvey,
    questions: surveyQuestions,
    responses,
    isOwner,
    isLoading,
    isFetching,
    isError,
    error,
    refetchAll,
    dataUpdatedAt,
  } = useSurveyResponseData(surveyId, userId, filters);

  // ============================================================================
  // DERIVED/COMPUTED DATA (from TanStack Query data + Zustand filters)
  // ============================================================================
  const parsedResponses = useMemo(() => {
    if (!responses) return [];
    return parseResponses(responses);
  }, [responses]);

  const filteredResponses = useMemo(() => {
    return filterResponses(parsedResponses, filters);
  }, [parsedResponses, filters]);

  const analytics = useMemo(() => {
    if (!currentSurvey || !surveyQuestions || filteredResponses.length === 0) return null;
    return computeAnalytics(currentSurvey, surveyQuestions, filteredResponses);
  }, [currentSurvey, surveyQuestions, filteredResponses]);

  // Update last sync time when data is fetched
  const lastSyncedAt = useMemo(() => {
    if (dataUpdatedAt) {
      return new Date(dataUpdatedAt).toISOString();
    }
    return null;
  }, [dataUpdatedAt]);

  // Responsive computed values
  const pageMaxWidth = getResponsiveValue(deviceType, {
    phone: screenWidth,
    tablet: 900,
    desktop: 1100,
  });
  
  const statCardWidth: DimensionValue = getResponsiveValue(deviceType, {
    phone: '48%' as DimensionValue,
    tablet: '23%' as DimensionValue,
    desktop: '23%' as DimensionValue,
  });

  const chartColumns = getResponsiveValue(deviceType, {
    phone: 1,
    tablet: 2,
    desktop: 2,
  });

  // Handle refresh (using TanStack Query's refetch)
  const handleRefresh = useCallback(() => {
    refetchAll();
    updateLastSync();
  }, [refetchAll, updateLastSync]);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery],
  );

  // Handle export
  const handleExport = useCallback(
    async (format: 'csv' | 'json' | 'pdf') => {
      setIsExporting(true);
      
      try {
        // Use null coalescing for type safety
        const surveyData = currentSurvey ?? null;
        
        if (format === 'pdf') {
          const html = exportToPDFHtml(surveyData, surveyQuestions, filteredResponses, analytics);
          
          if (!html) {
            Alert.alert('Export Error', 'No data to export');
            return;
          }

          if (Platform.OS === 'web') {
            // On web, open print dialog with the HTML
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              printWindow.print();
            }
          } else {
            // On native, use expo-print
            const { uri } = await Print.printToFileAsync({
              html,
              base64: false,
            });
            
            // Share or save the PDF
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Survey Responses - ${currentSurvey?.title}`,
                UTI: 'com.adobe.pdf',
              });
            } else {
              Alert.alert(
                'PDF Generated',
                'PDF has been saved. Check your device for the file.'
              );
            }
          }
          
          // Announce for screen readers
          AccessibilityInfo.announceForAccessibility('PDF export completed successfully');
        } else {
          const content = format === 'csv' 
            ? exportToCSV(surveyData, surveyQuestions, filteredResponses)
            : exportToJSON(surveyData, surveyQuestions, filteredResponses);

          if (!content) {
            Alert.alert('Export Error', 'No data to export');
            return;
          }

          if (Platform.OS === 'web') {
            const blob = new Blob([content], {
              type: format === 'csv' ? 'text/csv' : 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `survey_responses_${surveyId}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            try {
              await RNShare.share({
                message: content,
                title: `Survey Responses - ${currentSurvey?.title}`,
              });
            } catch {
              Clipboard.setString(content);
              Alert.alert('Copied', 'Data copied to clipboard');
            }
          }
          
          // Announce for screen readers
          AccessibilityInfo.announceForAccessibility(`${format.toUpperCase()} export completed successfully`);
        }
      } catch (err) {
        Alert.alert('Export Error', err instanceof Error ? err.message : 'Failed to export data');
      } finally {
        setIsExporting(false);
        setShowExportModal(false);
      }
    },
    [currentSurvey, surveyQuestions, filteredResponses, analytics, surveyId],
  );

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderHeader = () => (
    <View 
      style={[styles.header, { paddingTop: insets.top + SPACING.sm, borderBottomColor: colors.border }]}
      accessibilityRole="header"
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ChevronLeft color={colors.text} size={ICON_SIZE.xl} />
        </TouchableOpacity>
        <View style={styles.headerTitleSection}>
          <Text 
            style={[
              styles.headerTitle, 
              { 
                color: colors.text,
                fontSize: getResponsiveValue(deviceType, {
                  phone: TYPOGRAPHY.fontSize.lg,
                  tablet: TYPOGRAPHY.fontSize.xl,
                  desktop: TYPOGRAPHY.fontSize['2xl'],
                }),
              }
            ]} 
            numberOfLines={1}
            accessibilityRole="header"
          >
            {currentSurvey?.title || 'Survey Responses'}
          </Text>
          <View style={styles.headerMeta} accessibilityRole="text">
            <View style={[
              styles.statusBadge,
              { backgroundColor: currentSurvey?.status === 'running' ? withAlpha(colors.success, 0.2) : withAlpha(colors.textMuted, 0.2) }
            ]}>
              <Text style={[
                styles.statusText,
                { color: currentSurvey?.status === 'running' ? colors.success : colors.textMuted }
              ]}>
                {currentSurvey?.status === 'running' ? 'Live' : currentSurvey?.status || 'Loading'}
              </Text>
            </View>
            <Text 
              style={[styles.responseCount, { color: colors.textSecondary }]}
              accessibilityLabel={`${filteredResponses.length} responses collected`}
            >
              {filteredResponses.length} responses
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.card }]}
          onPress={() => setShowExportModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Export responses"
          accessibilityHint="Opens export options for CSV, PDF, and JSON formats"
        >
          <Download color={colors.text} size={ICON_SIZE.lg} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View 
        style={[
          styles.tabBar,
          deviceType !== 'phone' && { justifyContent: 'center', gap: SPACING.xl },
        ]}
        accessibilityRole="tablist"
      >
        {(['summary', 'questions', 'individual'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.tab,
              viewMode === mode && { borderBottomColor: colors.primary },
              deviceType !== 'phone' && { flex: 0, paddingHorizontal: SPACING.lg },
            ]}
            onPress={() => setViewMode(mode)}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === mode }}
            accessibilityLabel={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
            accessibilityHint={`Switch to ${mode} view of responses`}
          >
            {mode === 'summary' && <PieChart size={ICON_SIZE.md} color={viewMode === mode ? colors.primary : colors.textMuted} />}
            {mode === 'questions' && <BarChart3 size={ICON_SIZE.md} color={viewMode === mode ? colors.primary : colors.textMuted} />}
            {mode === 'individual' && <User size={ICON_SIZE.md} color={viewMode === mode ? colors.primary : colors.textMuted} />}
            <Text style={[
              styles.tabText,
              { color: viewMode === mode ? colors.primary : colors.textMuted }
            ]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search and Filters */}
      <View 
        style={[
          styles.searchRow,
          deviceType !== 'phone' && { maxWidth: 600 },
        ]}
        accessibilityRole="search"
      >
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search color={colors.textMuted} size={ICON_SIZE.md} accessibilityElementsHidden />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search responses..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            accessibilityLabel="Search responses"
            accessibilityHint="Type to filter responses by content"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity 
              onPress={() => handleSearch('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X color={colors.textMuted} size={ICON_SIZE.md} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: Object.keys(filters).length > 0 ? withAlpha(colors.primary, 0.2) : colors.card },
          ]}
          onPress={() => setShowFilters(!showFilters)}
          accessibilityRole="button"
          accessibilityLabel={Object.keys(filters).length > 0 ? 'Filters active' : 'Open filters'}
          accessibilityHint="Opens filter options for responses"
          accessibilityState={{ expanded: showFilters }}
        >
          <Filter
            color={Object.keys(filters).length > 0 ? colors.primary : colors.textMuted}
            size={ICON_SIZE.md}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.card }]}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh data"
          accessibilityHint="Reloads survey responses from the server"
          accessibilityState={{ busy: isFetching }}
        >
          <RefreshCw
            color={isFetching ? colors.primary : colors.textMuted}
            size={ICON_SIZE.md}
          />
        </TouchableOpacity>
      </View>

      {/* Last Synced */}
      <View style={styles.syncRow} accessibilityRole="text">
        <Clock color={colors.textMuted} size={ICON_SIZE.sm} accessibilityElementsHidden />
        <Text 
          style={[styles.syncText, { color: colors.textMuted }]}
          accessibilityLabel={`Last synced ${formatRelativeTime(lastSyncedAt)}`}
        >
          Last synced: {formatRelativeTime(lastSyncedAt)}
        </Text>
      </View>
    </View>
  );

  const renderSummaryView = () => {
    if (!analytics) return null;

    const responseData = analytics.responsesByDay.map((d) => ({
      label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.count,
    }));

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { maxWidth: pageMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Survey summary view"
      >
        {/* Summary Stats */}
        <View 
          style={[
            styles.statsGrid,
            { gap: getResponsiveValue(deviceType, { phone: SPACING.sm, tablet: SPACING.md }) },
          ]}
          accessibilityLabel="Survey statistics"
        >
          <View style={{ width: statCardWidth }}>
            <StatCard
              label="Total Responses"
              value={analytics.totalResponses}
              icon={<Users color={colors.primary} size={ICON_SIZE.md} />}
              subtext={`of ${currentSurvey?.maxResponses || 500} max`}
            />
          </View>
          <View style={{ width: statCardWidth }}>
            <StatCard
              label="Completion Rate"
              value={`${analytics.completionRate.toFixed(1)}%`}
              icon={<BarChart3 color={colors.success} size={ICON_SIZE.md} />}
              trend={analytics.completionRate > 50 ? 'up' : 'down'}
            />
          </View>
          <View style={{ width: statCardWidth }}>
            <StatCard
              label="Avg. Time"
              value={`${Math.floor(analytics.averageCompletionTime / 60)}m`}
              icon={<Clock color={colors.info} size={ICON_SIZE.md} />}
              subtext="to complete"
            />
          </View>
          <View style={{ width: statCardWidth }}>
            <StatCard
              label="Last Response"
              value={formatRelativeTime(analytics.lastResponseAt)}
              icon={<Calendar color={colors.warning} size={ICON_SIZE.md} />}
            />
          </View>
        </View>

        {/* Response Trend */}
        <View 
          style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="image"
          accessibilityLabel={`Response trend chart showing ${responseData.length} days of data`}
        >
          <Text style={[styles.chartCardTitle, { color: colors.text }]}>
            Response Trend (Last 14 Days)
          </Text>
          <BarChart
            data={responseData}
            showValues
            height={getResponsiveValue(deviceType, { phone: 180, tablet: 220, desktop: 250 })}
          />
        </View>

        {/* Question Summaries */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          Question Summary
        </Text>
        <View 
          style={[
            deviceType !== 'phone' && {
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: SPACING.md,
            },
          ]}
        >
          {analytics.questionAggregates.map((aggregate, index) => (
            <View
              key={aggregate.questionId}
              style={[
                styles.questionSummaryCard, 
                { backgroundColor: colors.card, borderColor: colors.border },
                deviceType !== 'phone' && { width: `${100 / chartColumns - 2}%` },
              ]}
              accessible
              accessibilityLabel={`Question ${index + 1}: ${aggregate.questionText}, ${aggregate.totalResponses} responses`}
            >
              <View style={styles.questionSummaryHeader}>
                <View style={[styles.questionNumber, { backgroundColor: withAlpha(colors.primary, 0.2) }]}>
                  <Text style={[styles.questionNumberText, { color: colors.primary }]}>
                    Q{index + 1}
                  </Text>
                </View>
                <Text style={[styles.questionText, { color: colors.text }]} numberOfLines={2}>
                  {aggregate.questionText}
                </Text>
              </View>
              <Text style={[styles.questionTypeLabel, { color: colors.textMuted }]}>
                {aggregate.questionType.toUpperCase()} • {aggregate.totalResponses} responses
              </Text>
              
              {/* Render chart based on question type */}
              {renderQuestionChart(aggregate)}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderQuestionChart = (aggregate: QuestionAggregate) => {
    const type = aggregate.questionType.toLowerCase();

    switch (type) {
      case 'rating':
        return (
          <RatingDisplay
            average={aggregate.averageRating || 0}
            distribution={aggregate.ratingDistribution || []}
            total={aggregate.totalResponses}
          />
        );

      case 'boolean':
        return (
          <BooleanChart
            yesCount={aggregate.yesCount || 0}
            noCount={aggregate.noCount || 0}
          />
        );

      case 'radio':
      case 'dropdown':
        const pieData = Object.entries(aggregate.answerDistribution).map(([label, value]) => ({
          label,
          value,
        }));
        return (
          <PieChartComponent
            data={pieData}
            size={getResponsiveValue(deviceType, { phone: 120, tablet: 140, desktop: 160 })}
            innerRadius={getResponsiveValue(deviceType, { phone: 40, tablet: 48, desktop: 56 })}
            centerText={String(aggregate.totalResponses)}
          />
        );

      case 'checkbox':
        const barData = Object.entries(aggregate.answerDistribution).map(([label, value]) => ({
          label,
          value,
        }));
        return (
          <BarChart
            data={barData}
            horizontal
            showPercentages
          />
        );

      case 'text':
      case 'paragraph':
        if (aggregate.wordFrequency) {
          const words = Object.entries(aggregate.wordFrequency).map(([text, count]) => ({
            text,
            count,
          }));
          return <WordCloud words={words} maxWords={15} />;
        }
        return null;

      case 'number':
        return (
          <View style={styles.numberStats}>
            <View style={styles.numberStatItem}>
              <Text style={[styles.numberStatLabel, { color: colors.textMuted }]}>Min</Text>
              <Text style={[styles.numberStatValue, { color: colors.text }]}>{aggregate.min ?? '-'}</Text>
            </View>
            <View style={styles.numberStatItem}>
              <Text style={[styles.numberStatLabel, { color: colors.textMuted }]}>Average</Text>
              <Text style={[styles.numberStatValue, { color: colors.text }]}>
                {aggregate.average?.toFixed(1) ?? '-'}
              </Text>
            </View>
            <View style={styles.numberStatItem}>
              <Text style={[styles.numberStatLabel, { color: colors.textMuted }]}>Max</Text>
              <Text style={[styles.numberStatValue, { color: colors.text }]}>{aggregate.max ?? '-'}</Text>
            </View>
          </View>
        );

      default:
        const defaultBarData = Object.entries(aggregate.answerDistribution)
          .slice(0, 5)
          .map(([label, value]) => ({ label, value }));
        return <BarChart data={defaultBarData} horizontal />;
    }
  };

  const renderQuestionsView = () => {
    if (!analytics) return null;

    return (
      <FlatList
        data={analytics.questionAggregates}
        keyExtractor={(item) => item.questionId}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        windowSize={7}
        initialNumToRender={5}
        renderItem={({ item: aggregate, index }) => {
          const isExpanded = expandedQuestionId === aggregate.questionId;
          
          return (
            <View style={[styles.questionDetailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.questionDetailHeader}
                onPress={() => setExpandedQuestion(isExpanded ? null : aggregate.questionId)}
              >
                <View style={styles.questionDetailLeft}>
                  <View style={[styles.questionNumber, { backgroundColor: withAlpha(colors.primary, 0.2) }]}>
                    <Text style={[styles.questionNumberText, { color: colors.primary }]}>
                      Q{index + 1}
                    </Text>
                  </View>
                  <View style={styles.questionDetailInfo}>
                    <Text style={[styles.questionText, { color: colors.text }]}>
                      {aggregate.questionText}
                    </Text>
                    <View style={styles.questionDetailMeta}>
                      <View style={[styles.typeBadge, { backgroundColor: withAlpha(colors.info, 0.2) }]}>
                        <Text style={[styles.typeBadgeText, { color: colors.info }]}>
                          {aggregate.questionType}
                        </Text>
                      </View>
                      <Text style={[styles.responseCountSmall, { color: colors.textMuted }]}>
                        {aggregate.totalResponses} responses
                      </Text>
                    </View>
                  </View>
                </View>
                {isExpanded ? (
                  <ChevronUp color={colors.textMuted} size={ICON_SIZE.lg} />
                ) : (
                  <ChevronDown color={colors.textMuted} size={ICON_SIZE.lg} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.questionDetailContent}>
                  {renderQuestionChart(aggregate)}
                  
                  {/* Show raw text responses for text questions */}
                  {(aggregate.questionType.toLowerCase() === 'text' ||
                    aggregate.questionType.toLowerCase() === 'paragraph') &&
                    aggregate.topResponses && (
                      <View style={styles.textResponses}>
                        <Text style={[styles.textResponsesTitle, { color: colors.textSecondary }]}>
                          Recent Responses
                        </Text>
                        {aggregate.topResponses.slice(0, 5).map((response, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.textResponseItem, { backgroundColor: colors.elevated }]}
                            onPress={() => {
                              Clipboard.setString(response);
                              Alert.alert('Copied', 'Response copied to clipboard');
                            }}
                          >
                            <Text style={[styles.textResponseText, { color: colors.text }]}>
                              &quot;{response}&quot;
                            </Text>
                            <Copy color={colors.textMuted} size={ICON_SIZE.sm} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                </View>
              )}
            </View>
          );
        }}
      />
    );
  };

  const renderIndividualView = () => {
    const currentResponse = filteredResponses[currentResponseIndex];

    if (!currentResponse) {
      return (
        <View style={styles.emptyState}>
          <Users color={colors.textMuted} size={48} />
          <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
            No responses to display
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.individualContainer}>
        {/* Navigation */}
        <View style={[styles.individualNav, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.navArrow, { opacity: currentResponseIndex > 0 ? 1 : 0.3 }]}
            onPress={previousResponse}
            disabled={currentResponseIndex === 0}
          >
            <ArrowLeft color={colors.text} size={ICON_SIZE.xl} />
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <Text style={[styles.navCurrent, { color: colors.text }]}>
              Response {currentResponseIndex + 1} of {filteredResponses.length}
            </Text>
            <Text style={[styles.navDate, { color: colors.textSecondary }]}>
              {formatDate(currentResponse.createdAt)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.navArrow, { opacity: currentResponseIndex < filteredResponses.length - 1 ? 1 : 0.3 }]}
            onPress={() => nextResponse(filteredResponses.length)}
            disabled={currentResponseIndex === filteredResponses.length - 1}
          >
            <ArrowRight color={colors.text} size={ICON_SIZE.xl} />
          </TouchableOpacity>
        </View>

        {/* Respondent Info */}
        <View style={[styles.respondentInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.respondentAvatar, { backgroundColor: withAlpha(colors.primary, 0.2) }]}>
            <User color={colors.primary} size={ICON_SIZE.xl} />
          </View>
          <View style={styles.respondentDetails}>
            <Text style={[styles.respondentName, { color: colors.text }]}>
              {currentResponse.userName || 'Anonymous'}
            </Text>
            <Text style={[styles.respondentEmail, { color: colors.textSecondary }]}>
              {currentResponse.userEmail || currentResponse.userId}
            </Text>
          </View>
        </View>

        {/* Responses */}
        <ScrollView
          style={styles.responsesScroll}
          contentContainerStyle={styles.responsesContent}
          showsVerticalScrollIndicator={false}
        >
          {surveyQuestions?.map((question: { id: string; text: string; type: string }, index: number) => {
            const answer = currentResponse.responses[question.id];
            
            return (
              <View
                key={question.id}
                style={[styles.responseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.responseQuestion, { color: colors.textSecondary }]}>
                  Q{index + 1}. {question.text}
                </Text>
                <View style={styles.responseAnswer}>
                  {renderAnswer(answer, question.type)}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderAnswer = (answer: unknown, type: string) => {
    if (answer === undefined || answer === null) {
      return (
        <Text style={[styles.answerText, { color: colors.textMuted, fontStyle: 'italic' }]}>
          Not answered
        </Text>
      );
    }

    const typeLower = type.toLowerCase();

    switch (typeLower) {
      case 'rating':
        const rating = Number(answer);
        return (
          <View style={styles.ratingAnswer}>
            {Array.from({ length: 5 }, (_, i) => (
              <Text
                key={i}
                style={[
                  styles.ratingStarLarge,
                  { color: i < rating ? colors.warning : colors.border },
                ]}
              >
                ★
              </Text>
            ))}
            <Text style={[styles.answerText, { color: colors.text, marginLeft: SPACING.sm }]}>
              ({rating}/5)
            </Text>
          </View>
        );

      case 'boolean':
        const boolValue = String(answer).toLowerCase() === 'true' || answer === true;
        return (
          <View style={[
            styles.booleanAnswer,
            { backgroundColor: boolValue ? withAlpha(colors.success, 0.2) : withAlpha(colors.error, 0.2) },
          ]}>
            <Text style={[
              styles.booleanAnswerText,
              { color: boolValue ? colors.success : colors.error },
            ]}>
              {boolValue ? 'Yes' : 'No'}
            </Text>
          </View>
        );

      case 'checkbox':
        if (Array.isArray(answer)) {
          return (
            <View style={styles.checkboxAnswer}>
              {answer.map((item, idx) => (
                <View key={idx} style={[styles.checkboxItem, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <Text style={[styles.checkboxItemText, { color: colors.text }]}>
                    {String(item)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text style={[styles.answerText, { color: colors.text }]}>
            {String(answer)}
          </Text>
        );

      default:
        return (
          <Text style={[styles.answerText, { color: colors.text }]}>
            {String(answer)}
          </Text>
        );
    }
  };

  const renderExportModal = () => (
    <Modal
      visible={showExportModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowExportModal(false)}
      accessibilityViewIsModal
      accessibilityLabel="Export options dialog"
    >
      <View style={[styles.modalOverlay, { backgroundColor: withAlpha('#000000', 0.5) }]}>
        <View 
          style={[
            styles.modalContent, 
            { 
              backgroundColor: colors.card,
              maxWidth: getResponsiveValue(deviceType, { phone: '90%' as DimensionValue, tablet: 480, desktop: 520 }),
            }
          ]}
          accessible
          accessibilityLabel="Export survey responses"
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Export Responses</Text>
            <TouchableOpacity 
              onPress={() => setShowExportModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Close export dialog"
              accessibilityHint="Dismisses the export options"
            >
              <X color={colors.textMuted} size={ICON_SIZE.xl} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Choose a format to export {filteredResponses.length} responses
          </Text>
          
          {isExporting && (
            <View style={styles.exportLoadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.exportLoadingText, { color: colors.text }]}>
                Generating export...
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.exportOption, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            onPress={() => handleExport('csv')}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel="Export as CSV spreadsheet"
            accessibilityHint="Downloads survey responses as a CSV file compatible with Excel and Google Sheets"
            accessibilityState={{ disabled: isExporting }}
          >
            <FileSpreadsheet color={colors.success} size={ICON_SIZE.xl} />
            <View style={styles.exportOptionText}>
              <Text style={[styles.exportOptionTitle, { color: colors.text }]}>CSV Spreadsheet</Text>
              <Text style={[styles.exportOptionDesc, { color: colors.textMuted }]}>
                Compatible with Excel, Google Sheets
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportOption, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            onPress={() => handleExport('pdf')}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel="Export as PDF document"
            accessibilityHint="Generates a formatted PDF report with charts and data"
            accessibilityState={{ disabled: isExporting }}
          >
            <FileText color={colors.error} size={ICON_SIZE.xl} />
            <View style={styles.exportOptionText}>
              <Text style={[styles.exportOptionTitle, { color: colors.text }]}>PDF Report</Text>
              <Text style={[styles.exportOptionDesc, { color: colors.textMuted }]}>
                Formatted document with summary & charts
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportOption, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            onPress={() => handleExport('json')}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel="Export as JSON data"
            accessibilityHint="Downloads survey responses as a JSON file for developers"
            accessibilityState={{ disabled: isExporting }}
          >
            <FileJson color={colors.info} size={ICON_SIZE.xl} />
            <View style={styles.exportOptionText}>
              <Text style={[styles.exportOptionTitle, { color: colors.text }]}>JSON Data</Text>
              <Text style={[styles.exportOptionDesc, { color: colors.textMuted }]}>
                For developers and data analysis
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportOption, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            onPress={async () => {
              const url = `https://app.example.com/survey/${surveyId}/responses`;
              await RNShare.share({ message: `View survey responses: ${url}` });
              setShowExportModal(false);
            }}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel="Share link to responses"
            accessibilityHint="Opens share dialog with a link to view responses"
            accessibilityState={{ disabled: isExporting }}
          >
            <Share2 color={colors.primary} size={ICON_SIZE.xl} />
            <View style={styles.exportOptionText}>
              <Text style={[styles.exportOptionTitle, { color: colors.text }]}>Share Link</Text>
              <Text style={[styles.exportOptionDesc, { color: colors.textMuted }]}>
                Share a link to view responses
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (isLoading && !currentSurvey) {
    return (
      <View 
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading survey responses"
      >
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading survey responses...
        </Text>
      </View>
    );
  }

  if (isError && !isOwner) {
    const errorMessage = error instanceof Error ? error.message : 'You do not have permission to view these responses.';
    return (
      <View 
        style={[styles.errorContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}
        accessibilityRole="alert"
      >
        <StatusBar style={statusBarStyle} />
        <TouchableOpacity 
          style={styles.backButtonAbsolute} 
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={colors.text} size={ICON_SIZE.xl} />
        </TouchableOpacity>
        <View style={styles.errorContent}>
          <View style={[styles.errorIcon, { backgroundColor: withAlpha(colors.error, 0.2) }]}>
            <X color={colors.error} size={48} accessibilityElementsHidden />
          </View>
          <Text 
            style={[styles.errorTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Access Denied
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
          <PrimaryButton title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <View 
      style={[styles.container, { backgroundColor: colors.background }]}
      accessible
      accessibilityLabel="Survey Responses Screen"
    >
      <StatusBar style={statusBarStyle} />

      <View style={[styles.pageWidth, { maxWidth: pageMaxWidth }]}>
        {renderHeader()}

        <View style={styles.mainContent}>
          {isLoading ? (
            <View style={styles.loadingOverlay} accessibilityRole="progressbar">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : viewMode === 'summary' ? (
            renderSummaryView()
          ) : viewMode === 'questions' ? (
            renderQuestionsView()
          ) : (
            renderIndividualView()
          )}
        </View>

        {renderExportModal()}
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageWidth: {
    flex: 1,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: SPACING.base,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorContainer: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  errorMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  backButtonAbsolute: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.md,
    zIndex: 10,
    padding: SPACING.sm,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xxs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  responseCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginTop: SPACING.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    height: 40,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  syncText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Content
  mainContent: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING['3xl'],
  },
  summaryScrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING['3xl'],
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  // Chart Card
  chartCard: {
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  chartCardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.md,
  },

  // Section
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.md,
  },

  // Question Summary Card
  questionSummaryCard: {
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  questionSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  questionNumber: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  },
  questionTypeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm + 32,
  },

  // Question Detail Card
  questionDetailCard: {
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  questionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  questionDetailLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  questionDetailInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  questionDetailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  typeBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'capitalize',
  },
  responseCountSmall: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  questionDetailContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER_WIDTH.hairline,
  },
  textResponses: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  textResponsesTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  textResponseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.base,
    gap: SPACING.sm,
  },
  textResponseText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  // Number Stats
  numberStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
  },
  numberStatItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  numberStatLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  numberStatValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },

  // Individual View
  individualContainer: {
    flex: 1,
  },
  individualNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  navArrow: {
    padding: SPACING.sm,
  },
  navCenter: {
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  navCurrent: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  navDate: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  respondentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
  },
  respondentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respondentDetails: {
    flex: 1,
  },
  respondentName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  respondentEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  responsesScroll: {
    flex: 1,
  },
  responsesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.md,
  },
  responseCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  responseQuestion: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  responseAnswer: {},
  answerText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  ratingAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarLarge: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  booleanAnswer: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  booleanAnswerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  checkboxAnswer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  checkboxItem: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.base,
  },
  checkboxItemText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  emptyStateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },

  // Export Modal
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
  },
  exportOptionText: {
    flex: 1,
    gap: SPACING.xxs,
  },
  exportOptionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  exportOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  exportLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.xl,
    gap: SPACING.md,
    zIndex: 10,
  },
  exportLoadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default SurveyResponsesScreen;
