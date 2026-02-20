/**
 * ExploreModal Component
 * Reusable modal for explore section items with gradient headers and features
 *
 * @example
 * ```tsx
 * <ExploreModal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   title="Discover"
 *   subtitle="Explore trending content"
 *   icon="compass"
 *   gradientColors={['#FF6B6B', '#FF8E53']}
 *   features={[
 *     { icon: 'trending-up', title: 'Trending', description: 'Latest trends' },
 *   ]}
 *   actionText="Start Exploring"
 *   onAction={() => router.push('/explore')}
 * />
 * ```
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import { triggerHaptic } from '@/utils/quiz-utils';
import { getResponsiveSize, getResponsivePadding, isTablet } from '@/utils/responsive';

const { height } = Dimensions.get("window");

export interface ExploreFeature {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
}

export interface ExploreModalProps {
  /** Modal visibility state */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal subtitle */
  subtitle: string;
  /** Hero icon */
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Gradient colors for header */
  gradientColors: readonly [string, string, ...string[]];
  /** List of features to display */
  features: ExploreFeature[];
  /** Action button text */
  actionText: string;
  /** Action button press handler */
  onAction: () => void;
  /** Test ID for testing */
  testID?: string;
}

export function ExploreModal({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  gradientColors,
  features,
  actionText,
  onAction,
  testID,
}: ExploreModalProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(50, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [visible, opacity, translateY, scale]);

  const handleAction = () => {
    triggerHaptic('heavy');
    onAction();
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const responsivePadding = getResponsivePadding();

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      testID={testID}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        />

        {/* Modal Container */}
        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.card },
            modalStyle,
          ]}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Close Button */}
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              accessibilityHint="Tap to close this modal"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </Pressable>

            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    width: getResponsiveSize(100, 120, 140),
                    height: getResponsiveSize(100, 120, 140),
                    borderRadius: getResponsiveSize(50, 60, 70),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={getResponsiveSize(50, 60, 80)}
                  color="white"
                />
              </View>
              <Text
                style={[
                  styles.title,
                  { fontSize: getResponsiveSize(22, 26, 32) },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { fontSize: getResponsiveSize(14, 16, 18) },
                ]}
              >
                {subtitle}
              </Text>
            </View>

            {/* Decorative elements */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
          </LinearGradient>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ padding: responsivePadding }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.featuresContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.text,
                    fontSize: getResponsiveSize(16, 18, 20),
                  },
                ]}
              >
                What you&apos;ll find:
              </Text>

              {features.map((feature, index) => (
                <View
                  key={index}
                  style={[
                    styles.featureItem,
                    {
                      backgroundColor: colors.elevated,
                      borderLeftColor: gradientColors[0],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: withAlpha(colors.primary, 0.1) },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={feature.icon}
                      size={getResponsiveSize(20, 22, 24)}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.featureText}>
                    <Text
                      style={[
                        styles.featureTitle,
                        {
                          color: colors.text,
                          fontSize: getResponsiveSize(14, 15, 16),
                        },
                      ]}
                    >
                      {feature.title}
                    </Text>
                    <Text
                      style={[
                        styles.featureDescription,
                        {
                          color: colors.textMuted,
                          fontSize: getResponsiveSize(12, 13, 14),
                        },
                      ]}
                    >
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer with Action Button */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.border,
                paddingHorizontal: responsivePadding,
              },
            ]}
          >
            <Pressable
              style={styles.actionButton}
              onPress={handleAction}
              accessibilityLabel={actionText}
              accessibilityRole="button"
              accessibilityHint="Tap to start this activity"
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <MaterialCommunityIcons name={icon} size={22} color="white" />
                <Text style={styles.actionButtonText}>{actionText}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: isTablet ? "70%" : "90%",
    maxWidth: 500,
    maxHeight: height * 0.85,
    borderRadius: RADIUS["2xl"],
    overflow: "hidden",
    ...SHADOWS.xl,
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 35,
    paddingBottom: 30,
    paddingHorizontal: SPACING.xl,
    position: "relative",
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 35,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  heroSection: {
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  iconContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
    ...SHADOWS.lg,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    marginBottom: SPACING.sm,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.regular,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  decorativeCircle1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  content: {
    flex: 1,
  },
  featuresContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    marginBottom: SPACING.base,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.base,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "600",
    marginBottom: SPACING.xxs,
  },
  featureDescription: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.xl,
  },
  actionButtonText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
    fontSize: 16,
    color: "white",
    marginLeft: SPACING.sm,
  },
});

export default ExploreModal;
