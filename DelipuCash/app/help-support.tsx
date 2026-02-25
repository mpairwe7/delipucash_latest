/**
 * Help & Support Screen
 * Comprehensive help center with FAQ, contact methods, and tutorials
 * Architecture: FlatList for FAQ, ScrollView for Contact/Tutorials
 * Follows transactions.tsx / notifications.tsx patterns
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  RefreshControl,
  Pressable,
  Linking,
  InteractionManager,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  HelpCircle,
  MessageSquare,
  Book,
  Headphones,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import {
  SearchBar,
  FAQItemComponent,
  ContactCard,
  QuickActionCard,
  TutorialCard,
} from '@/components/support';
import { EmptyState } from '@/components/notifications';
import { useToast } from '@/components/ui/Toast';
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';
import {
  fetchFAQs,
  searchFAQs,
  rateFAQ,
  fetchContactMethods,
  fetchQuickActions,
  fetchTutorials,
  getFAQCategories,
  type FAQItem,
  type ContactMethod,
  type QuickAction,
  type Tutorial,
  type FAQCategory,
} from '@/services/supportApi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ANIMATED_INDEX = 15;
const SKELETON_COUNT = 4;

type TabType = 'faq' | 'contact' | 'tutorials';

const TABS: { id: TabType; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'faq', label: 'FAQs', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: MessageSquare },
  { id: 'tutorials', label: 'Tutorials', icon: Book },
];

// ---------------------------------------------------------------------------
// Skeleton Components (matches transactions.tsx pattern)
// ---------------------------------------------------------------------------

const SkeletonPulse = memo<{ colors: ThemeColors; style?: object }>(
  ({ colors, style }) => {
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
      opacity.value = withRepeat(
        withTiming(1, { duration: 800 }),
        -1,
        true,
      );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      backgroundColor: colors.border,
    }));

    return <Animated.View style={[animatedStyle, style]} />;
  },
);
SkeletonPulse.displayName = 'SkeletonPulse';

const FAQSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View
    style={[
      styles.faqSkeletonCard,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
  >
    <SkeletonPulse
      colors={colors}
      style={{ width: '80%', height: 16, borderRadius: 6 }}
    />
    <SkeletonPulse
      colors={colors}
      style={{ width: '40%', height: 10, borderRadius: 4, marginTop: 8 }}
    />
  </View>
));
FAQSkeleton.displayName = 'FAQSkeleton';

const ContactSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View
    style={[
      styles.contactSkeletonCard,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
  >
    <SkeletonPulse
      colors={colors}
      style={{ width: 48, height: 48, borderRadius: RADIUS.md }}
    />
    <View style={{ flex: 1, marginLeft: SPACING.md }}>
      <SkeletonPulse
        colors={colors}
        style={{ width: '60%', height: 14, borderRadius: 6 }}
      />
      <SkeletonPulse
        colors={colors}
        style={{ width: '80%', height: 12, borderRadius: 6, marginTop: 6 }}
      />
      <SkeletonPulse
        colors={colors}
        style={{ width: '45%', height: 10, borderRadius: 4, marginTop: 6 }}
      />
    </View>
  </View>
));
ContactSkeleton.displayName = 'ContactSkeleton';

const TutorialSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View
    style={[
      styles.tutorialSkeletonCard,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
  >
    <SkeletonPulse
      colors={colors}
      style={{ width: '100%', height: 140, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }}
    />
    <View style={{ padding: SPACING.md }}>
      <SkeletonPulse
        colors={colors}
        style={{ width: '35%', height: 10, borderRadius: 4 }}
      />
      <SkeletonPulse
        colors={colors}
        style={{ width: '80%', height: 14, borderRadius: 6, marginTop: 8 }}
      />
      <SkeletonPulse
        colors={colors}
        style={{ width: '95%', height: 12, borderRadius: 6, marginTop: 6 }}
      />
    </View>
  </View>
));
TutorialSkeleton.displayName = 'TutorialSkeleton';

// ---------------------------------------------------------------------------
// FilterChip (matches transactions.tsx / notifications.tsx pattern)
// ---------------------------------------------------------------------------

interface FilterChipProps {
  filterId: FAQCategory | 'all';
  label: string;
  count: number;
  isActive: boolean;
  colors: ThemeColors;
  onFilterPress: (id: FAQCategory | 'all') => void;
}

const FilterChip = memo<FilterChipProps>(
  ({ filterId, label, count, isActive, colors, onFilterPress }) => {
    const handlePress = useCallback(
      () => onFilterPress(filterId),
      [filterId, onFilterPress],
    );

    return (
      <Pressable
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
      >
        <ThemedText
          style={[
            styles.filterChipText,
            { color: isActive ? '#FFFFFF' : colors.textSecondary },
          ]}
        >
          {label}
        </ThemedText>
        {count > 0 && (
          <View
            style={[
              styles.chipBadge,
              {
                backgroundColor: isActive
                  ? 'rgba(255,255,255,0.3)'
                  : withAlpha(colors.textMuted, 0.2),
              },
            ]}
          >
            <ThemedText
              style={[
                styles.chipBadgeText,
                { color: isActive ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {count}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  },
);
FilterChip.displayName = 'FilterChip';

// ---------------------------------------------------------------------------
// TabButton (memoized with a11y)
// ---------------------------------------------------------------------------

interface TabButtonProps {
  id: TabType;
  label: string;
  icon: React.ComponentType<any>;
  isActive: boolean;
  colors: ThemeColors;
  onPress: (id: TabType) => void;
}

const TabButton = memo<TabButtonProps>(
  ({ id, label, icon: Icon, isActive, colors, onPress }) => {
    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(id);
    }, [id, onPress]);

    return (
      <Pressable
        style={[
          styles.tab,
          isActive && { backgroundColor: withAlpha(colors.primary, 0.1) },
        ]}
        onPress={handlePress}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${label} tab`}
      >
        <Icon
          size={ICON_SIZE.sm}
          color={isActive ? colors.primary : colors.textSecondary}
        />
        <ThemedText
          style={[
            styles.tabText,
            {
              color: isActive ? colors.primary : colors.textSecondary,
              fontWeight: isActive ? '600' : '500',
            },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  },
);
TabButton.displayName = 'TabButton';

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

const SupportErrorState = memo<{
  message: string;
  onRetry: () => void;
  colors: ThemeColors;
}>(({ message, onRetry, colors }) => (
  <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
    <View
      style={[
        styles.errorIconContainer,
        { backgroundColor: withAlpha(colors.error, 0.1) },
      ]}
    >
      <AlertCircleIcon size={ICON_SIZE.xl} color={colors.error} />
    </View>
    <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
      Something went wrong
    </ThemedText>
    <ThemedText
      style={[styles.errorMessage, { color: colors.textSecondary }]}
    >
      {message}
    </ThemedText>
    <Pressable
      style={[styles.retryButton, { backgroundColor: colors.primary }]}
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry loading data"
    >
      <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
    </Pressable>
  </Animated.View>
));
SupportErrorState.displayName = 'SupportErrorState';

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function HelpSupportScreen() {
  const { colors, statusBarStyle } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    FAQCategory | 'all'
  >('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [searchResults, setSearchResults] = useState<FAQItem[]>([]);
  const [contacts, setContacts] = useState<ContactMethod[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<
    { category: FAQCategory; count: number }[]
  >([]);

  // -------------------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------------------

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const [faqData, contactData, actionsData, tutorialData, categoryData] =
        await Promise.all([
          fetchFAQs(),
          fetchContactMethods(),
          fetchQuickActions(),
          fetchTutorials(),
          getFAQCategories(),
        ]);

      setFaqs(faqData);
      setContacts(contactData);
      setQuickActions(actionsData);
      setTutorials(tutorialData);
      setCategories(categoryData);
      setSelectedCategory('all');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load support data';
      setError(message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadData();
    });
    return () => task.cancel();
  }, [loadData]);

  // Search with debounce
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const results = await searchFAQs(searchQuery);
          setSearchResults(results);
        } catch {
          showToast({ message: 'Search failed. Try again.', type: 'error' });
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, showToast]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await loadData(true);
    setIsRefreshing(false);
  }, [loadData]);

  const handleTabChange = useCallback((tabId: TabType) => {
    setActiveTab(tabId);
  }, []);

  const handleCategoryChange = useCallback(
    (category: FAQCategory | 'all') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCategory(category);
    },
    [],
  );

  const handleFAQRate = useCallback(
    async (faqId: string, helpful: boolean) => {
      try {
        const result = await rateFAQ(faqId, helpful);
        showToast({ message: result.message, type: 'success' });
      } catch {
        showToast({ message: 'Failed to submit rating', type: 'error' });
      }
    },
    [showToast],
  );

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      switch (action.action) {
        case 'tutorials':
          setActiveTab('tutorials');
          break;
        case 'feedback':
          showToast({ message: 'Feedback form coming soon!', type: 'info' });
          break;
        case 'report_bug':
          showToast({ message: 'Bug report form coming soon!', type: 'info' });
          break;
        case 'payment_setup':
          router.push('/(tabs)/profile-new' as any);
          break;
        default:
          break;
      }
    },
    [showToast, router],
  );

  const handleTutorialPress = useCallback(
    async (tutorial: Tutorial) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (tutorial.videoUrl) {
        try {
          const canOpen = await Linking.canOpenURL(tutorial.videoUrl);
          if (canOpen) {
            await Linking.openURL(tutorial.videoUrl);
          } else {
            showToast({
              message: 'Unable to open tutorial link',
              type: 'error',
            });
          }
        } catch {
          showToast({ message: 'Failed to open tutorial', type: 'error' });
        }
      } else {
        showToast({ message: 'Tutorial video unavailable', type: 'info' });
      }
    },
    [showToast],
  );

  // -------------------------------------------------------------------------
  // Memoized Data
  // -------------------------------------------------------------------------

  const displayedFAQs = useMemo(() => {
    if (searchQuery.trim().length > 2) {
      return searchResults;
    }
    if (selectedCategory !== 'all') {
      return faqs.filter((faq) => faq.category === selectedCategory);
    }
    return faqs;
  }, [searchQuery, searchResults, faqs, selectedCategory]);

  // -------------------------------------------------------------------------
  // FAQ Tab — FlatList Components
  // -------------------------------------------------------------------------

  const renderFAQItem = useCallback(
    ({ item, index }: { item: FAQItem; index: number }) => {
      if (index < MAX_ANIMATED_INDEX) {
        return (
          <Animated.View
            entering={FadeIn.delay(index * 40).duration(300)}
          >
            <FAQItemComponent item={item} onRate={handleFAQRate} />
          </Animated.View>
        );
      }
      return <FAQItemComponent item={item} onRate={handleFAQRate} />;
    },
    [handleFAQRate],
  );

  const faqKeyExtractor = useCallback((item: FAQItem) => item.id, []);

  const FAQListHeader = useMemo(
    () => (
      <View>
        {/* Search */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search FAQs..."
          />
        </View>

        {/* Category Filter Chips (edge-to-edge) */}
        {searchQuery.trim().length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            <FilterChip
              filterId="all"
              label="All"
              count={categories.reduce((sum, cat) => sum + cat.count, 0)}
              isActive={selectedCategory === 'all'}
              colors={colors}
              onFilterPress={handleCategoryChange}
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat.category}
                filterId={cat.category}
                label={
                  cat.category.charAt(0).toUpperCase() +
                  cat.category.slice(1)
                }
                count={cat.count}
                isActive={selectedCategory === cat.category}
                colors={colors}
                onFilterPress={handleCategoryChange}
              />
            ))}
          </ScrollView>
        )}

        {/* Search result count */}
        {searchQuery.trim().length > 2 && !isSearching && (
          <ThemedText
            style={[styles.resultCount, { color: colors.textSecondary }]}
          >
            {displayedFAQs.length} result
            {displayedFAQs.length !== 1 ? 's' : ''} found
          </ThemedText>
        )}
      </View>
    ),
    [
      searchQuery,
      selectedCategory,
      categories,
      isSearching,
      displayedFAQs.length,
      colors,
      handleCategoryChange,
    ],
  );

  const FAQListEmpty = useMemo(() => {
    if (isLoading || isSearching) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <FAQSkeleton key={`faq_skel_${i}`} colors={colors} />
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <SupportErrorState
          message={error}
          onRetry={loadData}
          colors={colors}
        />
      );
    }
    return (
      <EmptyState
        type="search"
        title="No results found"
        description="Try different keywords or browse categories"
      />
    );
  }, [isLoading, isSearching, error, colors, loadData]);

  // -------------------------------------------------------------------------
  // Contact Tab Content
  // -------------------------------------------------------------------------

  const renderContactContent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <ContactSkeleton key={`contact_skel_${i}`} colors={colors} />
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <SupportErrorState
          message={error}
          onRetry={loadData}
          colors={colors}
        />
      );
    }
    return (
      <>
        {/* Emergency Card */}
        <Animated.View
          entering={FadeInDown.duration(ANIMATION.duration.normal)}
          style={[
            styles.emergencyCard,
            {
              backgroundColor: withAlpha(colors.error, 0.1),
              borderColor: withAlpha(colors.error, 0.2),
            },
          ]}
        >
          <View
            style={[
              styles.emergencyIcon,
              { backgroundColor: withAlpha(colors.error, 0.15) },
            ]}
          >
            <Headphones size={ICON_SIZE.md} color={colors.error} />
          </View>
          <View style={styles.emergencyContent}>
            <ThemedText
              style={[styles.emergencyTitle, { color: colors.error }]}
            >
              Need urgent help?
            </ThemedText>
            <ThemedText
              style={[
                styles.emergencyText,
                { color: colors.textSecondary },
              ]}
            >
              Our support team is available 24/7 for urgent matters
            </ThemedText>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </ThemedText>
        </View>
        {quickActions.map((action, index) => (
          <QuickActionCard
            key={action.id}
            action={action}
            index={index}
            onPress={handleQuickAction}
          />
        ))}

        {/* Contact Methods */}
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Contact Methods
          </ThemedText>
        </View>
        {contacts.map((contact, index) => (
          <ContactCard key={contact.id} contact={contact} index={index} />
        ))}
      </>
    );
  }, [
    isLoading,
    error,
    quickActions,
    contacts,
    colors,
    loadData,
    handleQuickAction,
  ]);

  // -------------------------------------------------------------------------
  // Tutorials Tab Content
  // -------------------------------------------------------------------------

  const renderTutorialsContent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <TutorialSkeleton key={`tutorial_skel_${i}`} colors={colors} />
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <SupportErrorState
          message={error}
          onRetry={loadData}
          colors={colors}
        />
      );
    }
    return (
      <>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Getting Started
          </ThemedText>
        </View>
        {tutorials.map((tutorial, index) => (
          <TutorialCard
            key={tutorial.id}
            tutorial={tutorial}
            index={index}
            onPress={handleTutorialPress}
          />
        ))}
      </>
    );
  }, [isLoading, error, tutorials, colors, loadData, handleTutorialPress]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ICON_SIZE.sm} color={colors.text} />
        </Pressable>

        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            Help & Support
          </ThemedText>
          <ThemedText
            style={[
              styles.headerSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            We&apos;re here to help
          </ThemedText>
        </View>

        <View style={styles.headerIcon}>
          <HelpCircle size={ICON_SIZE.md} color={colors.primary} />
        </View>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
        accessibilityRole="tablist"
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            isActive={activeTab === tab.id}
            colors={colors}
            onPress={handleTabChange}
          />
        ))}
      </View>

      {/* Content */}
      {activeTab === 'faq' ? (
        <FlatList
          data={displayedFAQs}
          renderItem={renderFAQItem}
          keyExtractor={faqKeyExtractor}
          ListHeaderComponent={FAQListHeader}
          ListEmptyComponent={FAQListEmpty}
          contentContainerStyle={[
            styles.scrollContent,
            displayedFAQs.length === 0 && styles.scrollContentGrow,
          ]}
          showsVerticalScrollIndicator={false}
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
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Animated.View
            key={activeTab}
            entering={FadeIn.duration(ANIMATION.duration.normal)}
          >
            {activeTab === 'contact'
              ? renderContactContent
              : renderTutorialsContent}
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Static Styles (color-dependent via inline overrides)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerIcon: {
    marginLeft: SPACING.sm,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.xxs,
  },
  tabText: {
    fontSize: 13,
    marginLeft: SPACING.xs,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  scrollContentGrow: {
    flexGrow: 1,
  },

  // Category filter (edge-to-edge)
  categoryScroll: {
    marginBottom: SPACING.md,
    marginHorizontal: -SPACING.md,
  },
  categoryScrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },

  // Filter chips
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chipBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Search
  searchContainer: {
    marginBottom: SPACING.md,
  },
  resultCount: {
    fontSize: 13,
    marginBottom: SPACING.sm,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Emergency card
  emergencyCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: SPACING.xxs,
  },
  emergencyText: {
    fontSize: 13,
  },

  // Skeletons
  skeletonList: {
    gap: SPACING.sm,
  },
  faqSkeletonCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  contactSkeletonCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tutorialSkeletonCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Error state
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: SPACING.xl,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
