import React, { memo, useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Href } from "expo-router";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Gift,
  CreditCard,
  Inbox,
  LucideIcon,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { useStatusBar } from "@/hooks/useStatusBar";
import { ThemeColors } from "@/utils/theme";
import { useUnreadCount } from "@/services/hooks";
import { NotificationBell } from "@/components";
import { formatCurrency, formatDate } from "@/services/api";
import {
  useFlatTransactions,
  useTransactionSummary,
  type FlatListItem,
  type DateSection,
} from "@/services/transactionHooks";
import {
  useTransactionUIStore,
  selectSelectedFilter,
  selectSelectedTransactionId,
  selectSetSelectedFilter,
  selectOpenDetail,
  selectCloseDetail,
} from "@/store";
import type { UnifiedTransaction, TransactionFilterType, TransactionSummary } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ANIMATED_INDEX = 15;
const SKELETON_COUNT = 4;

type FilterOption = { id: TransactionFilterType; label: string };
const FILTERS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "reward", label: "Rewards" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "deposit", label: "Deposits" },
  { id: "payment", label: "Payments" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "SUCCESSFUL": return colors.success;
    case "PENDING": return colors.warning;
    case "FAILED": return colors.error;
    default: return colors.textMuted;
  }
}

function getStatusIcon(status: string): LucideIcon {
  switch (status) {
    case "SUCCESSFUL": return CheckCircle;
    case "PENDING": return Clock;
    case "FAILED": return XCircle;
    default: return Clock;
  }
}

function getTypeIcon(type: string): LucideIcon {
  if (type === "reward" || type === "deposit") return ArrowDownLeft;
  return ArrowUpRight;
}

function getTypeColor(type: string, colors: ThemeColors): string {
  if (type === "reward" || type === "deposit") return colors.success;
  return colors.error;
}

function getEmptyState(filter: TransactionFilterType) {
  switch (filter) {
    case "reward":
      return { Icon: Gift, title: "No rewards yet", subtitle: "Start answering questions and completing surveys to earn rewards" };
    case "withdrawal":
      return { Icon: ArrowUpRight, title: "No withdrawals yet", subtitle: "Redeem your earned points when you're ready" };
    case "deposit":
      return { Icon: ArrowDownLeft, title: "No deposits yet", subtitle: "Win instant rewards to see deposits here" };
    case "payment":
      return { Icon: CreditCard, title: "No payments yet", subtitle: "Subscribe to premium features to see payments here" };
    default:
      return { Icon: Inbox, title: "No activity yet", subtitle: "Complete surveys and answer questions to earn rewards" };
  }
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

const SkeletonPulse = memo<{ colors: ThemeColors; style?: object }>(({ colors, style }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: colors.border,
  }));

  return <Animated.View style={[animatedStyle, style]} />;
});
SkeletonPulse.displayName = "SkeletonPulse";

const TransactionCardSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View style={[styles.transactionCard, { backgroundColor: colors.card }]}>
    <View style={styles.transactionContent}>
      <SkeletonPulse colors={colors} style={styles.skeletonIcon} />
      <View style={styles.transactionDetails}>
        <SkeletonPulse colors={colors} style={styles.skeletonTitle} />
        <SkeletonPulse colors={colors} style={styles.skeletonMeta} />
      </View>
      <SkeletonPulse colors={colors} style={styles.skeletonAmount} />
    </View>
  </View>
));
TransactionCardSkeleton.displayName = "TransactionCardSkeleton";

const WalletSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View style={[styles.walletCard, { backgroundColor: colors.card }]}>
    <SkeletonPulse colors={colors} style={{ width: 120, height: 14, borderRadius: 6 }} />
    <SkeletonPulse colors={colors} style={{ width: 180, height: 32, borderRadius: 8, marginTop: 8 }} />
    <View style={styles.walletStats}>
      <SkeletonPulse colors={colors} style={{ width: 100, height: 40, borderRadius: 10 }} />
      <SkeletonPulse colors={colors} style={{ width: 100, height: 40, borderRadius: 10 }} />
    </View>
  </View>
));
WalletSkeleton.displayName = "WalletSkeleton";

// ---------------------------------------------------------------------------
// Wallet Summary Card
// ---------------------------------------------------------------------------

interface WalletSummaryCardProps {
  summary: TransactionSummary | undefined;
  colors: ThemeColors;
  isLoading: boolean;
}

const WalletSummaryCard = memo<WalletSummaryCardProps>(({ summary, colors, isLoading }) => {
  if (isLoading || !summary) return <WalletSkeleton colors={colors} />;

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[styles.walletCard, { backgroundColor: colors.card }]}
    >
      <Text style={[styles.walletLabel, { color: colors.textMuted }]}>Current Balance</Text>
      <Text style={[styles.walletBalance, { color: colors.text }]}>
        {summary.currentBalance.toLocaleString()} pts
      </Text>

      <View style={styles.walletStats}>
        <View style={[styles.walletStatPill, { backgroundColor: `${colors.success}15` }]}>
          <TrendingUp size={14} color={colors.success} strokeWidth={2} />
          <View>
            <Text style={[styles.walletStatValue, { color: colors.success }]}>
              {summary.totalEarned.toLocaleString()}
            </Text>
            <Text style={[styles.walletStatLabel, { color: colors.textMuted }]}>Earned</Text>
          </View>
        </View>

        <View style={[styles.walletStatPill, { backgroundColor: `${colors.error}15` }]}>
          <TrendingDown size={14} color={colors.error} strokeWidth={2} />
          <View>
            <Text style={[styles.walletStatValue, { color: colors.error }]}>
              {formatCurrency(summary.totalWithdrawn)}
            </Text>
            <Text style={[styles.walletStatLabel, { color: colors.textMuted }]}>Withdrawn</Text>
          </View>
        </View>
      </View>

      {summary.pendingWithdrawals > 0 && (
        <View style={[styles.pendingBanner, { backgroundColor: `${colors.warning}15` }]}>
          <Clock size={12} color={colors.warning} strokeWidth={2} />
          <Text style={[styles.pendingBannerText, { color: colors.warning }]}>
            {formatCurrency(summary.pendingWithdrawals)} pending withdrawal
          </Text>
        </View>
      )}
    </Animated.View>
  );
});
WalletSummaryCard.displayName = "WalletSummaryCard";

// ---------------------------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  filterId: TransactionFilterType;
  label: string;
  count: number;
  isActive: boolean;
  colors: ThemeColors;
  onFilterPress: (id: TransactionFilterType) => void;
}

const FilterChip = memo<FilterChipProps>(({ filterId, label, count, isActive, colors, onFilterPress }) => {
  const handlePress = useCallback(() => onFilterPress(filterId), [filterId, onFilterPress]);

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: isActive ? colors.primary : colors.card,
          borderColor: isActive ? colors.primary : colors.border,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}${count > 0 ? `, ${count} items` : ''}`}
      accessibilityState={{ selected: isActive }}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: isActive ? colors.primaryText : colors.text },
        ]}
      >
        {label}
      </Text>
      {count > 0 && (
        <View
          style={[
            styles.chipBadge,
            { backgroundColor: isActive ? `${colors.primaryText}30` : `${colors.textMuted}20` },
          ]}
        >
          <Text
            style={[
              styles.chipBadgeText,
              { color: isActive ? colors.primaryText : colors.textMuted },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});
FilterChip.displayName = "FilterChip";

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

const SectionHeader = memo<{ title: DateSection; colors: ThemeColors }>(({ title, colors }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>{title}</Text>
  </View>
));
SectionHeader.displayName = "SectionHeader";

// ---------------------------------------------------------------------------
// Transaction Card
// ---------------------------------------------------------------------------

interface TransactionCardProps {
  transaction: UnifiedTransaction;
  colors: ThemeColors;
  index: number;
  onPress: (id: string) => void;
}

const TransactionCard = memo<TransactionCardProps>(({ transaction, colors, index, onPress }) => {
  const typeColor = getTypeColor(transaction.type, colors);
  const statusColor = getStatusColor(transaction.status, colors);
  const StatusIconComp = getStatusIcon(transaction.status);
  const TypeIconComp = getTypeIcon(transaction.type);
  const isPending = transaction.status === "PENDING";

  const handlePress = useCallback(() => onPress(transaction.id), [onPress, transaction.id]);

  const content = (
    <TouchableOpacity
      style={[styles.transactionCard, { backgroundColor: colors.card }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${transaction.description}, ${transaction.amount > 0 ? "+" : ""}${formatCurrency(Math.abs(transaction.amount))}, ${transaction.status}`}
      activeOpacity={0.7}
    >
      <View style={styles.transactionContent}>
        {/* Type icon */}
        <View style={[styles.transactionIcon, { backgroundColor: `${typeColor}15` }]}>
          <TypeIconComp size={22} color={typeColor} strokeWidth={1.8} />
        </View>

        {/* Details */}
        <View style={styles.transactionDetails}>
          <Text style={[styles.transactionDescription, { color: colors.text }]} numberOfLines={1}>
            {transaction.description}
          </Text>

          <View style={styles.transactionMeta}>
            <View style={styles.statusBadge}>
              <StatusIconComp size={12} color={statusColor} strokeWidth={2} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {transaction.status.charAt(0) + transaction.status.slice(1).toLowerCase()}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDate(transaction.createdAt)}
            </Text>
          </View>

          {transaction.paymentMethod && (
            <Text style={[styles.paymentText, { color: colors.textMuted }]} numberOfLines={1}>
              {transaction.paymentMethod === "airtel_money" ? "Airtel Money" : "MTN MoMo"}
              {transaction.phoneNumber ? ` \u2022 ${transaction.phoneNumber}` : ""}
            </Text>
          )}
        </View>

        {/* Amount */}
        <Text style={[styles.transactionAmount, { color: typeColor }]}>
          {transaction.amount > 0 ? "+" : ""}
          {formatCurrency(Math.abs(transaction.amount))}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Animate only first N items for performance
  if (index < MAX_ANIMATED_INDEX) {
    return (
      <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
        {isPending ? <PendingPulseWrapper>{content}</PendingPulseWrapper> : content}
      </Animated.View>
    );
  }

  return isPending ? <PendingPulseWrapper>{content}</PendingPulseWrapper> : content;
});
TransactionCard.displayName = "TransactionCard";

// Pending pulse wrapper
const PendingPulseWrapper = memo<{ children: React.ReactNode }>(({ children }) => {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withDelay(0, withTiming(0.6, { duration: 1200 })),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={style}>{children}</Animated.View>;
});
PendingPulseWrapper.displayName = "PendingPulseWrapper";

// ---------------------------------------------------------------------------
// Transaction Detail Sheet
// ---------------------------------------------------------------------------

interface DetailSheetProps {
  transaction: UnifiedTransaction | undefined;
  colors: ThemeColors;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  bottomInset: number;
  onClose: () => void;
}

const TransactionDetailSheet = memo<DetailSheetProps>(
  ({ transaction, colors, bottomSheetRef, bottomInset, onClose }) => {
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    const handleChange = useCallback(
      (idx: number) => { if (idx === -1) onClose(); },
      [onClose],
    );

    // Always render BottomSheet so the ref is attached. Conditionally render content.
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={["45%"]}
        enablePanDownToClose
        onChange={handleChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: Math.max(bottomInset, 20) }]}>
          {transaction ? (
            <TransactionDetailContent transaction={transaction} colors={colors} />
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
TransactionDetailSheet.displayName = "TransactionDetailSheet";

/** Inner content for the detail sheet — separated to keep the BottomSheet always mounted. */
const TransactionDetailContent = memo<{ transaction: UnifiedTransaction; colors: ThemeColors }>(
  ({ transaction, colors }) => {
    const typeColor = getTypeColor(transaction.type, colors);
    const statusColor = getStatusColor(transaction.status, colors);
    const StatusIconComp = getStatusIcon(transaction.status);

    return (
      <>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={[styles.sheetIcon, { backgroundColor: `${typeColor}15` }]}>
            {React.createElement(getTypeIcon(transaction.type), {
              size: 28,
              color: typeColor,
              strokeWidth: 1.8,
            })}
          </View>
          <Text style={[styles.sheetAmount, { color: typeColor }]}>
            {transaction.amount > 0 ? "+" : ""}
            {formatCurrency(Math.abs(transaction.amount))}
          </Text>
          <Text style={[styles.sheetDescription, { color: colors.text }]}>
            {transaction.description}
          </Text>
        </View>

        {/* Status */}
        <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>Status</Text>
          <View style={styles.statusBadge}>
            <StatusIconComp size={14} color={statusColor} strokeWidth={2} />
            <Text style={[styles.sheetRowValue, { color: statusColor }]}>
              {transaction.status.charAt(0) + transaction.status.slice(1).toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Date */}
        <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>Date</Text>
          <Text style={[styles.sheetRowValue, { color: colors.text }]}>
            {formatDate(transaction.createdAt)}
          </Text>
        </View>

        {/* Type */}
        <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>Type</Text>
          <Text style={[styles.sheetRowValue, { color: colors.text }]}>
            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
          </Text>
        </View>

        {/* Reference ID */}
        {transaction.referenceId && (
          <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>Reference</Text>
            <Text style={[styles.sheetRowValue, { color: colors.text }]} numberOfLines={1}>
              {transaction.referenceId}
            </Text>
          </View>
        )}

        {/* Payment Method */}
        {transaction.paymentMethod && (
          <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>Payment</Text>
            <Text style={[styles.sheetRowValue, { color: colors.text }]}>
              {transaction.paymentMethod === "airtel_money" ? "Airtel Money" : "MTN MoMo"}
              {transaction.phoneNumber ? ` \u2022 ${transaction.phoneNumber}` : ""}
            </Text>
          </View>
        )}
      </>
    );
  },
);
TransactionDetailContent.displayName = "TransactionDetailContent";

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function TransactionsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle } = useStatusBar();
  const { data: unreadCount } = useUnreadCount();

  // Zustand persisted filter (stable exported selectors — no inline closures)
  const selectedFilter = useTransactionUIStore(selectSelectedFilter);
  const setSelectedFilter = useTransactionUIStore(selectSetSelectedFilter);
  const selectedTxId = useTransactionUIStore(selectSelectedTransactionId);
  const openDetail = useTransactionUIStore(selectOpenDetail);
  const closeDetail = useTransactionUIStore(selectCloseDetail);

  // Data hooks
  const {
    flatData,
    summary: pageSummary,
    activeTotal,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    data: queryData,
  } = useFlatTransactions({ type: selectedFilter });

  const { data: summaryData, isLoading: isSummaryLoading } = useTransactionSummary();
  const summary = summaryData ?? pageSummary;

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find selected transaction for detail sheet
  const selectedTransaction: UnifiedTransaction | undefined = useMemo(() => {
    if (!selectedTxId || !queryData?.pages) return undefined;
    for (const page of queryData.pages) {
      const found = page.transactions.find((t) => t.id === selectedTxId);
      if (found) return found;
    }
    return undefined;
  }, [selectedTxId, queryData?.pages]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleTransactionPress = useCallback(
    (id: string) => {
      openDetail(id);
      // Defer snap so BottomSheet content renders with the new transaction first
      requestAnimationFrame(() => {
        bottomSheetRef.current?.snapToIndex(0);
      });
    },
    [openDetail],
  );

  const handleCloseDetail = useCallback(() => {
    closeDetail();
  }, [closeDetail]);

  const handleFilterPress = useCallback(
    (filterId: TransactionFilterType) => {
      setSelectedFilter(filterId);
    },
    [setSelectedFilter],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FlatListItem; index: number }) => {
      if (item.type === "section") {
        return <SectionHeader title={item.title} colors={colors} />;
      }
      return (
        <TransactionCard
          transaction={item.data}
          colors={colors}
          index={index}
          onPress={handleTransactionPress}
        />
      );
    },
    [colors, handleTransactionPress],
  );

  const keyExtractor = useCallback((item: FlatListItem) => item.key, []);

  // List header
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Screen Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Transactions</Text>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Your complete transaction history
          </Text>
        </View>

        {/* Wallet Summary */}
        <WalletSummaryCard
          summary={summary}
          colors={colors}
          isLoading={isSummaryLoading && !summary}
        />

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              filterId={f.id}
              label={f.label}
              count={selectedFilter === f.id ? activeTotal : 0}
              isActive={selectedFilter === f.id}
              colors={colors}
              onFilterPress={handleFilterPress}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [colors, unreadCount, summary, isSummaryLoading, activeTotal, selectedFilter, handleFilterPress],
  );

  // List empty state
  const ListEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <TransactionCardSkeleton key={`skel_${i}`} colors={colors} />
          ))}
        </View>
      );
    }

    const { Icon, title, subtitle } = getEmptyState(selectedFilter);
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.emptyState, { backgroundColor: colors.card }]}
      >
        <Icon size={48} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </Animated.View>
    );
  }, [isLoading, selectedFilter, colors]);

  // List footer (infinite scroll indicator)
  const ListFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, colors.primary]);

  // Stable contentContainerStyle (avoids new object every render → prevents FlatList re-layout)
  const contentContainerStyle = useMemo(
    () => ({
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 80,
      paddingHorizontal: 16,
      flexGrow: 1,
    }),
    [insets.top, insets.bottom],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} animated />

      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />

      {/* Transaction Detail Bottom Sheet */}
      <TransactionDetailSheet
        transaction={selectedTransaction}
        colors={colors}
        bottomSheetRef={bottomSheetRef}
        bottomInset={insets.bottom}
        onClose={handleCloseDetail}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
  },
  headerSubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginTop: 2,
  },

  // Wallet Card
  walletCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  walletLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
  },
  walletBalance: {
    fontFamily: "Roboto_700Bold",
    fontSize: 32,
    marginTop: 4,
  },
  walletStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  walletStatPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 10,
  },
  walletStatValue: {
    fontFamily: "Roboto_700Bold",
    fontSize: 13,
  },
  walletStatLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  pendingBannerText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 12,
  },

  // Filters
  filterContainer: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
  },
  chipBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  chipBadgeText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 11,
  },

  // Section Header
  sectionHeader: {
    paddingVertical: 8,
    paddingTop: 16,
  },
  sectionHeaderText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Transaction Card
  transactionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  transactionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
    marginBottom: 3,
  },
  transactionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
  },
  dateText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
  },
  paymentText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  transactionAmount: {
    fontFamily: "Roboto_700Bold",
    fontSize: 15,
    marginLeft: 8,
  },

  // Empty & Loading
  emptyState: {
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    marginTop: 8,
  },
  emptyTitle: {
    fontFamily: "Roboto_500Medium",
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  // Skeletons
  skeletonList: {
    gap: 8,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  skeletonTitle: {
    width: "70%",
    height: 14,
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonMeta: {
    width: "50%",
    height: 10,
    borderRadius: 5,
  },
  skeletonAmount: {
    width: 60,
    height: 16,
    borderRadius: 6,
    marginLeft: 8,
  },

  // Bottom Sheet
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sheetHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sheetAmount: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
    marginBottom: 4,
  },
  sheetDescription: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
  },
  sheetRowValue: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
  },
});
