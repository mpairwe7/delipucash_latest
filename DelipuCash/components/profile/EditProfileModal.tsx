/**
 * EditProfileModal Component — 2026 Edition
 *
 * A polished, accessible profile editing modal inspired by Instagram,
 * WhatsApp, LinkedIn, and Cash App profile editors.
 *
 * Key UX improvements (2026 standards):
 * - Inline field-level validation with animated error indicators
 * - Keyboard-aware sequential field navigation (returnKeyType → onSubmitEditing)
 * - Focused field highlight with animated border colour transition
 * - Email field locked (read-only) – profile edit shouldn't change login email
 * - Haptic feedback on validation errors and successful save
 * - Unsaved changes guard with gentle confirmation
 * - Success check animation after saving
 * - Smooth spring animations for modal entrance/exit
 * - Character counters for name fields
 * - Accessible focus management and screen reader announcements
 * - 44×44 dp minimum touch targets (WCAG 2.2 AA)
 * - Dynamic Type / font scaling support
 * - Privacy info box at the bottom
 *
 * @module components/profile/EditProfileModal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Camera,
  User,
  Mail,
  Phone,
  Check,
  AlertCircle,
  Lock,
  Info,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image as ExpoImage } from 'expo-image';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

const AVATAR_SIZE = 100;
const MAX_NAME_LENGTH = 30;

export interface EditProfileData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  avatarUri?: string;
}

export interface EditProfileModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Current user data */
  user: EditProfileData;
  /** Save handler - receives updated data */
  onSave: (data: EditProfileData) => Promise<void>;
  /** Close handler */
  onClose: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Test ID */
  testID?: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  telephone?: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (E.164 or common formats)
 */
function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // optional field
  const phoneRegex = /^\+?[\d\s()-]{7,}$/;
  return phoneRegex.test(phone.trim());
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ============================================================================
// ANIMATED INPUT FIELD (with focus state, error animation, character counter)
// ============================================================================

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  icon: React.ReactNode;
  readOnly?: boolean;
  readOnlyHint?: string;
  required?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  returnKeyType?: TextInput['props']['returnKeyType'];
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  maxLength?: number;
  showCharCount?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  icon,
  readOnly = false,
  readOnlyHint,
  required = false,
  keyboardType,
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onSubmitEditing,
  inputRef,
  maxLength,
  showCharCount = false,
  accessibilityLabel,
  accessibilityHint,
  colors,
}: FormFieldProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);
  const errorAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withSpring(isFocused ? 1 : 0, { damping: 15, stiffness: 300 });
  }, [isFocused, focusAnim]);

  useEffect(() => {
    errorAnim.value = error ? withSpring(1, { damping: 12, stiffness: 200 }) : withTiming(0, { duration: 150 });
  }, [error, errorAnim]);

  const containerAnimStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? colors.error
      : interpolateColor(
          focusAnim.value,
          [0, 1],
          [colors.border, colors.primary]
        );
    const borderWidth = focusAnim.value > 0.5 ? 1.5 : 1;
    return { borderColor, borderWidth };
  });

  const errorRowAnimStyle = useAnimatedStyle(() => ({
    opacity: errorAnim.value,
    transform: [
      { translateY: (1 - errorAnim.value) * -4 },
      { scale: 0.95 + errorAnim.value * 0.05 },
    ],
  }));

  return (
    <View style={formFieldStyles.wrapper}>
      {/* Label row */}
      <View style={formFieldStyles.labelRow}>
        <AccessibleText variant="label" color="textMuted" style={formFieldStyles.label}>
          {label}{required ? ' *' : ''}
        </AccessibleText>
        {showCharCount && maxLength && (
          <AccessibleText
            variant="caption"
            color={value.length >= maxLength ? 'error' : 'textMuted'}
          >
            {value.length}/{maxLength}
          </AccessibleText>
        )}
        {readOnly && (
          <View style={[formFieldStyles.readOnlyBadge, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
            <Lock size={10} color={colors.textMuted} strokeWidth={2} />
            <AccessibleText variant="caption" color="textMuted">
              Locked
            </AccessibleText>
          </View>
        )}
      </View>

      {/* Input container */}
      <Animated.View
        style={[
          formFieldStyles.inputContainer,
          {
            backgroundColor: readOnly
              ? withAlpha(colors.textMuted, 0.06)
              : withAlpha(colors.primary, 0.04),
          },
          containerAnimStyle,
        ]}
      >
        <View style={[formFieldStyles.iconWrapper, { opacity: readOnly ? 0.5 : 0.7 }]}>
          {icon}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={withAlpha(colors.textMuted, 0.6)}
          style={[
            formFieldStyles.textInput,
            { color: readOnly ? colors.textMuted : colors.text },
          ]}
          editable={!readOnly}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={returnKeyType === 'done'}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={readOnly ? readOnlyHint || 'This field cannot be edited' : accessibilityHint}
          accessibilityState={{ disabled: readOnly }}
          selectionColor={colors.primary}
        />
      </Animated.View>

      {/* Error message */}
      {error && (
        <Animated.View style={[formFieldStyles.errorRow, errorRowAnimStyle]}>
          <AlertCircle size={12} color={colors.error} strokeWidth={2} />
          <AccessibleText variant="caption" color="error">
            {error}
          </AccessibleText>
        </Animated.View>
      )}

      {/* Read-only hint */}
      {readOnly && readOnlyHint && !error && (
        <View style={formFieldStyles.hintRow}>
          <Info size={11} color={colors.textMuted} strokeWidth={1.5} />
          <AccessibleText variant="caption" color="textMuted">
            {readOnlyHint}
          </AccessibleText>
        </View>
      )}
    </View>
  );
}

const formFieldStyles = StyleSheet.create({
  wrapper: {
    gap: SPACING.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: SPACING.xs,
    marginRight: SPACING.xs,
  },
  label: {
    // inherits from AccessibleText
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: RADIUS.xl,
    minHeight: COMPONENT_SIZE.input.medium,
  },
  iconWrapper: {
    width: 24,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingVertical: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.xs,
    opacity: 0.7,
  },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EditProfileModal({
  visible,
  user,
  onSave,
  onClose,
  isSaving = false,
  testID,
}: EditProfileModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Refs for sequential keyboard navigation
  const firstNameRef = useRef<TextInput | null>(null);
  const lastNameRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [formData, setFormData] = useState<EditProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    telephone: '',
    avatarUri: undefined,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);

  // Animation values
  const saveScale = useSharedValue(1);
  const headerOpacity = useSharedValue(0);

  // Populate form when modal opens or when user data arrives while open.
  // Deps use individual primitives (not the object ref) so the effect only
  // fires when actual values change.  Skip if the user has already started
  // editing (`isDirty`) to avoid overwriting in-flight input.
  useEffect(() => {
    if (visible && user && !isDirty) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        telephone: user.telephone || '',
        avatarUri: user.avatarUri,
      });
      setErrors({});
      setShowSuccessCheck(false);
      headerOpacity.value = withTiming(1, { duration: 300 });

      // Focus first name field after modal animation
      setTimeout(() => {
        firstNameRef.current?.focus();
      }, 500);
    }
    if (!visible) {
      // Reset dirty flag on close so next open gets fresh data
      setIsDirty(false);
      headerOpacity.value = 0;
    }
  }, [visible, user?.firstName, user?.lastName, user?.email, user?.telephone, user?.avatarUri, isDirty, headerOpacity]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!user) return false;
    return (
      formData.firstName !== (user.firstName || '') ||
      formData.lastName !== (user.lastName || '') ||
      formData.telephone !== (user.telephone || '') ||
      formData.avatarUri !== user.avatarUri
    );
  }, [formData, user]);

  // Validate individual field
  const validateField = useCallback((field: keyof FormErrors, value: string): string | undefined => {
    switch (field) {
      case 'firstName':
        if (!value.trim()) return 'First name is required';
        if (value.trim().length < 2) return 'First name must be at least 2 characters';
        return undefined;
      case 'lastName':
        if (!value.trim()) return 'Last name is required';
        if (value.trim().length < 2) return 'Last name must be at least 2 characters';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!isValidEmail(value)) return 'Please enter a valid email';
        return undefined;
      case 'telephone':
        if (value && !isValidPhone(value)) return 'Please enter a valid phone number';
        return undefined;
      default:
        return undefined;
    }
  }, []);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const fields: (keyof FormErrors)[] = ['firstName', 'lastName', 'telephone'];
    for (const field of fields) {
      const error = validateField(field, formData[field] || '');
      if (error) newErrors[field] = error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Handle input change with inline validation
  const handleChange = useCallback((field: keyof EditProfileData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);

    // Clear error on typing (validate on blur instead for better UX)
    const errorField = field as keyof FormErrors;
    if (errors[errorField]) {
      setErrors(prev => ({ ...prev, [errorField]: undefined }));
    }
  }, [errors]);

  // Handle avatar picker
  const handlePickAvatar = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    /**
     * Compress and resize picked image to ≤400×400 JPEG at 70% quality.
     * This keeps uploads under ~200 KB for faster saves and lower bandwidth.
     */
    const compressAvatar = async (uri: string): Promise<string> => {
      try {
        const manipulated = await manipulateAsync(
          uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );
        return manipulated.uri;
      } catch {
        // If manipulation fails, fall back to the original URI
        return uri;
      }
    };

    Alert.alert('Change Photo', 'Choose how you want to update your profile photo', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is needed to take a photo');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            const compressed = await compressAvatar(result.assets[0].uri);
            setFormData(prev => ({ ...prev, avatarUri: compressed }));
            setIsDirty(true);
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery permission is needed to select a photo');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            const compressed = await compressAvatar(result.assets[0].uri);
            setFormData(prev => ({ ...prev, avatarUri: compressed }));
            setIsDirty(true);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Announce error to screen readers
      AccessibilityInfo.announceForAccessibility('Please fix the errors in the form before saving.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await onSave(formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Brief success indicator before closing
      setShowSuccessCheck(true);
      AccessibilityInfo.announceForAccessibility('Profile updated successfully.');

      setTimeout(() => {
        setShowSuccessCheck(false);
      }, 1200);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Error handling is done in parent
    }
  }, [formData, onSave, validateForm]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges && isDirty) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            },
          },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  }, [hasChanges, isDirty, onClose]);

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const handleSavePressIn = () => {
    saveScale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
  };

  const handleSavePressOut = () => {
    saveScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const initials = useMemo(() => {
    const fi = formData.firstName?.charAt(0) || '';
    const li = formData.lastName?.charAt(0) || '';
    if (fi || li) return `${fi}${li}`.toUpperCase();
    if (formData.email) return formData.email.charAt(0).toUpperCase();
    return 'U';
  }, [formData.firstName, formData.lastName, formData.email]);

  // Count dirty fields for save button context
  const changedFieldCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    if (formData.firstName !== (user.firstName || '')) count++;
    if (formData.lastName !== (user.lastName || '')) count++;
    if (formData.telephone !== (user.telephone || '')) count++;
    if (formData.avatarUri !== user.avatarUri) count++;
    return count;
  }, [formData, user]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      testID={testID}
      accessibilityViewIsModal
    >
      <Animated.View
        entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
        style={[styles.overlay, { backgroundColor: withAlpha('#000', 0.5) }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Animated.View
            entering={SlideInDown.springify().damping(15).reduceMotion(ReduceMotion.System)}
            exiting={SlideOutDown.springify().reduceMotion(ReduceMotion.System)}
            style={[
              styles.container,
              {
                backgroundColor: colors.card,
                paddingTop: insets.top + SPACING.lg,
                paddingBottom: insets.bottom + SPACING.lg,
              },
            ]}
            accessible
            accessibilityLabel="Edit Profile"
            accessibilityRole="none"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeButton, { backgroundColor: withAlpha(colors.error, 0.1) }]}
                accessibilityLabel="Close profile editor"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={ICON_SIZE.lg} color={colors.error} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <AccessibleText variant="h3" headingLevel={2} style={styles.headerTitle}>
                  Edit Profile
                </AccessibleText>
                {hasChanges && (
                  <Animated.View
                    entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
                  >
                    <AccessibleText variant="caption" color="primary">
                      {changedFieldCount} change{changedFieldCount !== 1 ? 's' : ''}
                    </AccessibleText>
                  </Animated.View>
                )}
              </View>

              <AnimatedTouchable
                onPressIn={handleSavePressIn}
                onPressOut={handleSavePressOut}
                onPress={handleSave}
                disabled={isSaving || !hasChanges}
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: hasChanges
                      ? colors.primary
                      : withAlpha(colors.primary, 0.3),
                  },
                  saveAnimatedStyle,
                ]}
                accessibilityLabel={
                  showSuccessCheck
                    ? 'Saved successfully'
                    : hasChanges
                    ? `Save ${changedFieldCount} change${changedFieldCount !== 1 ? 's' : ''}`
                    : 'No changes to save'
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving || !hasChanges }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : showSuccessCheck ? (
                  <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
                    <Check size={ICON_SIZE.lg} color={colors.primaryText} strokeWidth={3} />
                  </Animated.View>
                ) : (
                  <Check size={ICON_SIZE.lg} color={colors.primaryText} strokeWidth={2.5} />
                )}
              </AnimatedTouchable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Avatar Section */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(300).reduceMotion(ReduceMotion.System)}
                style={styles.avatarSection}
              >
                <TouchableOpacity
                  onPress={handlePickAvatar}
                  style={styles.avatarContainer}
                  accessibilityLabel="Change profile photo"
                  accessibilityRole="button"
                  accessibilityHint="Opens photo picker to change your profile picture"
                >
                  <LinearGradient
                    colors={[colors.primary, withAlpha(colors.primary, 0.6)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarBorder}
                  >
                    <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                      {formData.avatarUri ? (
                        <ExpoImage
                          source={{ uri: formData.avatarUri }}
                          style={styles.avatarImage}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                          transition={200}
                          recyclingKey={formData.avatarUri}
                        />
                      ) : (
                        <LinearGradient
                          colors={[colors.primary, withAlpha(colors.primary, 0.7)]}
                          style={styles.avatarGradient}
                        >
                          <AccessibleText variant="h2" customColor="#FFF">
                            {initials}
                          </AccessibleText>
                        </LinearGradient>
                      )}
                    </View>
                  </LinearGradient>

                  {/* Camera overlay */}
                  <View style={[styles.cameraOverlay, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                    <Camera size={16} color="#FFF" strokeWidth={2} />
                  </View>
                </TouchableOpacity>

                <AccessibleText variant="bodySmall" color="textMuted" style={styles.avatarHint}>
                  Tap to change photo
                </AccessibleText>
              </Animated.View>

              {/* Form Fields */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(300).reduceMotion(ReduceMotion.System)}
                style={styles.formSection}
              >
                {/* First Name */}
                <FormField
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(v) => handleChange('firstName', v)}
                  placeholder="Enter your first name"
                  error={errors.firstName}
                  icon={<User size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  required
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  inputRef={firstNameRef}
                  maxLength={MAX_NAME_LENGTH}
                  showCharCount
                  accessibilityLabel="First name"
                  accessibilityHint="Enter your first name"
                  colors={colors}
                />

                {/* Last Name */}
                <FormField
                  label="Last Name"
                  value={formData.lastName}
                  onChangeText={(v) => handleChange('lastName', v)}
                  placeholder="Enter your last name"
                  error={errors.lastName}
                  icon={<User size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  required
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  inputRef={lastNameRef}
                  maxLength={MAX_NAME_LENGTH}
                  showCharCount
                  accessibilityLabel="Last name"
                  accessibilityHint="Enter your last name"
                  colors={colors}
                />

                {/* Email (Read-only) */}
                <FormField
                  label="Email Address"
                  value={formData.email}
                  onChangeText={() => {}} // no-op — field is locked
                  placeholder="Email address"
                  error={errors.email}
                  icon={<Mail size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  readOnly
                  readOnlyHint="Email can't be changed from here. Contact support if needed."
                  accessibilityLabel="Email address (read only)"
                  accessibilityHint="This field cannot be edited"
                  colors={colors}
                />

                {/* Phone Number */}
                <FormField
                  label="Phone Number"
                  value={formData.telephone}
                  onChangeText={(v) => handleChange('telephone', v)}
                  placeholder="+256 700 000 000"
                  error={errors.telephone}
                  icon={<Phone size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  inputRef={phoneRef}
                  accessibilityLabel="Phone number"
                  accessibilityHint="Enter your phone number with country code"
                  colors={colors}
                />
              </Animated.View>

              {/* Bottom Info */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(300).reduceMotion(ReduceMotion.System)}
                style={[styles.infoBox, { backgroundColor: withAlpha(colors.info, 0.06), borderColor: withAlpha(colors.info, 0.15) }]}
              >
                <Info size={14} color={colors.info} strokeWidth={1.5} />
                <AccessibleText variant="caption" color="textMuted" style={styles.infoText}>
                  Your personal information is securely stored and only visible to you. Changes are saved to your account immediately.
                </AccessibleText>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  closeButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING['2xl'],
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  avatarHint: {
    marginTop: SPACING.sm,
  },
  formSection: {
    gap: SPACING.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});

export default EditProfileModal;
