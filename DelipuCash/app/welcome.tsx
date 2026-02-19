/**
 * Post-Signup Welcome & Onboarding Screen - 2026 Industry Standard
 *
 * Follows best practices from Cash App, Duolingo, and TikTok:
 * - Personalized greeting with user's first name
 * - 3-step swipable onboarding cards (earning pathways)
 * - Push notification permission prompt (deferred, non-blocking)
 * - Celebration animation + haptic feedback
 * - Prefetches home data while user is reading
 * - WCAG 2.2 AA accessible (screen reader, reduced motion, touch targets)
 *
 * Navigation: signup → welcome → (tabs)/home-redesigned
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Dimensions,
  FlatList,
  ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { useStatusBar } from '@/hooks/useStatusBar';
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  HelpCircle,
  PartyPopper,
  Sparkles,
  Video,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/utils/auth";
import { useReducedMotion } from "@/utils/accessibility";
import { triggerHaptic } from "@/utils/quiz-utils";
import { usePushNotifications } from "@/utils/usePushNotifications";
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  useTheme,
} from "@/utils/theme";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingStep {
  id: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  title: string;
  description: string;
  accessibilityLabel: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "questions",
    icon: HelpCircle,
    iconColor: "#6C63FF",
    title: "Answer & Earn",
    description:
      "Answer community questions and earn 10–50 points per response. The more detailed your answers, the more you earn.",
    accessibilityLabel:
      "Step 1: Answer questions to earn 10 to 50 points each",
  },
  {
    id: "videos",
    icon: Video,
    iconColor: "#FF6B6B",
    title: "Watch & Earn",
    description:
      "Watch short videos and ads to collect instant rewards. New content drops daily — never miss a payout.",
    accessibilityLabel:
      "Step 2: Watch videos and ads for instant rewards",
  },
  {
    id: "surveys",
    icon: ClipboardCheck,
    iconColor: "#4ECDC4",
    title: "Survey & Cash Out",
    description:
      "Complete quick surveys from real brands. Higher payouts, real impact — your opinion matters.",
    accessibilityLabel:
      "Step 3: Complete surveys for higher cash payouts",
  },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Celebration header with personalized greeting */
const CelebrationHeader = React.memo(function CelebrationHeader({
  firstName,
  colors,
  reduceMotion,
}: {
  firstName: string;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const confettiScale = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      confettiScale.value = 1;
      return;
    }
    confettiScale.value = withDelay(
      200,
      withSpring(1, { damping: 8, stiffness: 120 })
    );
  }, [confettiScale, reduceMotion]);

  const confettiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confettiScale.value }],
    opacity: interpolate(confettiScale.value, [0, 0.5, 1], [0, 0.8, 1]),
  }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(100).springify().damping(14)}
      style={styles.celebrationHeader}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Welcome ${firstName}! Your account is ready.`}
    >
      <Animated.View style={[styles.confettiIcon, confettiStyle]}>
        <PartyPopper size={48} color="#FFD700" strokeWidth={1.5} />
      </Animated.View>

      <Text
        style={styles.welcomeTitle}
        allowFontScaling
        maxFontSizeMultiplier={1.3}
      >
        Welcome, {firstName}! 🎉
      </Text>
      <Text
        style={styles.welcomeSubtitle}
        allowFontScaling
        maxFontSizeMultiplier={1.2}
      >
        Your account is ready. Here&apos;s how to start earning.
      </Text>
    </Animated.View>
  );
});

/** Onboarding step card */
const StepCard = React.memo(function StepCard({
  step,
  index,
  isActive,
  colors,
  reduceMotion,
}: {
  step: OnboardingStep;
  index: number;
  isActive: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const Icon = step.icon;

  return (
    <View style={[styles.stepCardWrapper, { width: SCREEN_WIDTH - SPACING.xl * 2 }]}>
      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeInDown.delay(400 + index * 120)
                .springify()
                .damping(14)
        }
        style={[
          styles.stepCard,
          {
            backgroundColor: withAlpha(step.iconColor, 0.08),
            borderColor: withAlpha(step.iconColor, isActive ? 0.3 : 0.12),
          },
        ]}
        accessible
        accessibilityLabel={step.accessibilityLabel}
        accessibilityRole="text"
      >
        <View
          style={[
            styles.stepIconContainer,
            { backgroundColor: withAlpha(step.iconColor, 0.15) },
          ]}
        >
          <Icon size={28} color={step.iconColor} strokeWidth={2} />
        </View>

        <View style={styles.stepNumber}>
          <Text style={[styles.stepNumberText, { color: step.iconColor }]}>
            {index + 1}
          </Text>
        </View>

        <Text
          style={styles.stepTitle}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {step.title}
        </Text>
        <Text
          style={styles.stepDescription}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          {step.description}
        </Text>
      </Animated.View>
    </View>
  );
});

/** Page indicator dots */
const PageIndicator = React.memo(function PageIndicator({
  totalSteps,
  activeIndex,
  colors,
}: {
  totalSteps: number;
  activeIndex: number;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View
      style={styles.pageIndicator}
      accessible
      accessibilityLabel={`Step ${activeIndex + 1} of ${totalSteps}`}
      accessibilityRole="adjustable"
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex
              ? [styles.dotActive, { backgroundColor: colors.primary }]
              : { backgroundColor: "rgba(255,255,255,0.25)" },
          ]}
        />
      ))}
    </View>
  );
});

/** Push notification CTA */
const NotificationCTA = React.memo(function NotificationCTA({
  onEnable,
  colors,
  reduceMotion,
}: {
  onEnable: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.delay(800).duration(400)}
      style={styles.notificationCTA}
      accessible
      accessibilityLabel="Enable push notifications to never miss a reward"
      accessibilityRole="none"
    >
      <Bell size={18} color="#FFD700" strokeWidth={2} />
      <Text style={styles.notificationText}>
        Enable notifications so you never miss a reward
      </Text>
      <Pressable
        onPress={onEnable}
        style={[styles.enableButton, { backgroundColor: withAlpha(colors.primary, 0.2) }]}
        accessibilityRole="button"
        accessibilityLabel="Enable notifications"
        hitSlop={12}
      >
        <Text style={[styles.enableButtonText, { color: colors.primary }]}>Enable</Text>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WelcomeScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  // Force light status bar icons — dark gradient background (#1a1a2e)
  useStatusBar({ style: 'light' });

  const { auth, isAuthenticated } = useAuth();
  const { requestPermissions, hasPermission } = usePushNotifications();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(0);
  const [notificationsHandled, setNotificationsHandled] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const firstName = auth?.user?.firstName || "there";

  // Fire celebration haptic on mount
  useEffect(() => {
    triggerHaptic("success");
    AccessibilityInfo.announceForAccessibility(
      `Welcome ${firstName}! Your account has been created. Swipe through the steps to learn how to earn.`
    );
  }, [firstName]);

  // Prefetch critical home screen data while user reads onboarding
  useEffect(() => {
    // Prefetch user stats and initial question/video data
    const prefetch = async () => {
      try {
        await Promise.allSettled([
          queryClient.prefetchQuery({
            queryKey: ["user", "stats"],
            staleTime: 1000 * 60 * 5,
          }),
          queryClient.prefetchQuery({
            queryKey: ["user", "profile"],
            staleTime: 1000 * 60 * 5,
          }),
        ]);
      } catch {
        // Non-critical — home screen will fetch on mount anyway
      }
    };
    prefetch();
  }, [queryClient]);

  // Redirect unauthenticated users (safety net)
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/signup");
    }
  }, [isAuthenticated]);

  const handleEnableNotifications = useCallback(async () => {
    triggerHaptic("light");
    try {
      await requestPermissions();
      setNotificationsHandled(true);
    } catch {
      // Permission denied or unavailable — continue silently
      setNotificationsHandled(true);
    }
  }, [requestPermissions]);

  const handleStartEarning = useCallback(() => {
    triggerHaptic("medium");
    router.replace("/(tabs)/home-redesigned");
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveStep(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    []
  );

  const renderStep: ListRenderItem<OnboardingStep> = useCallback(
    ({ item, index }) => (
      <StepCard
        step={item}
        index={index}
        isActive={index === activeStep}
        colors={colors}
        reduceMotion={reduceMotion}
      />
    ),
    [activeStep, colors, reduceMotion]
  );

  const keyExtractor = useCallback((item: OnboardingStep) => item.id, []);

  return (
    <View style={styles.container}>

      {/* Gradient background matching splash */}
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.xl,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
        {/* Celebration Header */}
        <CelebrationHeader
          firstName={firstName}
          colors={colors}
          reduceMotion={reduceMotion}
        />

        {/* Onboarding Steps Carousel */}
        <View style={styles.carouselSection}>
          <FlatList
            ref={flatListRef}
            data={ONBOARDING_STEPS}
            renderItem={renderStep}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_data, index) => ({
              length: SCREEN_WIDTH - SPACING.xl * 2,
              offset: (SCREEN_WIDTH - SPACING.xl * 2) * index,
              index,
            })}
          />
          <PageIndicator
            totalSteps={ONBOARDING_STEPS.length}
            activeIndex={activeStep}
            colors={colors}
          />
        </View>

        {/* Push Notification CTA */}
        {!hasPermission && !notificationsHandled && Platform.OS !== "web" && (
          <NotificationCTA
            onEnable={handleEnableNotifications}
            colors={colors}
            reduceMotion={reduceMotion}
          />
        )}

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA Button */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.delay(1000).springify().damping(12)}
          style={styles.ctaSection}
        >
          <Pressable
            onPress={handleStartEarning}
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Start Earning"
            accessibilityHint="Navigate to the home screen and begin earning rewards"
          >
            <Sparkles size={18} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text
              style={styles.startButtonText}
              allowFontScaling
              maxFontSizeMultiplier={1.2}
            >
              Start Earning
            </Text>
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 4 }} />
          </Pressable>

          {/* Skip for returning users */}
          <Pressable
            onPress={handleStartEarning}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  // Celebration Header
  celebrationHeader: {
    alignItems: "center",
    marginBottom: SPACING["2xl"],
  },
  confettiIcon: {
    marginBottom: SPACING.md,
  },
  welcomeTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  // Carousel
  carouselSection: {
    flex: 1,
    justifyContent: "center",
  },
  carouselContent: {
    alignItems: "center",
  },
  stepCardWrapper: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  stepCard: {
    width: "100%",
    borderRadius: RADIUS["2xl"],
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: "center",
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  stepNumber: {
    position: "absolute",
    top: SPACING.base,
    right: SPACING.base,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  stepDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  // Page Indicator
  pageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
  },
  // Notification CTA
  notificationCTA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  notificationText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "rgba(255,255,255,0.7)",
  },
  enableButton: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  enableButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // CTA Section
  spacer: {
    flex: 0,
    minHeight: SPACING.lg,
  },
  ctaSection: {
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 56,
    borderRadius: RADIUS["2xl"],
    paddingHorizontal: SPACING.xl,
  },
  startButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: "#FFFFFF",
  },
  skipButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  skipText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
  },
});
