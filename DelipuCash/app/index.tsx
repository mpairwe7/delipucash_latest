import { useReducedMotion } from "@/utils/accessibility";
import { useAuth } from "@/utils/auth";
import { triggerHaptic } from "@/utils/quiz-utils";
import { RADIUS, SPACING, TYPOGRAPHY, useTheme, withAlpha } from "@/utils/theme";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
    StyleSheet,
  Text,
    View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  HelpCircle,
  ClipboardCheck,
  Coins,
  ChevronRight,
  Sparkles,
} from "lucide-react-native";

// ============================================================================
// TYPES
// ============================================================================

interface FeatureItem {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  description: string;
  color: string;
  accessibilityLabel: string;
}

// ============================================================================
// CONSTANTS - Feature Teasers
// ============================================================================

const FEATURES: FeatureItem[] = [
  {
    icon: HelpCircle,
    title: "Answer Questions",
    description: "Earn 10-50 pts each",
    color: "#6C63FF",
    accessibilityLabel: "Answer questions and earn 10 to 50 points each",
  },
  {
    icon: ClipboardCheck,
    title: "Take Surveys",
    description: "Quick cash rewards",
    color: "#4ECDC4",
    accessibilityLabel: "Complete surveys for quick cash rewards",
  },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Animated Logo with spring bounce and glow effect */
const AnimatedLogo = React.memo(function AnimatedLogo({
  colors,
  reduceMotion,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      glowOpacity.value = 0.25;
      return;
    }
    // Entrance animation
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Subtle pulsing glow
    glowOpacity.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [scale, opacity, glowOpacity, reduceMotion]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View
      style={styles.logoSection}
      accessible
      accessibilityRole="image"
      accessibilityLabel="DelipuCash logo - Your earning companion"
    >
      {/* Ambient glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.logoGlow,
          { backgroundColor: colors.primary },
          glowStyle,
        ]}
      />

      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <View style={[styles.logoContainer, { borderColor: withAlpha(colors.primary, 0.3) }]}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logo}
            contentFit="contain"
            transition={200}
            placeholder={require("../assets/images/logo.png")}
            cachePolicy="memory-disk"
          />
        </View>
      </Animated.View>
    </View>
  );
});

/** Feature teaser card with icon and text */
const FeatureCard = React.memo(function FeatureCard({
  feature,
  index,
  colors,
  reduceMotion,
}: {
  feature: FeatureItem;
  index: number;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const Icon = feature.icon;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(600 + index * 100).springify().damping(15)}
      style={[
        styles.featureCard,
        { backgroundColor: withAlpha(feature.color, 0.12) },
      ]}
      accessible
      accessibilityLabel={feature.accessibilityLabel}
      accessibilityRole="text"
    >
      <View style={[styles.featureIconContainer, { backgroundColor: withAlpha(feature.color, 0.2) }]}>
        <Icon size={20} color={feature.color} strokeWidth={2} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text
          style={[styles.featureTitle, { color: "#FFFFFF" }]}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {feature.title}
        </Text>
        <Text
          style={[styles.featureDescription, { color: "rgba(255,255,255,0.6)" }]}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          {feature.description}
        </Text>
      </View>
    </Animated.View>
  );
});

/** Primary CTA Button with scale feedback */
const PrimaryCTAButton = React.memo(function PrimaryCTAButton({
  onPress,
  colors,
  reduceMotion,
}: {
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(1);
  const shimmerPosition = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // Subtle shimmer effect
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, [shimmerPosition, reduceMotion]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);

  const handlePress = useCallback(() => {
    triggerHaptic('medium');
    onPress();
  }, [onPress]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(900).springify().damping(12)}
    >
      <Animated.View style={buttonStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Get Started Free"
          accessibilityHint="Create a free account and start earning rewards immediately"
        >
          <Sparkles size={18} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 8 }} />
          <Text
            style={styles.primaryButtonText}
            allowFontScaling
            maxFontSizeMultiplier={1.2}
          >
            Get Started — Free
          </Text>
          <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 4 }} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

/** Secondary Sign In link */
const SecondarySignIn = React.memo(function SecondarySignIn({
  onPress,
  colors,
  reduceMotion,
}: {
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  reduceMotion: boolean;
}) {
  const handlePress = useCallback(() => {
    triggerHaptic('light');
    onPress();
  }, [onPress]);

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(1000).duration(400)}>
      <Pressable
        onPress={handlePress}
        style={styles.secondaryButton}
        accessibilityRole="button"
        accessibilityLabel="Sign In to existing account"
        accessibilityHint="Navigate to login screen if you already have an account"
      >
        <Text
          style={styles.secondaryButtonText}
          allowFontScaling
          maxFontSizeMultiplier={1.2}
        >
          Already have an account?{" "}
          <Text style={[styles.secondaryButtonAccent, { color: colors.primary }]}>
            Sign In
          </Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Premium Splash Screen - 2025/2026 Industry Standard
 * 
 * Design Principles:
 * - Clear value proposition: "Earn real rewards"
 * - Visual hierarchy: Logo → Headline → Features → CTAs
 * - Accessibility: Full VoiceOver/TalkBack support, dynamic type
 * - Performance: Optimized animations, cached images
 * - Engagement: Feature teasers show earning opportunities
 * 
 * Inspired by: TikTok (energy), Cash App (simplicity), Duolingo (motivation)
 */
export default function SplashScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { isReady: authReady, isAuthenticated } = useAuth();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = Boolean(rootNavigationState?.key);

  // Track onboarding status for authenticated redirect destination
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  // All hooks MUST be called before any conditional return (Rules of Hooks)
  const handleGetStarted = useCallback((): void => {
    if (!navigationReady) return;
    router.push("/(auth)/signup");
  }, [navigationReady]);

  const handleSignIn = useCallback((): void => {
    if (!navigationReady) return;
    router.push("/(auth)/login");
  }, [navigationReady]);

  // Announce screen purpose for screen readers
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      "Welcome to DelipuCash. Earn real money by answering questions, watching videos, and completing surveys. Press Get Started to begin."
    );
  }, []);

  // Check onboarding status when user is authenticated so we redirect
  // to the correct destination (welcome vs home) without flashing
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    let cancelled = false;
    AsyncStorage.getItem('hasCompletedOnboarding').then((value) => {
      if (!cancelled) {
        setHasOnboarded(!!value);
        setOnboardingChecked(true);
      }
    });
    return () => { cancelled = true; };
  }, [authReady, isAuthenticated]);

  // Skip landing for users with a valid persisted session
  // Wait for onboarding check so we route to the correct screen
  if (authReady && isAuthenticated && navigationReady && onboardingChecked) {
    if (!hasOnboarded) {
      return <Redirect href="/welcome" />;
    }
    return <Redirect href="/(tabs)/home-redesigned" />;
  }

  return (
    <View style={styles.container} accessible accessibilityRole="none">
      <StatusBar style="light" />

      {/* Gradient Background */}
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Main Content */}
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.xl,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
        {/* Hero Section: Logo */}
        <AnimatedLogo colors={colors} reduceMotion={reduceMotion} />

        {/* Headline Section */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(300).springify().damping(15)}
          style={styles.headlineSection}
        >
          <View style={styles.earningBadge}>
            <Coins size={14} color="#FFD700" strokeWidth={2} />
            <Text style={styles.earningBadgeText}>Start Earning Today</Text>
          </View>

          <Text
            style={styles.headline}
            accessible
            accessibilityRole="header"
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            Earn Real Cash{"\n"}
            <Text style={[styles.headlineAccent, { color: colors.primary }]}>
              Answering & Watching
            </Text>
          </Text>

          <Text
            style={styles.subheadline}
            allowFontScaling
            maxFontSizeMultiplier={1.2}
          >
            Join thousands earning daily rewards.{"\n"}Questions • Videos • Surveys
          </Text>
        </Animated.View>

        {/* Feature Teasers */}
        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={index}
              colors={colors}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <PrimaryCTAButton onPress={handleGetStarted} colors={colors} reduceMotion={reduceMotion} />
          <SecondarySignIn onPress={handleSignIn} colors={colors} reduceMotion={reduceMotion} />

          {/* Trust indicator */}
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.delay(1100).duration(400)}
            style={styles.trustIndicator}
          >
            <Text style={styles.trustText}>
              🇺🇬 Trusted by 10,000+ users in Uganda
            </Text>
          </Animated.View>
        </View>
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
    backgroundColor: "#0f0f23",
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },

  // Logo Section
  logoSection: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  logoGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    transform: [{ scale: 2 }],
  },
  logoWrapper: {
    zIndex: 1,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 48,
    height: 48,
  },

  // Headline Section
  headlineSection: {
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  earningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  earningBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: "#FFD700",
    letterSpacing: 0.5,
  },
  headline: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 28,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  headlineAccent: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  subheadline: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    lineHeight: 22,
  },

  // Features Section
  featuresSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: 2,
  },
  featureDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Spacer
  spacer: {
    flex: 1,
    minHeight: SPACING.lg,
  },

  // CTA Section
  ctaSection: {
    gap: SPACING.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: RADIUS.lg,
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
  },
  secondaryButtonAccent: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  // Trust Indicator
  trustIndicator: {
    alignItems: "center",
    paddingTop: SPACING.sm,
  },
  trustText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: "rgba(255, 255, 255, 0.4)",
    textAlign: "center",
  },
});
