/**
 * Help & Support Screen
 * Comprehensive help center with FAQ, contact methods, and tutorials
 * Design System Compliant - Uses theme tokens and reusable components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  HelpCircle,
  MessageSquare,
  Book,
  Headphones,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SearchBar, FAQItemComponent, ContactCard, QuickActionCard, TutorialCard } from '@/components/support';
import { EmptyState } from '@/components/notifications';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';

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

type TabType = 'faq' | 'contact' | 'tutorials';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HelpSupportScreen() {
  const { colors, statusBarStyle } = useTheme();
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Data
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [searchResults, setSearchResults] = useState<FAQItem[]>([]);
  const [contacts, setContacts] = useState<ContactMethod[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<{ category: FAQCategory; count: number }[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [faqData, contactData, actionsData, tutorialData, categoryData] = await Promise.all([
        fetchFAQs(selectedCategory === 'all' ? undefined : selectedCategory),
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
    } catch (error) {
      console.error('Failed to load support data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle search
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const results = await searchFAQs(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleCategoryChange = useCallback(async (category: FAQCategory | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
    
    try {
      const faqData = await fetchFAQs(category === 'all' ? undefined : category);
      setFaqs(faqData);
    } catch (error) {
      console.error('Failed to filter FAQs:', error);
    }
  }, []);

  const handleFAQRate = useCallback(async (faqId: string, helpful: boolean) => {
    try {
      await rateFAQ(faqId, helpful);
    } catch (error) {
      console.error('Failed to rate FAQ:', error);
    }
  }, []);

  const handleQuickAction = useCallback((action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Handle action based on action.action field
    console.log('Quick action pressed:', action.action);
  }, []);

  const handleContactPress = useCallback((contact: ContactMethod) => {
    // Handled by ContactCard component
  }, []);

  const handleTutorialPress = useCallback((tutorial: Tutorial) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (tutorial.videoUrl) {
      Linking.openURL(tutorial.videoUrl);
    }
  }, []);

  // Memoized filtered data
  const displayedFAQs = useMemo(() => {
    if (searchQuery.trim().length > 2) {
      return searchResults;
    }
    return faqs;
  }, [searchQuery, searchResults, faqs]);

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
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
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerIcon: {
      marginLeft: SPACING.sm,
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    tabActive: {
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    tabText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: SPACING.xs,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: SPACING.md,
    },
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
      color: colors.text,
    },
    sectionAction: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },
    searchContainer: {
      marginBottom: SPACING.md,
    },
    categoryScroll: {
      marginBottom: SPACING.md,
    },
    categoryChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SPACING.xs,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    tutorialsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    tutorialItem: {
      width: '48%',
      marginBottom: SPACING.sm,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActionsContainer: {
      marginBottom: SPACING.lg,
    },
    emergencyCard: {
      backgroundColor: withAlpha(colors.error, 0.1),
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.error, 0.2),
      flexDirection: 'row',
      alignItems: 'center',
    },
    emergencyIcon: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: withAlpha(colors.error, 0.15),
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
      color: colors.error,
      marginBottom: SPACING.xxs,
    },
    emergencyText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'faq', label: 'FAQs', icon: HelpCircle },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
    { id: 'tutorials', label: 'Tutorials', icon: Book },
  ];

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    switch (activeTab) {
      case 'faq':
        return renderFAQContent();
      case 'contact':
        return renderContactContent();
      case 'tutorials':
        return renderTutorialsContent();
      default:
        return null;
    }
  };

  const renderFAQContent = () => (
    <>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search FAQs..."
        />
      </View>

      {searchQuery.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          <Pressable
            style={[
              styles.categoryChip,
              selectedCategory === 'all' && styles.categoryChipActive,
            ]}
            onPress={() => handleCategoryChange('all')}
          >
            <ThemedText
              style={[
                styles.categoryChipText,
                selectedCategory === 'all' && styles.categoryChipTextActive,
              ]}
            >
              All
            </ThemedText>
          </Pressable>
          {categories.map(cat => (
            <Pressable
              key={cat.category}
              style={[
                styles.categoryChip,
                selectedCategory === cat.category && styles.categoryChipActive,
              ]}
              onPress={() => handleCategoryChange(cat.category)}
            >
              <ThemedText
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.category && styles.categoryChipTextActive,
                ]}
              >
                {cat.category}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {isSearching ? (
        <View style={{ padding: SPACING.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : displayedFAQs.length === 0 ? (
        <EmptyState
          type="search"
          title="No results found"
          description="Try different keywords or browse categories"
        />
      ) : (
        displayedFAQs.map((faq, index) => (
          <FAQItemComponent
            key={faq.id}
            item={faq}
            onRate={handleFAQRate}
          />
        ))
      )}
    </>
  );

  const renderContactContent = () => (
    <>
      <Animated.View 
        entering={FadeInDown.duration(ANIMATION.duration.normal)}
        style={styles.emergencyCard}
      >
        <View style={styles.emergencyIcon}>
          <Headphones size={ICON_SIZE.md} color={colors.error} />
        </View>
        <View style={styles.emergencyContent}>
          <ThemedText style={styles.emergencyTitle}>Need urgent help?</ThemedText>
          <ThemedText style={styles.emergencyText}>
            Our support team is available 24/7 for urgent matters
          </ThemedText>
        </View>
      </Animated.View>

      <View style={styles.quickActionsContainer}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
        </View>
        {quickActions.map((action, index) => (
          <QuickActionCard
            key={action.id}
            action={action}
            index={index}
            onPress={handleQuickAction}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Contact Methods</ThemedText>
      </View>
      {contacts.map((contact, index) => (
        <ContactCard
          key={contact.type}
          contact={contact}
          index={index}
          onPress={handleContactPress}
        />
      ))}
    </>
  );

  const renderTutorialsContent = () => (
    <>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Getting Started</ThemedText>
        <Pressable>
          <ThemedText style={styles.sectionAction}>View All</ThemedText>
        </Pressable>
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style={statusBarStyle} />
      
      {/* Header */}
      <Animated.View 
        entering={FadeIn.duration(ANIMATION.duration.normal)}
        style={styles.header}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={ICON_SIZE.sm} color={colors.text} />
        </Pressable>
        
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Help & Support</ThemedText>
          <ThemedText style={styles.headerSubtitle}>We&apos;re here to help</ThemedText>
        </View>
        
        <View style={styles.headerIcon}>
          <HelpCircle size={ICON_SIZE.md} color={colors.primary} />
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Pressable
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
            >
              <Icon
                size={ICON_SIZE.sm}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <ThemedText style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
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
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}
