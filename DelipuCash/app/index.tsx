import { RADIUS, SPACING, TYPOGRAPHY, useTheme } from "@/utils/theme";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

/**
 * Clean, minimal splash screen following industry best practices:
 * - Centered logo with subtle fade-in animation
 * - App name with elegant typography
 * - Minimal tagline for context
 * - Two clear CTAs with strong visual hierarchy
 * - Generous whitespace for breathing room
 */
export default function SplashScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered animation sequence for polished feel
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Content fade in
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // CTA buttons
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoScale, logoOpacity, contentOpacity, contentSlide, ctaOpacity]);

  const handleGetStarted = (): void => {
    // Haptics may not be available on simulators/emulators
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      // Silently ignore - haptics not available on this device
    });
    router.push("/(auth)/signup");
  };

  const handleSignIn = (): void => {
    // Haptics may not be available on simulators/emulators
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Silently ignore - haptics not available on this device
    });
    router.push("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Subtle gradient background */}
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decorative ambient glow behind logo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            opacity: logoOpacity,
            backgroundColor: colors.primary,
          },
        ]}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + height * 0.14,
            paddingBottom: insets.bottom + SPACING.lg,
          },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
                contentFit="contain"
                transition={300}
              />
            </View>
          </Animated.View>

          {/* App Name & Tagline */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentSlide }],
              },
            ]}
          >
            <Text style={styles.appName}>DelipuCash</Text>
            <Text style={styles.tagline}>
              Earn rewards for your time.{"\n"}Simple. Fast. Secure.
            </Text>
          </Animated.View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA Section - Use View wrapper to ensure touch events always work */}
        <View style={styles.ctaSection}>
          <Animated.View style={{ opacity: ctaOpacity }}>
            {/* Primary CTA */}
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.85}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Get Started - Create a new account"
              accessibilityHint="Navigates to sign up screen"
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: ctaOpacity }}>
            {/* Secondary CTA */}
            <TouchableOpacity
              onPress={handleSignIn}
              activeOpacity={0.6}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Sign In to existing account"
              accessibilityHint="Navigates to login screen"
            >
              <Text style={styles.secondaryButtonText}>
                Already have an account?{" "}
                <Text
                  style={[
                    styles.secondaryButtonAccent,
                    { color: colors.primary },
                  ]}
                >
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
  },
  ambientGlow: {
    position: "absolute",
    top: height * 0.18,
    alignSelf: "center",
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.12,
    transform: [{ scale: 1.8 }],
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  heroSection: {
    alignItems: "center",
  },
  logoWrapper: {
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 56,
    height: 56,
  },
  textContainer: {
    alignItems: "center",
  },
  appName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 32,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  spacer: {
    flex: 1,
  },
  ctaSection: {
    gap: SPACING.base,
    paddingHorizontal: SPACING.sm,
  },
  primaryButton: {
    height: 52,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    // Subtle shadow for elevation
    shadowColor: "#4D4DFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    height: 48,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
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
});
