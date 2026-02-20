import React, { useState, useMemo, memo, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Href } from "expo-router";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  LucideIcon,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useStatusBar } from "@/hooks/useStatusBar";
import {
  useTheme,
  ThemeColors,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  COMPONENT_SIZE,
} from "@/utils/theme";
import { useTransactions, useUnreadCount } from "@/services/hooks";
import { NotificationBell } from "@/components";
import { Transaction, PaymentStatus } from "@/types";
import { formatCurrency, formatDate } from "@/services/api";

type TransactionStatus = "PENDING" | "SUCCESSFUL" | "FAILED";
type TransactionType = "reward" | "withdrawal" | "deposit" | "payment";
type FilterType = "all" | "reward" | "withdrawal" | "deposit";

interface TransactionDisplay {
  id: string;
  description: string;
  amount: number;
  status: TransactionStatus;
  type: TransactionType;
  createdAt: string;
  referenceId?: string;
  paymentMethod?: string;
  phoneNumber?: string;
}

interface FilterChipProps {
  id: FilterType;
  label: string;
  isActive: boolean;
  colors: ThemeColors;
  onPress: () => void;
}

const FilterChip = memo<FilterChipProps>(
  ({ label, isActive, colors, onPress }) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: isActive ? colors.primary : colors.card,
          borderColor: isActive ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: isActive ? colors.primaryText : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
);

FilterChip.displayName = "FilterChip";

interface TransactionCardProps {
  transaction: TransactionDisplay;
  colors: ThemeColors;
}

const TransactionCard = memo<TransactionCardProps>(({ transaction, colors }) => {
  const getStatusColor = (status: TransactionStatus): string => {
    switch (status) {
      case "SUCCESSFUL":
        return colors.success;
      case "PENDING":
        return colors.warning;
      case "FAILED":
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: TransactionStatus): LucideIcon => {
    switch (status) {
      case "SUCCESSFUL":
        return CheckCircle;
      case "PENDING":
        return Clock;
      case "FAILED":
        return XCircle;
      default:
        return Clock;
    }
  };

  const getTypeIcon = (type: TransactionType): LucideIcon => {
    if (type === "reward" || type === "deposit") {
      return ArrowDownLeft;
    }
    return ArrowUpRight;
  };

  const getTypeColor = (type: TransactionType): string => {
    if (type === "reward" || type === "deposit") {
      return colors.success;
    }
    return colors.error;
  };

  const StatusIcon = getStatusIcon(transaction.status);
  const TypeIcon = getTypeIcon(transaction.type);
  const typeColor = getTypeColor(transaction.type);
  const statusColor = getStatusColor(transaction.status);

  return (
    <View style={[styles.transactionCard, { backgroundColor: colors.card }]}>
      <View style={styles.transactionContent}>
        {/* Icon */}
        <View style={[styles.transactionIcon, { backgroundColor: `${typeColor}20` }]}>
          <TypeIcon size={24} color={typeColor} strokeWidth={1.5} />
        </View>

        {/* Content */}
        <View style={styles.transactionDetails}>
          <Text style={[styles.transactionDescription, { color: colors.text }]}>
            {transaction.description}
          </Text>

          {/* Status & Date */}
          <View style={styles.transactionMeta}>
            <View style={styles.statusBadge}>
              <StatusIcon size={14} color={statusColor} strokeWidth={1.5} />
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor, textTransform: "capitalize" },
                ]}
              >
                {transaction.status}
              </Text>
            </View>

            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDate(transaction.createdAt)}
            </Text>
          </View>

          {/* Reference ID */}
          {transaction.referenceId && (
            <Text style={[styles.referenceText, { color: colors.textMuted }]}>
              Ref: {transaction.referenceId}
            </Text>
          )}

          {/* Payment Method */}
          {transaction.paymentMethod && (
            <Text style={[styles.paymentText, { color: colors.textMuted }]}>
              {transaction.paymentMethod === "airtel_money"
                ? "Airtel Money"
                : "MTN Mobile Money"}{" "}
              • {transaction.phoneNumber}
            </Text>
          )}
        </View>

        {/* Amount */}
        <Text style={[styles.transactionAmount, { color: typeColor }]}>
          {transaction.amount > 0 ? "+" : ""}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>
    </View>
  );
});

TransactionCard.displayName = "TransactionCard";

interface FilterOption {
  id: FilterType;
  label: string;
}

const filters: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "reward", label: "Rewards" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "deposit", label: "Deposits" },
];

/**
 * Transactions screen component
 * Displays user's transaction history with filtering options
 */
export default function TransactionsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle } = useStatusBar(); // Focus-aware status bar management
  const [filter, setFilter] = useState<FilterType>("all");
  const { data: unreadCount } = useUnreadCount();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch transactions from API
  const { data: transactions = [], isLoading, refetch } = useTransactions({ type: filter });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Transform transactions for display
  const displayTransactions: TransactionDisplay[] = useMemo(() => {
    return transactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      status: t.status as TransactionStatus,
      type: t.type as TransactionType,
      createdAt: t.createdAt,
      referenceId: t.referenceId,
      paymentMethod: t.paymentMethod,
      phoneNumber: t.phoneNumber,
    }));
  }, [transactions]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} animated />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Transactions</Text>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Your complete transaction history</Text>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {filters.map((f) => (
            <FilterChip
              key={f.id}
              id={f.id}
              label={f.label}
              isActive={filter === f.id}
              colors={colors}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>

        {/* Transactions List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {displayTransactions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Filter size={48} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No transactions found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Try changing the filter
                </Text>
              </View>
            ) : (
              displayTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  colors={colors}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
  },
  headerSubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 24,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
  transactionsList: {
    gap: 12,
  },
  emptyState: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontFamily: "Roboto_500Medium",
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  transactionCard: {
    borderRadius: 16,
    padding: 16,
  },
  transactionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontFamily: "Roboto_500Medium",
    fontSize: 15,
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
  },
  dateText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
  },
  referenceText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
  },
  paymentText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  transactionAmount: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
    marginLeft: 12,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
