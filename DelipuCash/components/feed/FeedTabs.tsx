/**
 * FeedTabs Component
 * 
 * Horizontal scrollable tabs for feed filtering, inspired by:
 * - Twitter/X: Clean pill-style tabs with underline indicator
 * - TikTok: Smooth scroll with snap behavior
 * - Instagram: Minimal with active indicator animation
 * 
 * Features:
 * - Smooth animated underline/pill indicator
 * - Haptic feedback on selection
 * - Full accessibility support
 * - Horizontal scroll for many tabs
 * - Optional badge/count on tabs
 * - Auto-scroll to selected tab
 * 
 * @example
 * ```tsx
 * <FeedTabs
 *   tabs={[
 *     { id: 'for-you', label: 'For You', icon: Sparkles },
 *     { id: 'latest', label: 'Latest', count: 12 },
 *     { id: 'unanswered', label: 'Unanswered' },
 *     { id: 'rewards', label: 'Rewards', badge: 'NEW' },
 *   ]}
 *   selectedTab="for-you"
 *   onTabChange={setSelectedTab}
 * />
 * ```
 */

import React, { useCallback, useRef, useEffect, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  LayoutChangeEvent,
  AccessibilityInfo,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  COMPONENT_SIZE,
  withAlpha,
} from "@/utils/theme";
import * as Haptics from "expo-haptics";
import { LucideIcon } from "lucide-react-native";

/**
 * Tab item configuration
 */
export interface FeedTab {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Optional count badge (for notifications, unread, etc.) */
  count?: number;
  /** Optional text badge (e.g., "NEW", "HOT") */
  badge?: string;
  /** Whether this tab is disabled */
  disabled?: boolean;
}

export interface FeedTabsProps {
  /** Array of tab items */
  tabs: FeedTab[];
  /** Currently selected tab ID */
  selectedTab: string;
  /** Callback when tab is changed */
  onTabChange: (tabId: string) => void;
  /** Tab style variant */
  variant?: "pill" | "underline" | "minimal";
  /** Whether to show icons */
  showIcons?: boolean;
  /** Container style override */
  style?: object;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Spring config for tab animations
 */
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

/**
 * Individual tab button component
 */
const TabButton = memo(function TabButton({
  tab,
  isSelected,
  onPress,
  onLayout,
  variant,
  showIcon,
  colors,
  index,
}: {
  tab: FeedTab;
  isSelected: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  variant: "pill" | "underline" | "minimal";
  showIcon: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
  index: number;
}) {
  const Icon = tab.icon;
  const selectedColor = colors.primary;
  const defaultColor = colors.textMuted;

  // Pre-compute the alpha color outside of worklet
  const selectedBgColor = withAlpha(selectedColor, 0.12);

  const animatedBgStyle = useAnimatedStyle(() => {
    if (variant !== "pill") return {};
    return {
      backgroundColor: withTiming(
        isSelected ? selectedBgColor : "transparent",
        { duration: 200 }
      ),
    };
  }, [isSelected, variant, selectedBgColor]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onLayout={onLayout}
      disabled={tab.disabled}
      style={[
        styles.tab,
        variant === "pill" && styles.tabPill,
        variant === "underline" && styles.tabUnderline,
        variant === "minimal" && styles.tabMinimal,
        tab.disabled && styles.tabDisabled,
        animatedBgStyle,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected, disabled: tab.disabled }}
      accessibilityLabel={`${tab.label} tab${tab.count ? `, ${tab.count} items` : ""}${tab.badge ? `, ${tab.badge}` : ""}`}
      accessibilityHint={`Double tap to switch to ${tab.label} feed`}
    >
      {showIcon && Icon && (
        <Icon
          size={16}
          color={isSelected ? selectedColor : defaultColor}
          strokeWidth={isSelected ? 2 : 1.5}
        />
      )}
      
      <Text
        style={[
          styles.tabLabel,
          {
            color: isSelected ? selectedColor : defaultColor,
            fontFamily: isSelected 
              ? TYPOGRAPHY.fontFamily.bold 
              : TYPOGRAPHY.fontFamily.medium,
          },
        ]}
      >
        {tab.label}
      </Text>

      {/* Count badge */}
      {tab.count !== undefined && tab.count > 0 && (
        <View 
          style={[
            styles.countBadge,
            { backgroundColor: isSelected ? selectedColor : colors.textMuted },
          ]}
        >
          <Text style={[styles.countText, { color: colors.primaryText }]}>
            {tab.count > 99 ? "99+" : tab.count}
          </Text>
        </View>
      )}

      {/* Text badge (NEW, HOT, etc.) */}
      {tab.badge && (
        <View 
          style={[
            styles.textBadge,
            { backgroundColor: colors.error },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.primaryText }]}>
            {tab.badge}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
});

/**
 * FeedTabs - Main component
 */
function FeedTabsComponent({
  tabs,
  selectedTab,
  onTabChange,
  variant = "pill",
  showIcons = true,
  style,
}: FeedTabsProps): React.ReactElement {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  
  // Track tab positions for indicator animation
  const tabPositions = useRef<{ [key: string]: { x: number; width: number } }>({});
  
  // Animated values for underline indicator
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Update indicator position when selection changes
  useEffect(() => {
    const position = tabPositions.current[selectedTab];
    if (position) {
      indicatorX.value = withSpring(position.x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(position.width, SPRING_CONFIG);
    }
  }, [selectedTab, indicatorX, indicatorWidth]);

  // Handle tab press
  const handleTabPress = useCallback((tabId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTabChange(tabId);
    
    // Announce for accessibility
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      AccessibilityInfo.announceForAccessibility(`${tab.label} selected`);
    }

    // Scroll to make tab visible
    const position = tabPositions.current[tabId];
    if (position && scrollRef.current) {
      scrollRef.current.scrollTo({
        x: Math.max(0, position.x - 50),
        animated: true,
      });
    }
  }, [onTabChange, tabs]);

  // Handle tab layout to track positions
  const handleTabLayout = useCallback((tabId: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabPositions.current[tabId] = { x, width };
    
    // Update indicator if this is the selected tab
    if (tabId === selectedTab) {
      indicatorX.value = withSpring(x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(width, SPRING_CONFIG);
    }
  }, [selectedTab, indicatorX, indicatorWidth]);

  // Animated indicator style
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isSelected={selectedTab === tab.id}
            onPress={() => handleTabPress(tab.id)}
            onLayout={(e) => handleTabLayout(tab.id, e)}
            variant={variant}
            showIcon={showIcons}
            colors={colors}
            index={index}
          />
        ))}
      </ScrollView>

      {/* Underline indicator (only for underline variant) */}
      {variant === "underline" && (
        <View style={styles.indicatorContainer}>
          <Animated.View
            style={[
              styles.indicator,
              { backgroundColor: colors.primary },
              indicatorStyle,
            ]}
          />
        </View>
      )}
    </View>
  );
}

export const FeedTabs = memo(FeedTabsComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    gap: SPACING.sm,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minHeight: COMPONENT_SIZE.touchTarget,
    paddingHorizontal: SPACING.md,
  },
  tabPill: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
  },
  tabUnderline: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
  },
  tabMinimal: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xs,
  },
  countText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs - 1,
  },
  textBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 8,
    textTransform: "uppercase",
  },
  indicatorContainer: {
    height: 3,
    position: "relative",
    marginTop: -1,
  },
  indicator: {
    height: 3,
    borderRadius: RADIUS.full,
    position: "absolute",
    bottom: 0,
  },
});

export default FeedTabs;
