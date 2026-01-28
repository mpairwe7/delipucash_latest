/**
 * Create Survey Screen
 * 
 * A comprehensive survey creation interface supporting both manual building
 * and JSON import. Follows WCAG 2.1 accessibility guidelines and Material Design
 * principles for optimal mobile and tablet experiences.
 * 
 * Requires authentication and active subscription to access.
 * 
 * @module app/create-survey
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  KeyboardAvoidingView,
  useWindowDimensions,
  AccessibilityInfo,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  FileJson,
  PenTool,
  Upload,
  CheckCircle,
  FileText,
  Code2,
  Lock,
  ShieldCheck,
} from 'lucide-react-native';
import SurveyForm from '../components/SurveyForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  ANIMATION,
  COMPONENT_SIZE,
  ICON_SIZE,
  BREAKPOINTS,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import { useAuth, useAuthModal } from '@/utils/auth';
import { useSurveySubscriptionStatus } from '@/services/surveyPaymentHooks';
import { UserRole } from '@/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TabKey = 'build' | 'import';

interface TabConfig {
  key: TabKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  accessibilityHint: string;
}

// ============================================================================
// RESPONSIVE HELPERS
// ============================================================================

/**
 * Hook for responsive values based on screen width
 * Follows mobile-first approach with breakpoints for tablet/desktop
 */
const useResponsive = () => {
  const { width } = useWindowDimensions();
  
  const isSmallPhone = width < BREAKPOINTS.md;
  const isPhone = width < BREAKPOINTS.xl;
  const isTablet = width >= BREAKPOINTS.xl;
  const isLargeTablet = width >= 1024;

  const getSize = useCallback((phone: number, tablet: number, large?: number): number => {
    if (isLargeTablet && large !== undefined) return large;
    if (isTablet) return tablet;
    return phone;
  }, [isTablet, isLargeTablet]);

  const getPadding = useCallback((): number => {
    if (isLargeTablet) return SPACING['2xl'];
    if (isTablet) return SPACING.xl;
    if (isSmallPhone) return SPACING.base;
    return SPACING.lg;
  }, [isSmallPhone, isTablet, isLargeTablet]);

  return {
    isSmallPhone,
    isPhone,
    isTablet,
    isLargeTablet,
    getSize,
    getPadding,
    screenWidth: width,
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CreateSurveyScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const responsive = useResponsive();

  // Auth & Subscription state
  const { isAuthenticated, isReady: authReady, auth } = useAuth();
  const { open: openAuth } = useAuthModal();
  const {
    data: subscriptionStatus,
    isLoading: loadingSubscription
  } = useSurveySubscriptionStatus();

  const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription ?? false;
  const remainingDays = subscriptionStatus?.remainingDays ?? 0;

  // Admin bypass - admins can create surveys without subscription
  const isAdmin = auth?.user?.role === UserRole.ADMIN || auth?.user?.role === UserRole.MODERATOR;

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('build');
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Check for reduced motion preference (accessibility)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion
    );
    return () => subscription.remove();
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      Alert.alert(
        "Login Required",
        "You need to sign in to create surveys.",
        [
          {
            text: "Go Back",
            onPress: () => router.back(),
            style: "cancel",
          },
          {
            text: "Sign In",
            onPress: () => {
              router.back();
              setTimeout(() => openAuth({ mode: "signin" }), 300);
            },
          },
        ]
      );
    }
  }, [authReady, isAuthenticated, router, openAuth]);

  // Check subscription status (admins bypass this check)
  useEffect(() => {
    if (authReady && isAuthenticated && !loadingSubscription && !isAdmin && !hasActiveSubscription) {
      Alert.alert(
        "Subscription Required",
        "You need an active subscription to create surveys. Subscribe now to unlock survey creation.",
        [
          {
            text: "Go Back",
            onPress: () => router.back(),
            style: "cancel",
          },
          {
            text: "Subscribe",
            onPress: () => router.replace("/survey-payment" as Href),
            style: "default",
          },
        ]
      );
    }
  }, [authReady, isAuthenticated, loadingSubscription, isAdmin, hasActiveSubscription, router]);

  // Entrance animation
  useEffect(() => {
    const duration = isReducedMotion ? 0 : ANIMATION.duration.slow;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, isReducedMotion]);

  // Handlers
  const handleSuccess = useCallback(() => {
    router.back();
  }, [router]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      key: 'build',
      label: 'Build Survey',
      description: responsive.isPhone ? 'Design manually' : 'Design with live preview',
      icon: <PenTool size={ICON_SIZE.base} color={activeTab === 'build' ? colors.primaryText : colors.textSecondary} />,
      accessibilityHint: 'Create a survey by adding questions manually',
    },
    {
      key: 'import',
      label: 'Import JSON',
      description: responsive.isPhone ? 'Upload file' : 'Upload a ready-made form',
      icon: <FileJson size={ICON_SIZE.base} color={activeTab === 'import' ? colors.primaryText : colors.textSecondary} />,
      accessibilityHint: 'Import a survey from a JSON file',
    },
  ];

  // Computed styles
  const horizontalPadding = responsive.getPadding();
  const headerHeight = responsive.getSize(
    COMPONENT_SIZE.header.compact,
    COMPONENT_SIZE.header.standard,
    COMPONENT_SIZE.header.standard
  );

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingHorizontal: horizontalPadding,
          paddingTop: insets.top + SPACING.sm,
          minHeight: headerHeight + insets.top,
        },
      ]}
      accessibilityRole="header"
    >
      <View style={styles.headerContent}>
        {/* Back button placeholder for centering */}
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={handleCancel}
            style={[
              styles.closeButton,
              {
                backgroundColor: withAlpha(colors.text, 0.08),
                minWidth: COMPONENT_SIZE.touchTarget,
                minHeight: COMPONENT_SIZE.touchTarget,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint="Go back to the previous screen"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={ICON_SIZE.lg} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.headerTitle,
            {
              color: colors.text,
              fontSize: responsive.getSize(
                TYPOGRAPHY.fontSize.xl,
                TYPOGRAPHY.fontSize['2xl'],
                TYPOGRAPHY.fontSize['2xl']
              ),
            },
          ]}
          accessibilityRole="header"
          numberOfLines={1}
        >
          Create Survey
        </Text>

        {/* Right side placeholder for symmetry */}
        <View style={styles.headerSide} />
      </View>

      {/* Subscription Status Badge */}
      {hasActiveSubscription && (
        <View style={[
          styles.subscriptionBadge,
          {
            backgroundColor: withAlpha(colors.success, 0.1),
            borderColor: withAlpha(colors.success, 0.2),
          }
        ]}>
          <ShieldCheck size={14} color={colors.success} strokeWidth={2} />
          <Text style={[styles.subscriptionBadgeText, { color: colors.success }]}>
            {remainingDays} days remaining
          </Text>
        </View>
      )}
    </View>
  );

  /**
   * Render loading state while checking auth/subscription
   */
  const renderLoadingState = () => (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.textMuted }]}>
        Checking your subscription...
      </Text>
    </View>
  );

  /**
   * Render access denied state
   */
  const renderAccessDenied = () => (
    <View style={[styles.accessDeniedContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.accessDeniedIcon, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
        <Lock size={48} color={colors.warning} strokeWidth={1.5} />
      </View>
      <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
        Subscription Required
      </Text>
      <Text style={[styles.accessDeniedSubtitle, { color: colors.textMuted }]}>
        You need an active subscription to create surveys. Subscribe now to unlock this feature.
      </Text>
      <View style={styles.accessDeniedActions}>
        <PrimaryButton
          title="Subscribe Now"
          onPress={() => router.replace("/survey-payment" as Href)}
          variant="primary"
          size="large"
          style={{ marginBottom: SPACING.md }}
        />
        <PrimaryButton
          title="Go Back"
          onPress={() => router.back()}
          variant="ghost"
          size="medium"
        />
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingHorizontal: horizontalPadding,
          marginTop: SPACING.base,
          marginBottom: SPACING.md,
        },
      ]}
      accessibilityRole="tablist"
      accessibilityLabel="Survey creation methods"
    >
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
          },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive ? colors.primary : 'transparent',
                },
              ]}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              accessibilityHint={tab.accessibilityHint}
            >
              <View style={styles.tabContent}>
                <View style={styles.tabLabelRow}>
                  {tab.icon}
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isActive ? colors.primaryText : colors.text,
                        fontSize: responsive.getSize(
                          TYPOGRAPHY.fontSize.sm,
                          TYPOGRAPHY.fontSize.base,
                          TYPOGRAPHY.fontSize.base
                        ),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tabDescription,
                    {
                      color: isActive
                        ? withAlpha(colors.primaryText, 0.8)
                        : colors.textMuted,
                      fontSize: responsive.getSize(
                        TYPOGRAPHY.fontSize.xs,
                        TYPOGRAPHY.fontSize.sm,
                        TYPOGRAPHY.fontSize.sm
                      ),
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderImportHelper = () => (
    <View
      style={[
        styles.helperBanner,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
      accessible
      accessibilityLabel="JSON import instructions"
    >
      {/* Header with icon */}
      <View style={styles.helperHeader}>
        <View style={[styles.helperIconBg, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
          <Upload size={24} color={colors.primary} />
        </View>
        <View style={styles.helperHeaderText}>
          <Text style={[styles.helperTitle, { color: colors.text }]}>
            Import from JSON
          </Text>
          <Text style={[styles.helperSubtitle, { color: colors.textSecondary }]}>
            Upload a pre-made survey file
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        Your JSON file will be validated and automatically populate the form fields. 
        Click the &quot;Choose File&quot; button below to get started.
      </Text>

      {/* Feature cards */}
      <View style={styles.featureGrid}>
        {[
          { icon: <FileText size={18} color={colors.success} />, title: 'Title & Description', desc: 'Auto-filled from JSON' },
          { icon: <CheckCircle size={18} color={colors.info} />, title: 'Questions', desc: 'All types supported' },
          { icon: <Code2 size={18} color={colors.warning} />, title: 'Validation', desc: 'Instant error feedback' },
        ].map((feature, index) => (
          <View
            key={index}
            style={[
              styles.featureCard,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.featureIconBg, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
              {feature.icon}
            </View>
            <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
            <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{feature.desc}</Text>
          </View>
        ))}
      </View>

      {/* Supported formats */}
      <View style={[styles.formatInfo, { backgroundColor: withAlpha(colors.info, 0.08), borderColor: withAlpha(colors.info, 0.15) }]}>
        <Text style={[styles.formatTitle, { color: colors.info }]}>Supported Question Types</Text>
        <View style={styles.formatTags}>
          {['text', 'radio', 'checkbox', 'rating'].map((type) => (
            <View key={type} style={[styles.formatTag, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.formatTagText, { color: colors.text }]}>{type}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderContent = () => (
    <Animated.View
      style={[
        styles.contentContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: insets.bottom + SPACING['4xl'],
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Survey creation form"
      >
        {renderTabBar()}

        <View
          style={[
            styles.formCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...SHADOWS.md,
            },
          ]}
        >
          {activeTab === 'import' && renderImportHelper()}
          
          <SurveyForm
            key={activeTab}
            startWithImport={activeTab === 'import'}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Show loading state while checking auth/subscription
  if (!authReady || loadingSubscription) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['left', 'right']}
      >
        <StatusBar style={statusBarStyle} />
        {renderHeader()}
        {renderLoadingState()}
      </SafeAreaView>
    );
  }

  // Show access denied if not authenticated
  if (!isAuthenticated) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['left', 'right']}
      >
        <StatusBar style={statusBarStyle} />
        {renderHeader()}
        {renderAccessDenied()}
      </SafeAreaView>
    );
  }

  // Show access denied if no subscription
  if (!hasActiveSubscription) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['left', 'right']}
      >
        <StatusBar style={statusBarStyle} />
        {renderHeader()}
        {renderAccessDenied()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}
    >
      <StatusBar style={statusBarStyle} />

      {renderHeader()}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {renderContent()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    borderBottomWidth: BORDER_WIDTH.thin,
    ...SHADOWS.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
  },
  headerSide: {
    width: COMPONENT_SIZE.touchTarget,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  closeButton: {
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Bar
  tabBarContainer: {
    width: '100%',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: RADIUS.base,
    padding: SPACING.xs,
    gap: SPACING.xs,
    borderWidth: BORDER_WIDTH.thin,
  },
  tabItem: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: COMPONENT_SIZE.touchTarget,
    justifyContent: 'center',
  },
  tabContent: {
    gap: SPACING.xxs,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tabLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  tabDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginLeft: ICON_SIZE.base + SPACING.sm,
  },

  // Content
  keyboardView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formCard: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    overflow: 'hidden',
  },

  // Helper Banner - Improved
  helperBanner: {
    padding: SPACING.lg,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  helperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  helperIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperHeaderText: {
    flex: 1,
  },
  helperTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xxs,
  },
  helperSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  helperText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
    marginBottom: SPACING.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  featureIconBg: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  featureTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs - 1,
    textAlign: 'center',
  },
  formatInfo: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  formatTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.sm,
  },
  formatTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  formatTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  formatTagText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Subscription Badge in Header
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  subscriptionBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['2xl'],
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },

  // Access Denied State
  accessDeniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['2xl'],
  },
  accessDeniedIcon: {
    width: 96,
    height: 96,
    borderRadius: RADIUS['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  accessDeniedTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  accessDeniedSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
    marginBottom: SPACING.xl,
  },
  accessDeniedActions: {
    width: '100%',
    maxWidth: 280,
  },
});

export default CreateSurveyScreen;