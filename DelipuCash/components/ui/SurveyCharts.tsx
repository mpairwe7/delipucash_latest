/**
 * Survey Charts - Chart Components for Survey Response Visualization
 * Lightweight, RN-friendly chart components for survey analytics
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  useTheme,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// BAR CHART
// ============================================================================

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  title?: string;
  showValues?: boolean;
  showPercentages?: boolean;
  maxBars?: number;
  height?: number;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  showValues = true,
  showPercentages = false,
  maxBars = 10,
  height = 200,
  horizontal = false,
}) => {
  const { colors } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No data available
        </Text>
      </View>
    );
  }

  const displayData = data.slice(0, maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.value), 1);
  const total = displayData.reduce((sum, d) => sum + d.value, 0);

  const defaultColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.info,
    colors.error,
    '#9B59B6',
    '#1ABC9C',
    '#E67E22',
    '#3498DB',
    '#E91E63',
  ];

  if (horizontal) {
    return (
      <View style={styles.chartContainer}>
        {title && (
          <Text style={[styles.chartTitle, { color: colors.text }]}>{title}</Text>
        )}
        <View style={styles.horizontalBarsContainer}>
          {displayData.map((item, index) => {
            const barWidth = (item.value / maxValue) * 100;
            const barColor = item.color || defaultColors[index % defaultColors.length];
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

            return (
              <View key={index} style={styles.horizontalBarRow}>
                <Text
                  style={[styles.barLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <View style={styles.horizontalBarWrapper}>
                  <View
                    style={[
                      styles.horizontalBar,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                  <Text style={[styles.barValue, { color: colors.text }]}>
                    {showPercentages ? `${percentage}%` : item.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // Vertical bars
  const barWidth = Math.min(40, (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.sm * displayData.length) / displayData.length);

  return (
    <View style={styles.chartContainer}>
      {title && (
        <Text style={[styles.chartTitle, { color: colors.text }]}>{title}</Text>
      )}
      <View style={[styles.verticalBarsContainer, { height }]}>
        {displayData.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 40);
          const barColor = item.color || defaultColors[index % defaultColors.length];
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';

          return (
            <View key={index} style={styles.verticalBarColumn}>
              {showValues && (
                <Text style={[styles.verticalBarValue, { color: colors.textSecondary }]}>
                  {showPercentages ? `${percentage}%` : item.value}
                </Text>
              )}
              <View
                style={[
                  styles.verticalBar,
                  {
                    height: Math.max(barHeight, 4),
                    width: barWidth,
                    backgroundColor: barColor,
                  },
                ]}
              />
              <Text
                style={[styles.verticalBarLabel, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ============================================================================
// PIE / DONUT CHART
// ============================================================================

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  size?: number;
  innerRadius?: number; // 0 for pie, > 0 for donut
  showLegend?: boolean;
  centerText?: string;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  size = 160,
  innerRadius = 50,
  showLegend = true,
  centerText,
}) => {
  const { colors } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyChart, { height: size }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No data available
        </Text>
      </View>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const defaultColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.info,
    colors.error,
    '#9B59B6',
    '#1ABC9C',
    '#E67E22',
  ];

  // Calculate segments
  let cumulativePercentage = 0;
  const segments = data.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const startAngle = cumulativePercentage * 3.6; // Convert to degrees
    cumulativePercentage += percentage;
    return {
      ...item,
      percentage,
      startAngle,
      color: item.color || defaultColors[index % defaultColors.length],
    };
  });

  return (
    <View style={styles.chartContainer}>
      {title && (
        <Text style={[styles.chartTitle, { color: colors.text }]}>{title}</Text>
      )}
      <View style={styles.pieChartWrapper}>
        <View style={[styles.pieChartContainer, { width: size, height: size }]}>
          {/* Background circle */}
          <View
            style={[
              styles.pieBackground,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.border,
              },
            ]}
          />
          
          {/* Colored segments - simplified representation */}
          <View style={[styles.pieSegmentsContainer, { width: size, height: size }]}>
            {segments.map((segment, index) => {
              const segmentStyle = {
                position: 'absolute' as const,
                width: size / 2,
                height: size,
                overflow: 'hidden' as const,
                left: index % 2 === 0 ? 0 : size / 2,
              };
              
              return (
                <View key={index} style={segmentStyle}>
                  <View
                    style={{
                      position: 'absolute',
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: segment.color,
                      left: index % 2 === 0 ? 0 : -size / 2,
                      opacity: 0.1 + (segment.percentage / 100) * 0.9,
                    }}
                  />
                </View>
              );
            })}
          </View>

          {/* Inner circle for donut */}
          {innerRadius > 0 && (
            <View
              style={[
                styles.pieInner,
                {
                  width: innerRadius * 2,
                  height: innerRadius * 2,
                  borderRadius: innerRadius,
                  backgroundColor: colors.background,
                },
              ]}
            />
          )}

          {/* Center text */}
          {centerText && innerRadius > 0 && (
            <View style={styles.pieCenterText}>
              <Text style={[styles.centerTextValue, { color: colors.text }]}>
                {centerText}
              </Text>
            </View>
          )}
        </View>

        {/* Legend */}
        {showLegend && (
          <View style={styles.legendContainer}>
            {segments.map((segment, index) => (
              <View key={index} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: segment.color },
                  ]}
                />
                <Text
                  style={[styles.legendLabel, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {segment.label}
                </Text>
                <Text style={[styles.legendValue, { color: colors.text }]}>
                  {segment.percentage.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// RATING DISPLAY
// ============================================================================

interface RatingDisplayProps {
  average: number;
  distribution: number[]; // [1-star count, 2-star count, ...]
  total: number;
  maxRating?: number;
}

export const RatingDisplay: React.FC<RatingDisplayProps> = ({
  average,
  distribution,
  total,
  maxRating = 5,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingHeader}>
        <Text style={[styles.ratingAverage, { color: colors.text }]}>
          {average.toFixed(1)}
        </Text>
        <View style={styles.starsContainer}>
          {Array.from({ length: maxRating }, (_, i) => (
            <Text
              key={i}
              style={[
                styles.starIcon,
                { color: i < Math.round(average) ? colors.warning : colors.border },
              ]}
            >
              ★
            </Text>
          ))}
        </View>
        <Text style={[styles.ratingTotal, { color: colors.textMuted }]}>
          {total} responses
        </Text>
      </View>
      <View style={styles.ratingBars}>
        {distribution.slice().reverse().map((count, index) => {
          const rating = maxRating - index;
          const percentage = total > 0 ? (count / total) * 100 : 0;
          
          return (
            <View key={rating} style={styles.ratingBarRow}>
              <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
                {rating}
              </Text>
              <View style={[styles.ratingBarBg, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.ratingBarFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: colors.warning,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ============================================================================
// BOOLEAN CHART (Yes/No)
// ============================================================================

interface BooleanChartProps {
  yesCount: number;
  noCount: number;
  yesLabel?: string;
  noLabel?: string;
}

export const BooleanChart: React.FC<BooleanChartProps> = ({
  yesCount,
  noCount,
  yesLabel = 'Yes',
  noLabel = 'No',
}) => {
  const { colors } = useTheme();
  const total = yesCount + noCount;
  const yesPercent = total > 0 ? (yesCount / total) * 100 : 0;
  const noPercent = total > 0 ? (noCount / total) * 100 : 0;

  return (
    <View style={styles.booleanContainer}>
      <View style={styles.booleanRow}>
        <View style={[styles.booleanBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.booleanYes,
              {
                width: `${yesPercent}%`,
                backgroundColor: colors.success,
              },
            ]}
          />
          <View
            style={[
              styles.booleanNo,
              {
                width: `${noPercent}%`,
                backgroundColor: colors.error,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.booleanLabels}>
        <View style={styles.booleanLabelItem}>
          <View style={[styles.booleanDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.booleanLabelText, { color: colors.text }]}>
            {yesLabel}: {yesCount} ({yesPercent.toFixed(1)}%)
          </Text>
        </View>
        <View style={styles.booleanLabelItem}>
          <View style={[styles.booleanDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.booleanLabelText, { color: colors.text }]}>
            {noLabel}: {noCount} ({noPercent.toFixed(1)}%)
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// MINI LINE CHART (for trends)
// ============================================================================

interface MiniLineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({
  data,
  height = 60,
  color,
}) => {
  const { colors } = useTheme();
  const lineColor = color || colors.primary;

  if (!data || data.length < 2) {
    return null;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  // Calculate bar heights for each data point
  const barData = data.map((d) => ({
    label: d.label,
    value: d.value,
    height: ((d.value - minValue) / range) * 100,
  }));

  return (
    <View style={[styles.miniLineContainer, { height: height + 24 }]}>
      {/* Chart area with bars */}
      <View style={[styles.miniLineInner, { height }]}>
        {/* Grid lines */}
        <View style={[styles.miniLineGrid, { borderColor: colors.border }]} />
        
        {/* Bars representing data points */}
        <View style={styles.miniLineBarsContainer}>
          {barData.map((d, index) => (
            <View key={index} style={styles.miniLineBarWrapper}>
              <View
                style={[
                  styles.miniLineBar,
                  {
                    height: `${Math.max(d.height, 5)}%`,
                    backgroundColor: lineColor,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </View>
      
      {/* X-axis labels */}
      <View style={styles.miniLineLabels}>
        <Text style={[styles.miniLineLabel, { color: colors.textMuted }]}>
          {data[0].label}
        </Text>
        <Text style={[styles.miniLineLabel, { color: colors.textMuted }]}>
          {data[data.length - 1].label}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  trendValue,
}) => {
  const { colors } = useTheme();

  const trendColor =
    trend === 'up' ? colors.success :
    trend === 'down' ? colors.error :
    colors.textMuted;

  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statCardHeader}>
        {icon && <View style={styles.statCardIcon}>{icon}</View>}
        <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statCardValue, { color: colors.text }]}>
        {value}
      </Text>
      {(subtext || trendValue) && (
        <View style={styles.statCardFooter}>
          {subtext && (
            <Text style={[styles.statCardSubtext, { color: colors.textMuted }]}>
              {subtext}
            </Text>
          )}
          {trendValue && (
            <Text style={[styles.statCardTrend, { color: trendColor }]}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// WORD CLOUD (simplified)
// ============================================================================

interface WordCloudProps {
  words: { text: string; count: number }[];
  maxWords?: number;
}

export const WordCloud: React.FC<WordCloudProps> = ({
  words,
  maxWords = 20,
}) => {
  const { colors } = useTheme();

  if (!words || words.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No text data available
        </Text>
      </View>
    );
  }

  const sortedWords = [...words]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords);

  const maxCount = sortedWords[0]?.count || 1;
  const minCount = sortedWords[sortedWords.length - 1]?.count || 0;
  const range = maxCount - minCount || 1;

  return (
    <View style={styles.wordCloudContainer}>
      {sortedWords.map((word, index) => {
        const scale = 0.7 + ((word.count - minCount) / range) * 0.6;
        const opacity = 0.5 + ((word.count - minCount) / range) * 0.5;
        
        return (
          <View
            key={index}
            style={[
              styles.wordTag,
              {
                backgroundColor: withAlpha(colors.primary, opacity * 0.2),
                borderColor: withAlpha(colors.primary, opacity),
              },
            ]}
          >
            <Text
              style={[
                styles.wordText,
                {
                  color: colors.text,
                  fontSize: TYPOGRAPHY.fontSize.sm * scale,
                },
              ]}
            >
              {word.text}
            </Text>
            <Text style={[styles.wordCount, { color: colors.textMuted }]}>
              {word.count}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Common
  chartContainer: {
    marginVertical: SPACING.sm,
  },
  chartTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.sm,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Horizontal Bar Chart
  horizontalBarsContainer: {
    gap: SPACING.sm,
  },
  horizontalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  barLabel: {
    width: 80,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  horizontalBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  horizontalBar: {
    height: 20,
    borderRadius: RADIUS.sm,
    minWidth: 4,
  },
  barValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 40,
  },

  // Vertical Bar Chart
  verticalBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: SPACING.lg,
  },
  verticalBarColumn: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  verticalBar: {
    borderRadius: RADIUS.xs,
    minHeight: 4,
  },
  verticalBarValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  verticalBarLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    maxWidth: 50,
    textAlign: 'center',
  },

  // Pie Chart
  pieChartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  pieChartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieBackground: {
    position: 'absolute',
  },
  pieSegmentsContainer: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 9999,
  },
  pieSegment: {},
  pieInner: {
    position: 'absolute',
  },
  pieCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  legendContainer: {
    flex: 1,
    gap: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.xs,
  },
  legendLabel: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  legendValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Rating Display
  ratingContainer: {
    gap: SPACING.md,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ratingAverage: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  ratingTotal: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: 'auto',
  },
  ratingBars: {
    gap: SPACING.xs,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ratingLabel: {
    width: 16,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  ratingBarBg: {
    flex: 1,
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  ratingCount: {
    width: 30,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
  },

  // Boolean Chart
  booleanContainer: {
    gap: SPACING.md,
  },
  booleanRow: {
    flexDirection: 'row',
  },
  booleanBar: {
    flex: 1,
    height: 24,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  booleanYes: {
    height: '100%',
  },
  booleanNo: {
    height: '100%',
  },
  booleanLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  booleanLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  booleanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  booleanLabelText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Mini Line Chart
  miniLineContainer: {
    overflow: 'hidden',
  },
  miniLineInner: {
    flex: 1,
    position: 'relative',
  },
  miniLineGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '50%',
    borderBottomWidth: 1,
    opacity: 0.3,
  },
  miniLineBarsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: 2,
  },
  miniLineBarWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  miniLineBar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 3,
  },
  miniLineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  miniLineLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Stat Card
  statCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statCardIcon: {
    marginRight: SPACING.xxs,
  },
  statCardLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  statCardValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  statCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statCardSubtext: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  statCardTrend: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Word Cloud
  wordCloudContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  wordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xxs,
  },
  wordText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  wordCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default {
  BarChart,
  PieChart,
  RatingDisplay,
  BooleanChart,
  MiniLineChart,
  StatCard,
  WordCloud,
};
