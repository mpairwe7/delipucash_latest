import { PrimaryButton } from "@/components";
import {
    COMPONENT_SIZE,
    RADIUS,
    SPACING,
    TYPOGRAPHY,
    useTheme,
    withAlpha,
} from "@/utils/theme";
import { useUpload } from "@/utils/useUpload";
import { useCreateAd } from "@/services/adHooksRefactored";
import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
  Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface FormState {
  title: string;
  description: string;
  targetUrl: string;
  type: "regular" | "featured" | "banner";
  sponsored: boolean;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

interface FormErrors {
  title?: string;
  description?: string;
  media?: string;
  targetUrl?: string;
  dates?: string;
}

type MediaKind = "image" | "video" | null;

const typeLabels: Record<FormState["type"], string> = {
  regular: "Regular",
  featured: "Featured",
  banner: "Banner",
};

export default function AdRegistrationScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [upload, { loading: uploading }] = useUpload();
  
  // TanStack Query mutation for creating ads
  const createAdMutation = useCreateAd();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    targetUrl: "",
    type: "regular",
    sponsored: true,
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [mediaUri, setMediaUri] = useState<string>("");
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasMedia = Boolean(mediaUri || uploadedUrl);

  const themedStyles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const validate = useCallback((): boolean => {
    const next: FormErrors = {};
    if (!hasMedia) next.media = "Please add an image or video";
    if (!form.title.trim()) next.title = "Title is required";
    else if (form.title.trim().length < 5) next.title = "Title must be at least 5 characters";
    if (!form.description.trim()) next.description = "Description is required";
    else if (form.description.trim().length < 10) next.description = "Description must be at least 10 characters";
    if (!form.targetUrl.trim()) next.targetUrl = "Destination URL is required";
    else if (!/^https?:\/\//i.test(form.targetUrl.trim())) next.targetUrl = "URL must start with http or https";
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      next.dates = "End date must be after start date";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, hasMedia]);

  const pickMedia = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Media access is required to upload creatives.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setMediaUri(asset.uri);

    const isVideo = asset.type === "video" || asset.uri.toLowerCase().endsWith(".mp4");
    setMediaKind(isVideo ? "video" : "image");

    try {
      const uploadResult = await upload({
        reactNativeAsset: {
          uri: asset.uri,
          name: asset.fileName ?? asset.uri.split("/").pop() ?? undefined,
          mimeType: asset.mimeType ?? undefined,
        },
      });
      if ("error" in uploadResult) {
        Alert.alert("Upload failed", uploadResult.error);
        setUploadedUrl("");
      } else {
        setUploadedUrl(uploadResult.url);
      }
    } catch (error) {
      console.error("Upload error", error);
      Alert.alert("Upload failed", "Please try again.");
      setUploadedUrl("");
    }
  }, [upload]);

  const mediaPreview = useMemo(() => {
    if (!hasMedia) return null;
    const uri = uploadedUrl || mediaUri;
    return (
      <View style={[themedStyles.preview, { borderColor: colors.border }]}
        accessible
        accessibilityLabel="Selected media preview"
      >
        <Image source={{ uri }} style={themedStyles.previewImage} resizeMode="cover" />
        {mediaKind === "video" && (
          <View style={themedStyles.previewBadge}>
            <Ionicons name="videocam" size={16} color={colors.primaryText} />
            <Text style={[themedStyles.previewBadgeText, { color: colors.primaryText }]}>Video</Text>
          </View>
        )}
      </View>
    );
  }, [colors.border, colors.primaryText, hasMedia, mediaKind, mediaUri, uploadedUrl, themedStyles]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    
    try {
      // Use TanStack Query mutation for optimized caching and state management
      await createAdMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: mediaKind === 'image' ? uploadedUrl : undefined,
        videoUrl: mediaKind === 'video' ? uploadedUrl : undefined,
        thumbnailUrl: mediaKind === 'video' ? uploadedUrl : undefined,
        type: form.type,
        sponsored: form.sponsored,
        isActive: form.isActive,
        targetUrl: form.targetUrl.trim(),
        startDate: form.startDate?.toISOString(),
        endDate: form.endDate?.toISOString(),
      });
      
      Alert.alert("Ad created", "Your ad was registered successfully.", [
        { text: "Done", onPress: handleBack },
      ]);
    } catch (error) {
      console.error("Submit error", error);
      Alert.alert("Error", "Could not create ad. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }, [handleBack, validate, createAdMutation, form, mediaKind, uploadedUrl]);

  return (
    <SafeAreaView style={[themedStyles.safeArea, { paddingTop: insets.top }]}> 
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={themedStyles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={themedStyles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={themedStyles.header}>
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={handleBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[themedStyles.title, { color: colors.text }]}>Ad registration</Text>
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={() => Alert.alert("Need help?", "Contact support for campaign setup.")}
              accessibilityLabel="Help"
              accessibilityRole="button"
            >
              <Feather name="help-circle" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={themedStyles.sectionHeader}>
              <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Media & copy</Text>
              <TouchableOpacity
                style={themedStyles.tertiaryButton}
                onPress={pickMedia}
                disabled={uploading}
                accessibilityLabel="Pick media"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={16} color={colors.primary} />
                    <Text style={[themedStyles.tertiaryLabel, { color: colors.primary }]}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {mediaPreview}
            {errors.media && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.media}</Text>}

            <Text style={[themedStyles.label, { color: colors.text }]}>Title</Text>
            <TextInput
              style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="Catchy campaign title"
              placeholderTextColor={colors.textMuted}
              value={form.title}
              onChangeText={(t) => updateField("title", t)}
              maxLength={60}
            />
            {errors.title && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.title}</Text>}

            <Text style={[themedStyles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[themedStyles.inputMultiline, { borderColor: colors.border, color: colors.text }]}
              placeholder="What makes this offer compelling?"
              placeholderTextColor={colors.textMuted}
              value={form.description}
              onChangeText={(t) => updateField("description", t)}
              multiline
              numberOfLines={4}
              maxLength={240}
              textAlignVertical="top"
            />
            {errors.description && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.description}</Text>}
          </View>

          <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={themedStyles.sectionHeader}>
              <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Settings</Text>
            </View>

            <Text style={[themedStyles.label, { color: colors.text }]}>Destination URL</Text>
            <TextInput
              style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              value={form.targetUrl}
              onChangeText={(t) => updateField("targetUrl", t)}
              autoCapitalize="none"
              keyboardType="url"
            />
            {errors.targetUrl && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.targetUrl}</Text>}

            <Text style={[themedStyles.label, { color: colors.text }]}>Ad type</Text>
            <View style={themedStyles.chipRow}>
              {(Object.keys(typeLabels) as FormState["type"][]).map((type) => {
                const active = form.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      themedStyles.chip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? withAlpha(colors.primary, 0.08) : colors.background,
                      },
                    ]}
                    onPress={() => updateField("type", type)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        themedStyles.chipLabel,
                        { color: active ? colors.primary : colors.text },
                      ]}
                    >
                      {typeLabels[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={themedStyles.switchRow}>
              <Text style={[themedStyles.label, { color: colors.text }]}>Sponsored</Text>
              <Switch
                value={form.sponsored}
                onValueChange={(value) => updateField("sponsored", value)}
                trackColor={{ true: withAlpha(colors.primary, 0.4), false: colors.border }}
                thumbColor={form.sponsored ? colors.primary : colors.textMuted}
              />
            </View>

            <View style={themedStyles.switchRow}>
              <Text style={[themedStyles.label, { color: colors.text }]}>Active</Text>
              <Switch
                value={form.isActive}
                onValueChange={(value) => updateField("isActive", value)}
                trackColor={{ true: withAlpha(colors.primary, 0.4), false: colors.border }}
                thumbColor={form.isActive ? colors.primary : colors.textMuted}
              />
            </View>

            <View style={themedStyles.dateRow}>
              <TouchableOpacity
                style={[themedStyles.dateButton, { borderColor: colors.border }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar" size={16} color={colors.textMuted} />
                <Text style={[themedStyles.dateLabel, { color: colors.text }]}>
                  {form.startDate ? form.startDate.toLocaleDateString() : "Start date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[themedStyles.dateButton, { borderColor: colors.border }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar" size={16} color={colors.textMuted} />
                <Text style={[themedStyles.dateLabel, { color: colors.text }]}>
                  {form.endDate ? form.endDate.toLocaleDateString() : "End date"}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.dates && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.dates}</Text>}

            {showStartPicker && (
              <DateTimePicker
                value={form.startDate || new Date()}
                mode="date"
                onChange={(_, date) => {
                  setShowStartPicker(false);
                  if (date) updateField("startDate", date);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={form.endDate || new Date()}
                mode="date"
                onChange={(_, date) => {
                  setShowEndPicker(false);
                  if (date) updateField("endDate", date);
                }}
              />
            )}
          </View>

          <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={themedStyles.sectionHeader}>
              <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Review</Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Title</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{form.title || "—"}</Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Description</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]} numberOfLines={2}>
                {form.description || "—"}
              </Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Type</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{typeLabels[form.type]}</Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Sponsored</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{form.sponsored ? "Yes" : "No"}</Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Active</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{form.isActive ? "Active" : "Paused"}</Text>
            </View>
            <View style={themedStyles.reviewRow}>
              <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Dates</Text>
              <Text style={[themedStyles.reviewValue, { color: colors.text }]}>
                {form.startDate ? form.startDate.toLocaleDateString() : "—"} → {form.endDate ? form.endDate.toLocaleDateString() : "—"}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[themedStyles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <PrimaryButton
            title={submitting ? "Creating..." : "Create ad"}
            onPress={handleSubmit}
            disabled={submitting || uploading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"], insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: { flex: 1 },
    scroll: {
      padding: SPACING.lg,
      paddingBottom: insets.bottom + SPACING['2xl'],
      gap: SPACING.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: SPACING.sm,
    },
    title: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
    },
    iconButton: {
      width: COMPONENT_SIZE.touchTarget,
      height: COMPONENT_SIZE.touchTarget,
      borderRadius: RADIUS.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    card: {
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      gap: SPACING.sm,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    tertiaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    tertiaryLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    inputMultiline: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      minHeight: 120,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    error: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    chipRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginVertical: SPACING.xs,
    },
    chip: {
      flex: 1,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: "center",
    },
    chipLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: SPACING.xs,
    },
    dateRow: {
      flexDirection: "row",
      gap: SPACING.sm,
    },
    dateButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      padding: SPACING.md,
      borderWidth: 1,
      borderRadius: RADIUS.md,
    },
    dateLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    reviewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: SPACING.xs,
    },
    reviewLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    reviewValue: {
      flex: 1,
      textAlign: "right",
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    preview: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      overflow: "hidden",
      height: 180,
    },
    previewImage: {
      width: "100%",
      height: "100%",
    },
    previewBadge: {
      position: "absolute",
      top: SPACING.sm,
      right: SPACING.sm,
      backgroundColor: withAlpha(colors.primary, 0.85),
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    previewBadgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    footer: {
      borderTopWidth: 1,
      padding: SPACING.lg,
      borderColor: colors.border,
    },
  });
