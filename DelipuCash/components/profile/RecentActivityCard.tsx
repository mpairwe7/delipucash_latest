/**
 * RecentActivityCard Component
 * Displays recent earnings activity (withdrawals, rewards, etc.)
 * 
 * Design: Cash App + Robinhood transaction history (2025-2026 style)
 * Features:
 * - Transaction type icons
 * - Relative time display
 * - Amount with color coding (positive/negative)
 * 
 * @example
 * ```tsx
 * <RecentActivityCard
 *   activities={[
 *     { type: 'withdrawal', amount: -50, createdAt: new Date() },
 *     { type: 'reward', amount: 25, createdAt: new Date() },
 *   ]}
 *   onViewAll={() => navigateToHistory()}
 * />
 * ```
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  Star,
  MessageSquare,
  Play,
  ChevronRight,
  Clock,
  LucideIcon,
} from 'lucide-react-native';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

export type ActivityType =
  | 'withdrawal'
  | 'deposit'
  | 'reward'
  | 'survey'
  | 'question'
  | 'video'
  | 'referral'
  | 'bonus';

export interface ActivityItem {
  /** Unique ID */
  id: string;
  /** Activity type */
  type: ActivityType;
  /** Amount (negative for withdrawals) */
  amount: number;
  /** Activity title/description */
  title?: string;
  /** Timestamp */
  createdAt: Date | string;
  /** Status (completed, pending, failed) */
  status?: 'completed' | 'pending' | 'failed';
}

export interface RecentActivityCardProps {
  /** Recent activities */
  activities: ActivityItem[];
  /** Maximum items to show */
  maxItems?: number;
  /** View all handler */
  onViewAll?: () => void;
  /** Item press handler */
  onItemPress?: (item: ActivityItem) => void;
  /** Show empty state */
  showEmpty?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Test ID */
  testID?: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: LucideIcon; color: string; label: string }> = {
  withdrawal: { icon: ArrowUpRight, color: '#FF6B6B', label: 'Withdrawal' },
  deposit: { icon: ArrowDownLeft, color: '#4CAF50', label: 'Deposit' },
  reward: { icon: Gift, color: '#FFD700', label: 'Reward' },
  survey: { icon: MessageSquare, color: '#2196F3', label: 'Survey' },
  question: { icon: Star, color: '#9C27B0', label: 'Question' },
  video: { icon: Play, color: '#FF5722', label: 'Video' },
  referral: { icon: Star, color: '#00BCD4', label: 'Referral' },
  bonus: { icon: Gift, color: '#FFB300', label: 'Bonus' },
};

/**
 * Format relative time (e.g., "2h ago", "Yesterday")
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format currency
 */
function formatAmount(amount: number): string {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(amount).toLocaleString()}`;
}

function ActivityItemRow({
  item,
  index,
  onPress,
}: {
  item: ActivityItem;
  index: number;
  onPress?: (item: ActivityItem) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const config = ACTIVITY_CONFIG[item.type];
  const Icon = config.icon;
  const isPositive = item.amount >= 0;

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  };

  const content = (
    <Animated.View
      entering={FadeInRight.delay(50 * index).duration(300)}
      style={styles.itemRow}
    >
      {/* Icon */}
      <View style={[styles.itemIcon, { backgroundColor: withAlpha(config.color, 0.12) }]}>
        <Icon size={ICON_SIZE.lg} color={config.color} strokeWidth={2} />
      </View>

      {/* Content */}
      <View style={styles.itemContent}>
        <AccessibleText variant="body" medium numberOfLines={1}>
          {item.title || config.label}
        </AccessibleText>
        <View style={styles.itemMeta}>
          <Clock size={12} color={colors.textMuted} />
          <AccessibleText variant="caption" color="textMuted">
            {formatRelativeTime(item.createdAt)}
          </AccessibleText>
          {item.status === 'pending' && (
            <View style={[styles.statusBadge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
              <AccessibleText variant="caption" color="warning">
                Pending
              </AccessibleText>
            </View>
          )}
        </View>
      </View>

      {/* Amount */}
      <AccessibleText
        variant="body"
        bold
        customColor={isPositive ? colors.success : colors.error}
        accessibilityLabel={`${isPositive ? 'Earned' : 'Spent'} ${formatAmount(item.amount)}`}
      >
        {formatAmount(item.amount)}
      </AccessibleText>

      {/* Chevron if interactive */}
      {onPress && (
        <ChevronRight size={ICON_SIZE.base} color={colors.textMuted} style={styles.chevron} />
      )}
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.title || config.label}, ${formatAmount(item.amount)}, ${formatRelativeTime(item.createdAt)}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export function RecentActivityCard({
  activities,
  maxItems = 5,
  onViewAll,
  onItemPress,
  showEmpty = true,
  emptyMessage = "No recent activity. Start earning!",
  testID,
}: RecentActivityCardProps): React.ReactElement {
  const { colors } = useTheme();
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(400).springify()}
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <AccessibleText variant="h4" headingLevel={3}>
          Recent Activity
        </AccessibleText>
        {onViewAll && activities.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewAll();
            }}
            accessibilityRole="button"
            accessibilityLabel="View all activity"
            style={styles.viewAllButton}
          >
            <AccessibleText variant="bodySmall" color="primary">
              View All
            </AccessibleText>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Activity List */}
      {displayedActivities.length > 0 ? (
        <View style={styles.list}>
          {displayedActivities.map((item, index) => (
            <View
              key={item.id}
              style={[
                index < displayedActivities.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: withAlpha(colors.border, 0.6),
                },
              ]}
            >
              <ActivityItemRow
                item={item}
                index={index}
                onPress={onItemPress}
              />
            </View>
          ))}
        </View>
      ) : showEmpty ? (
        <View style={styles.emptyState}>
          <Gift size={32} color={colors.textMuted} strokeWidth={1.5} />
          <AccessibleText variant="body" color="textMuted" center style={styles.emptyText}>
            {emptyMessage}
          </AccessibleText>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  list: {},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    marginLeft: SPACING.xs,
  },
  chevron: {
    marginLeft: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  emptyText: {
    maxWidth: 200,
  },
});

export default RecentActivityCard;
