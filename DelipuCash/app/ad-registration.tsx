import { PrimaryButton } from "@/components";
import {
    COMPONENT_SIZE,
    RADIUS,
    SPACING,
    TYPOGRAPHY,
    useTheme,
    withAlpha,
} from "@/utils/theme";
import { useUploadAdMediaToR2 } from "@/services/r2UploadHooks";
import { useCreateAd } from "@/services/adHooksRefactored";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle, Lightbulb } from "lucide-react-native";

// ============================================================================
// INDUSTRY-STANDARD AD CONFIGURATION
// ============================================================================

/** Ad placement types following app placements */
type AdPlacement = "home" | "feed" | "survey" | "video" | "question" | "profile" | "explore";

/** Pricing models */
type PricingModel = "cpm" | "cpc" | "cpa" | "flat";

/** Call-to-action button types */
type CTAType = "learn_more" | "shop_now" | "sign_up" | "download" | "contact_us" | "get_offer" | "book_now" | "watch_more" | "apply_now" | "subscribe" | "get_quote";

/** Target audience age ranges */
type AgeRange = "13-17" | "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";

/** Target audience gender */
type Gender = "all" | "male" | "female" | "other";

interface FormState {
  // Basic Info
  title: string;
  description: string;
  targetUrl: string;
  type: "standard" | "featured" | "banner" | "compact";
  placement: AdPlacement;
  sponsored: boolean;
  isActive: boolean;
  
  // Schedule
  startDate?: Date;
  endDate?: Date;
  
  // Budget & Bidding
  pricingModel: PricingModel;
  budget: string;
  bidAmount: string;
  dailyBudgetLimit: string;
  
  // Creative
  callToAction: CTAType;
  headline: string;
  
  // Targeting
  targetAgeRanges: AgeRange[];
  targetGender: Gender;
  targetLocations: string[];
  targetInterests: string[];
  
  // Advanced
  priority: number;
  frequencyCap: string;
  enableRetargeting: boolean;
}

interface FormErrors {
  title?: string;
  description?: string;
  media?: string;
  targetUrl?: string;
  dates?: string;
  budget?: string;
  bidAmount?: string;
  headline?: string;
}

type MediaKind = "image" | "video" | null;

// Configuration constants
const typeLabels: Record<FormState["type"], { label: string; description: string }> = {
  standard: { label: "Standard", description: "Standard feed ad" },
  featured: { label: "Featured", description: "Highlighted placement" },
  banner: { label: "Banner", description: "Top/bottom banner" },
  compact: { label: "Compact", description: "Small inline ad" },
};

const placementLabels: Record<AdPlacement, { label: string; icon: string }> = {
  home: { label: "Home", icon: "home" },
  feed: { label: "Feed", icon: "view-list" },
  survey: { label: "Survey", icon: "poll" },
  video: { label: "Video", icon: "play-circle" },
  question: { label: "Question", icon: "help-circle" },
  profile: { label: "Profile", icon: "account" },
  explore: { label: "Explore", icon: "compass" },
};

const pricingLabels: Record<PricingModel, { label: string; description: string }> = {
  cpm: { label: "CPM", description: "Cost per 1,000 impressions" },
  cpc: { label: "CPC", description: "Cost per click" },
  cpa: { label: "CPA", description: "Cost per action" },
  flat: { label: "Flat", description: "Fixed daily rate" },
};

const ctaOptions: Record<CTAType, string> = {
  learn_more: "Learn More",
  shop_now: "Shop Now",
  sign_up: "Sign Up",
  download: "Download",
  contact_us: "Contact Us",
  get_offer: "Get Offer",
  book_now: "Book Now",
  watch_more: "Watch More",
  apply_now: "Apply Now",
  subscribe: "Subscribe",
  get_quote: "Get Quote",
};

const ageRangeOptions: AgeRange[] = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const interestCategories = [
  "Technology", "Sports", "Entertainment", "Fashion", "Food", "Travel",
  "Health", "Business", "Education", "Gaming", "Music", "Finance"
];

// Form step configuration
const FORM_STEPS = [
  { key: "media", label: "Creative", icon: "image" },
  { key: "details", label: "Details", icon: "text" },
  { key: "targeting", label: "Targeting", icon: "target" },
  { key: "budget", label: "Budget", icon: "wallet" },
  { key: "review", label: "Review", icon: "check-circle" },
] as const;

type FormStep = typeof FORM_STEPS[number]["key"];

// ============================================================================
// AI-POWERED SUGGESTIONS
// ============================================================================

interface AISuggestion {
  type: 'success' | 'warning' | 'tip' | 'improvement';
  title: string;
  description: string;
  action?: {
    label: string;
    value: any;
    field: keyof FormState;
  };
}

/** Generate AI suggestions based on form state */
function generateAISuggestions(form: FormState, hasMedia: boolean, mediaKind: MediaKind): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  // Title suggestions
  if (form.title.length > 0 && form.title.length < 20) {
    suggestions.push({
      type: 'tip',
      title: 'Expand your headline',
      description: 'Titles with 40-60 characters tend to perform 23% better. Consider adding more descriptive words.',
    });
  }
  if (form.title && !form.title.match(/\d/)) {
    suggestions.push({
      type: 'improvement',
      title: 'Add numbers for impact',
      description: 'Headlines with numbers get 36% more clicks. Example: "Save 50%" or "Join 10,000+ users".',
    });
  }

  // Description suggestions
  if (form.description.length > 0 && form.description.length < 50) {
    suggestions.push({
      type: 'tip',
      title: 'Enrich your description',
      description: 'Ads with 80-120 character descriptions see 18% higher engagement. Tell users the value proposition.',
    });
  }
  if (form.description && !form.description.includes('!') && !form.description.includes('?')) {
    suggestions.push({
      type: 'improvement',
      title: 'Add emotion',
      description: 'Questions and exclamations increase CTR by 14%. Ask users a question or excite them!',
    });
  }

  // CTA suggestions
  if (form.callToAction === 'learn_more') {
    suggestions.push({
      type: 'tip',
      title: 'Consider a stronger CTA',
      description: '"Shop Now" and "Get Offer" buttons convert 27% better than "Learn More" for e-commerce.',
    });
  }

  // Targeting suggestions
  if (form.targetAgeRanges.length === ageRangeOptions.length) {
    suggestions.push({
      type: 'warning',
      title: 'Targeting is too broad',
      description: 'Selecting all age groups reduces relevance. Focus on your core demographic for better ROI.',
    });
  }
  if (form.targetInterests.length === 0) {
    suggestions.push({
      type: 'improvement',
      title: 'Add interest targeting',
      description: 'Interest-based targeting improves conversion rates by 40%. Select relevant interests.',
    });
  }

  // Budget suggestions
  const budget = Number(form.budget) || 0;
  const bidAmount = Number(form.bidAmount) || 0;
  if (budget > 0 && budget < 10) {
    suggestions.push({
      type: 'warning',
      title: 'Budget may be too low',
      description: 'Campaigns under $10 have limited reach. Consider $25+ for meaningful results.',
    });
  }
  if (form.pricingModel === 'cpm' && bidAmount > 0 && bidAmount > 5) {
    suggestions.push({
      type: 'tip',
      title: 'High CPM bid',
      description: 'Average CPM in this category is $2-4. You might be overpaying. Consider reducing your bid.',
    });
  }
  if (form.pricingModel === 'cpc' && bidAmount > 0 && bidAmount < 0.3) {
    suggestions.push({
      type: 'warning',
      title: 'Low CPC bid',
      description: 'Very low CPC bids may result in limited delivery. Consider $0.50+ for better reach.',
    });
  }

  // Media suggestions
  if (!hasMedia) {
    suggestions.push({
      type: 'warning',
      title: 'Add creative assets',
      description: 'Ads with images get 94% more views. Video ads have 20% higher engagement rates.',
    });
  }
  if (mediaKind === 'video') {
    suggestions.push({
      type: 'success',
      title: 'Great choice: Video ad',
      description: 'Video ads have 20% higher engagement and 27% better recall. Keep videos under 15 seconds for best results.',
    });
  }

  // Placement-specific suggestions
  if (form.placement === 'video' && budget < 50) {
    suggestions.push({
      type: 'tip',
      title: 'Video ads need higher budget',
      description: 'Video ad placements work best with $50+ budgets due to higher user expectations.',
    });
  }
  if (form.placement === 'home' && mediaKind !== 'video') {
    suggestions.push({
      type: 'improvement',
      title: 'Home placement works better with video',
      description: 'Home placements see 3x more engagement with video content vs. static images.',
    });
  }

  // Frequency cap suggestions
  const frequencyCap = Number(form.frequencyCap) || 0;
  if (frequencyCap > 5) {
    suggestions.push({
      type: 'warning',
      title: 'Frequency cap is high',
      description: 'Showing an ad more than 5 times can cause ad fatigue. Recommended: 2-3 per day.',
    });
  }

  // Success indicators
  if (form.title.length >= 30 && form.description.length >= 80 && hasMedia && form.targetInterests.length > 0) {
    suggestions.push({
      type: 'success',
      title: 'Looking good!',
      description: 'Your ad is well-configured for optimal performance. Expected CTR: 2.5-3.5%.',
    });
  }

  return suggestions.slice(0, 3); // Limit to 3 suggestions at a time
}

/** AI Suggestions Panel Component */
const AISuggestionsPanel: React.FC<{
  suggestions: AISuggestion[];
  colors: any;
  onApplySuggestion?: (field: keyof FormState, value: any) => void;
}> = ({ suggestions, colors, onApplySuggestion }) => {
  if (suggestions.length === 0) return null;

  const getIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} color={colors.success} />;
      case 'warning': return <AlertCircle size={18} color={colors.warning} />;
      case 'tip': return <Lightbulb size={18} color={colors.primary} />;
      case 'improvement': return <TrendingUp size={18} color={colors.info} />;
    }
  };

  const getBgColor = (type: AISuggestion['type']) => {
    switch (type) {
      case 'success': return withAlpha(colors.success, 0.1);
      case 'warning': return withAlpha(colors.warning, 0.1);
      case 'tip': return withAlpha(colors.primary, 0.1);
      case 'improvement': return withAlpha(colors.info, 0.1);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(300)}
      style={{
        marginBottom: SPACING.md,
        padding: SPACING.md,
        backgroundColor: colors.card,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm }}>
        <Sparkles size={18} color={colors.primary} />
        <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm, color: colors.text }}>
          AI Suggestions
        </Text>
      </View>

      {suggestions.map((suggestion, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: SPACING.sm,
            paddingVertical: SPACING.sm,
            paddingHorizontal: SPACING.sm,
            marginBottom: index < suggestions.length - 1 ? SPACING.xs : 0,
            backgroundColor: getBgColor(suggestion.type),
            borderRadius: RADIUS.md,
          }}
        >
          <View style={{ marginTop: 2 }}>
            {getIcon(suggestion.type)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.sm, color: colors.text }}>
              {suggestion.title}
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>
              {suggestion.description}
            </Text>
            {suggestion.action && (
              <TouchableOpacity
                style={{
                  marginTop: SPACING.xs,
                  paddingVertical: 4,
                  paddingHorizontal: SPACING.sm,
                  backgroundColor: colors.primary,
                  borderRadius: RADIUS.sm,
                  alignSelf: 'flex-start',
                }}
                onPress={() => onApplySuggestion?.(suggestion.action!.field, suggestion.action!.value)}
              >
                <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.xs, color: colors.primaryText }}>
                  {suggestion.action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

export default function AdRegistrationScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();

  // R2 upload hook for ad media
  const { mutateAsync: uploadAdMedia, isPending: uploading, progress: uploadProgress } = useUploadAdMediaToR2();
  
  // TanStack Query mutation for creating ads
  const createAdMutation = useCreateAd();

  // Current step in the wizard
  const [currentStep, setCurrentStep] = useState<FormStep>("media");

  const [form, setForm] = useState<FormState>({
    // Basic Info
    title: "",
    description: "",
    targetUrl: "",
    type: "standard",
    placement: "feed",
    sponsored: true,
    isActive: true,
    
    // Budget & Bidding
    pricingModel: "cpm",
    budget: "",
    bidAmount: "",
    dailyBudgetLimit: "",
    
    // Creative
    callToAction: "learn_more",
    headline: "",
    
    // Targeting
    targetAgeRanges: ["18-24", "25-34"],
    targetGender: "all",
    targetLocations: [],
    targetInterests: [],
    
    // Advanced
    priority: 5,
    frequencyCap: "3",
    enableRetargeting: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [mediaUri, setMediaUri] = useState<string>("");
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasMedia = Boolean(mediaUri || uploadedUrl);
  const currentStepIndex = FORM_STEPS.findIndex(s => s.key === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === FORM_STEPS.length - 1;

  const themedStyles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(FORM_STEPS[currentStepIndex - 1].key);
    } else {
      router.back();
    }
  }, [isFirstStep, currentStepIndex]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      setCurrentStep(FORM_STEPS[currentStepIndex + 1].key);
    }
  }, [isLastStep, currentStepIndex]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const toggleArrayField = useCallback(<K extends keyof FormState>(
    key: K, 
    value: FormState[K] extends (infer U)[] ? U : never
  ) => {
    setForm((prev) => {
      const arr = prev[key] as unknown[];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(v => v !== value) };
      } else {
        return { ...prev, [key]: [...arr, value] };
      }
    });
  }, []);

  const validateStep = useCallback((step: FormStep): boolean => {
    const next: FormErrors = {};
    
    switch (step) {
      case "media":
        if (!hasMedia) next.media = "Please add an image or video";
        break;
      case "details":
        if (!form.title.trim()) next.title = "Title is required";
        else if (form.title.trim().length < 5) next.title = "Title must be at least 5 characters";
        if (!form.description.trim()) next.description = "Description is required";
        else if (form.description.trim().length < 10) next.description = "Description must be at least 10 characters";
        if (!form.targetUrl.trim()) next.targetUrl = "Destination URL is required";
        else if (!/^https?:\/\//i.test(form.targetUrl.trim())) next.targetUrl = "URL must start with http or https";
        if (form.headline.trim() && form.headline.trim().length < 3) next.headline = "Headline must be at least 3 characters";
        break;
      case "budget":
        if (!form.budget.trim()) next.budget = "Budget is required";
        else if (isNaN(Number(form.budget)) || Number(form.budget) <= 0) next.budget = "Enter a valid budget amount";
        if (!form.bidAmount.trim()) next.bidAmount = "Bid amount is required";
        else if (isNaN(Number(form.bidAmount)) || Number(form.bidAmount) <= 0) next.bidAmount = "Enter a valid bid amount";
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
          next.dates = "End date must be after start date";
        }
        break;
    }
    
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, hasMedia]);

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
    if (!form.budget.trim() || isNaN(Number(form.budget)) || Number(form.budget) <= 0) {
      next.budget = "Enter a valid budget amount";
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
      // Upload to Cloudflare R2
      const uploadResult = await uploadAdMedia({
        mediaUri: asset.uri,
        userId: 'current-user-id', // TODO: Get from auth context
        fileName: asset.fileName ?? asset.uri.split("/").pop() ?? undefined,
        mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      });

      if (!uploadResult.success) {
        Alert.alert("Upload failed", uploadResult.error || "Please try again.");
        setUploadedUrl("");
      } else {
        setUploadedUrl(uploadResult.data.url);
      }
    } catch (error) {
      console.error("Upload error", error);
      Alert.alert("Upload failed", "Please try again.");
      setUploadedUrl("");
    }
  }, [uploadAdMedia]);

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
        <View style={[themedStyles.ctaOverlay, { backgroundColor: withAlpha(colors.primary, 0.9) }]}>
          <Text style={themedStyles.ctaOverlayText}>{ctaOptions[form.callToAction]}</Text>
        </View>
      </View>
    );
  }, [colors.border, colors.primaryText, colors.primary, hasMedia, mediaKind, mediaUri, uploadedUrl, themedStyles, form.callToAction]);

  // Estimated reach calculation based on targeting
  const estimatedReach = useMemo(() => {
    const baseReach = 10000;
    let multiplier = 1;
    
    // Fewer age ranges = more targeted = lower reach
    multiplier *= Math.max(0.3, form.targetAgeRanges.length / ageRangeOptions.length);
    
    // Gender targeting
    if (form.targetGender !== "all") multiplier *= 0.5;
    
    // More interests = more targeted
    if (form.targetInterests.length > 0) {
      multiplier *= Math.max(0.4, 1 - (form.targetInterests.length * 0.08));
    }
    
    // Location targeting
    if (form.targetLocations.length > 0) {
      multiplier *= 0.7;
    }
    
    // Placement affects reach
    const placementMultipliers: Record<AdPlacement, number> = {
      home: 1,
      feed: 0.9,
      survey: 0.5,
      video: 0.6,
      question: 0.7,
      profile: 0.4,
      explore: 0.8,
    };
    multiplier *= placementMultipliers[form.placement];
    
    return Math.round(baseReach * multiplier);
  }, [form.targetAgeRanges.length, form.targetGender, form.targetInterests.length, form.targetLocations.length, form.placement]);

  // Estimated cost calculation
  const estimatedCost = useMemo(() => {
    const budget = Number(form.budget) || 0;
    const bidAmount = Number(form.bidAmount) || 0;
    
    if (budget <= 0 || bidAmount <= 0) return { impressions: 0, clicks: 0, cost: 0 };
    
    let impressions = 0;
    let clicks = 0;
    
    switch (form.pricingModel) {
      case "cpm":
        impressions = Math.round((budget / bidAmount) * 1000);
        clicks = Math.round(impressions * 0.02); // 2% CTR estimate
        break;
      case "cpc":
        clicks = Math.round(budget / bidAmount);
        impressions = Math.round(clicks / 0.02); // 2% CTR estimate
        break;
      case "cpa":
        clicks = Math.round((budget / bidAmount) * 10); // 10 clicks per conversion
        impressions = Math.round(clicks / 0.02);
        break;
      case "flat":
        impressions = estimatedReach;
        clicks = Math.round(estimatedReach * 0.02);
        break;
    }
    
    return { impressions, clicks, cost: budget };
  }, [form.budget, form.bidAmount, form.pricingModel, estimatedReach]);

  // AI-powered suggestions based on current form state
  const aiSuggestions = useMemo(() => {
    return generateAISuggestions(form, hasMedia, mediaKind);
  }, [form, hasMedia, mediaKind]);

  // Apply suggestion handler
  const handleApplySuggestion = useCallback((field: keyof FormState, value: any) => {
    updateField(field, value);
  }, [updateField]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    
    try {
      // Use TanStack Query mutation for optimized caching and state management
      await createAdMutation.mutateAsync({
        title: form.title.trim(),
        headline: form.headline.trim() || undefined,
        description: form.description.trim(),
        imageUrl: mediaKind === 'image' ? uploadedUrl : undefined,
        videoUrl: mediaKind === 'video' ? uploadedUrl : undefined,
        thumbnailUrl: mediaKind === 'video' ? uploadedUrl : undefined,
        type: form.type,
        placement: form.placement,
        sponsored: form.sponsored,
        targetUrl: form.targetUrl.trim() || undefined,
        callToAction: form.callToAction,
        startDate: form.startDate?.toISOString(),
        endDate: form.endDate?.toISOString(),
        pricingModel: form.pricingModel,
        totalBudget: parseFloat(form.budget) || 0,
        bidAmount: parseFloat(form.bidAmount) || 0,
        dailyBudgetLimit: form.dailyBudgetLimit ? parseFloat(form.dailyBudgetLimit) : undefined,
        targetAgeRanges: form.targetAgeRanges,
        targetGender: form.targetGender,
        targetLocations: form.targetLocations.length > 0 ? form.targetLocations : undefined,
        targetInterests: form.targetInterests.length > 0 ? form.targetInterests : undefined,
        enableRetargeting: form.enableRetargeting,
        priority: form.priority,
        frequency: Number(form.frequencyCap) || undefined,
        userId: 'current-user-id', // TODO: Get from auth context
      });
      
      Alert.alert("Ad Campaign Created!", "Your campaign is now under review and will be live within 24 hours.", [
        { text: "View Campaigns", onPress: () => router.push("/") },
        { text: "Create Another", onPress: () => {
          setForm({
            title: "", description: "", targetUrl: "", type: "standard", placement: "feed",
            sponsored: true, isActive: true, pricingModel: "cpm", budget: "", bidAmount: "",
            dailyBudgetLimit: "", callToAction: "learn_more", headline: "",
            targetAgeRanges: ["18-24", "25-34"], targetGender: "all", targetLocations: [],
            targetInterests: [], priority: 5, frequencyCap: "3", enableRetargeting: false,
          });
          setMediaUri("");
          setUploadedUrl("");
          setMediaKind(null);
          setCurrentStep("media");
        }},
      ]);
    } catch (error) {
      console.error("Submit error", error);
      Alert.alert("Error", "Could not create ad. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }, [validate, createAdMutation, form, mediaKind, uploadedUrl]);

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top', 'bottom']}> 
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={themedStyles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        {/* Header */}
        <View style={themedStyles.header}>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[themedStyles.title, { color: colors.text }]}>Create Campaign</Text>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => Alert.alert("Need help?", "Contact support for campaign setup.")}
            accessibilityLabel="Help"
            accessibilityRole="button"
          >
            <Feather name="help-circle" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Step Indicator */}
        <View style={themedStyles.stepIndicator}>
          {FORM_STEPS.map((step, index) => {
            const isActive = currentStep === step.key;
            const isCompleted = index < currentStepIndex;
            return (
              <TouchableOpacity 
                key={step.key} 
                style={themedStyles.stepItem}
                onPress={() => setCurrentStep(step.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={[
                  themedStyles.stepCircle,
                  { 
                    backgroundColor: isCompleted ? colors.success : isActive ? colors.primary : colors.border,
                    borderColor: isActive ? colors.primary : "transparent",
                  },
                ]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={[themedStyles.stepNumber, { color: isActive ? "#FFFFFF" : colors.textMuted }]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text style={[
                  themedStyles.stepLabel,
                  { color: isActive ? colors.primary : colors.textMuted },
                ]}>
                  {step.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={themedStyles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* AI Suggestions Panel */}
          <AISuggestionsPanel
            suggestions={aiSuggestions}
            colors={colors}
            onApplySuggestion={handleApplySuggestion}
          />

          {/* Step 1: Media/Creative */}
          {currentStep === "media" && (
            <Animated.View entering={FadeInDown.springify()}>
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <View style={themedStyles.sectionHeader}>
                  <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Creative Assets</Text>
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

                {!hasMedia && (
                  <TouchableOpacity 
                    style={[themedStyles.uploadPlaceholder, { borderColor: colors.border }]}
                    onPress={pickMedia}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[themedStyles.uploadPlaceholderText, { color: colors.primary, marginTop: SPACING.sm }]}>
                          Uploading to R2... {Math.round(uploadProgress)}%
                        </Text>
                        <View style={[themedStyles.progressBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              themedStyles.progressFill,
                              { backgroundColor: colors.primary, width: `${uploadProgress}%` }
                            ]}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                          <MaterialCommunityIcons name="image-plus" size={48} color={colors.textMuted} />
                          <Text style={[themedStyles.uploadPlaceholderText, { color: colors.textMuted }]}>
                            Tap to upload image or video
                          </Text>
                          <Text style={[themedStyles.uploadHint, { color: colors.textMuted }]}>
                            Recommended: 1200x628px (1.91:1) or 1080x1080 (1:1)
                          </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {mediaPreview}
                {errors.media && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.media}</Text>}

                {/* Call-to-Action Selection */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Call-to-Action Button</Text>
                <View style={themedStyles.ctaGrid}>
                  {(Object.keys(ctaOptions) as CTAType[]).slice(0, 8).map((cta) => {
                    const active = form.callToAction === cta;
                    return (
                      <TouchableOpacity
                        key={cta}
                        style={[
                          themedStyles.ctaChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.background,
                          },
                        ]}
                        onPress={() => updateField("callToAction", cta)}
                      >
                        <Text style={[themedStyles.ctaChipText, { color: active ? colors.primary : colors.text }]}>
                          {ctaOptions[cta]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Placement Selection */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Ad Placement</Text>
                <View style={themedStyles.placementRow}>
                  {(Object.keys(placementLabels) as AdPlacement[]).map((placement) => {
                    const active = form.placement === placement;
                    const config = placementLabels[placement];
                    return (
                      <TouchableOpacity
                        key={placement}
                        style={[
                          themedStyles.placementCard,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.08) : colors.card,
                          },
                        ]}
                        onPress={() => updateField("placement", placement)}
                      >
                        <MaterialCommunityIcons 
                          name={config.icon as any} 
                          size={24} 
                          color={active ? colors.primary : colors.textMuted} 
                        />
                        <Text style={[themedStyles.placementLabel, { color: active ? colors.primary : colors.text }]}>
                          {config.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 2: Details */}
          {currentStep === "details" && (
            <Animated.View entering={FadeInDown.springify()}>
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Ad Copy</Text>

                <Text style={[themedStyles.label, { color: colors.text }]}>Headline (optional)</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Short attention-grabbing headline"
                  placeholderTextColor={colors.textMuted}
                  value={form.headline}
                  onChangeText={(t) => updateField("headline", t)}
                  maxLength={40}
                />
                <Text style={[themedStyles.charCount, { color: colors.textMuted }]}>{form.headline.length}/40</Text>

                <Text style={[themedStyles.label, { color: colors.text }]}>Title *</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Campaign title (shown in listings)"
                  placeholderTextColor={colors.textMuted}
                  value={form.title}
                  onChangeText={(t) => updateField("title", t)}
                  maxLength={60}
                />
                {errors.title && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.title}</Text>}
                <Text style={[themedStyles.charCount, { color: colors.textMuted }]}>{form.title.length}/60</Text>

                <Text style={[themedStyles.label, { color: colors.text }]}>Description *</Text>
                <TextInput
                  style={[themedStyles.inputMultiline, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Describe your offer - what makes it compelling?"
                  placeholderTextColor={colors.textMuted}
                  value={form.description}
                  onChangeText={(t) => updateField("description", t)}
                  multiline
                  numberOfLines={4}
                  maxLength={240}
                  textAlignVertical="top"
                />
                {errors.description && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.description}</Text>}
                <Text style={[themedStyles.charCount, { color: colors.textMuted }]}>{form.description.length}/240</Text>

                <Text style={[themedStyles.label, { color: colors.text }]}>Destination URL *</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="https://your-website.com/landing-page"
                  placeholderTextColor={colors.textMuted}
                  value={form.targetUrl}
                  onChangeText={(t) => updateField("targetUrl", t)}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                {errors.targetUrl && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.targetUrl}</Text>}

                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Ad Type</Text>
                <View style={themedStyles.chipRow}>
                  {(Object.keys(typeLabels) as FormState["type"][]).map((type) => {
                    const active = form.type === type;
                    const config = typeLabels[type];
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          themedStyles.typeChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.08) : colors.background,
                          },
                        ]}
                        onPress={() => updateField("type", type)}
                      >
                        <Text style={[themedStyles.chipLabel, { color: active ? colors.primary : colors.text }]}>
                          {config.label}
                        </Text>
                        <Text style={[themedStyles.chipDesc, { color: colors.textMuted }]}>
                          {config.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 3: Targeting */}
          {currentStep === "targeting" && (
            <Animated.View entering={FadeInDown.springify()}>
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Audience Targeting</Text>

                {/* Estimated Reach */}
                <View style={[themedStyles.reachCard, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                  <MaterialCommunityIcons name="account-group" size={24} color={colors.primary} />
                  <View style={themedStyles.reachInfo}>
                    <Text style={[themedStyles.reachLabel, { color: colors.textMuted }]}>Estimated Daily Reach</Text>
                    <Text style={[themedStyles.reachValue, { color: colors.primary }]}>
                      {estimatedReach.toLocaleString()} users
                    </Text>
                  </View>
                </View>

                {/* Gender Selection */}
                <Text style={[themedStyles.label, { color: colors.text }]}>Gender</Text>
                <View style={themedStyles.chipRow}>
                  {(["all", "male", "female"] as Gender[]).map((gender) => {
                    const active = form.targetGender === gender;
                    const labels: Record<Gender, string> = { all: "All", male: "Male", female: "Female", other: "Other" };
                    return (
                      <TouchableOpacity
                        key={gender}
                        style={[
                          themedStyles.chip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.08) : colors.background,
                          },
                        ]}
                        onPress={() => updateField("targetGender", gender)}
                      >
                        <Text style={[themedStyles.chipLabel, { color: active ? colors.primary : colors.text }]}>
                          {labels[gender]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Age Ranges */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Age Ranges</Text>
                <View style={themedStyles.ageRangeGrid}>
                  {ageRangeOptions.map((age) => {
                    const active = form.targetAgeRanges.includes(age);
                    return (
                      <TouchableOpacity
                        key={age}
                        style={[
                          themedStyles.ageChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.background,
                          },
                        ]}
                        onPress={() => toggleArrayField("targetAgeRanges", age)}
                      >
                        <Text style={[themedStyles.ageChipText, { color: active ? colors.primary : colors.text }]}>
                          {age}
                        </Text>
                        {active && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Interests */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Interests (optional)</Text>
                <View style={themedStyles.interestsGrid}>
                  {interestCategories.map((interest) => {
                    const active = form.targetInterests.includes(interest);
                    return (
                      <TouchableOpacity
                        key={interest}
                        style={[
                          themedStyles.interestChip,
                          {
                            borderColor: active ? colors.success : colors.border,
                            backgroundColor: active ? withAlpha(colors.success, 0.1) : colors.background,
                          },
                        ]}
                        onPress={() => toggleArrayField("targetInterests", interest)}
                      >
                        <Text style={[themedStyles.interestText, { color: active ? colors.success : colors.text }]}>
                          {interest}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Retargeting */}
                <View style={[themedStyles.switchRow, { marginTop: SPACING.md }]}>
                  <View style={themedStyles.switchLabel}>
                    <Text style={[themedStyles.label, { color: colors.text, marginBottom: 0 }]}>Enable Retargeting</Text>
                    <Text style={[themedStyles.switchHint, { color: colors.textMuted }]}>
                      Show ads to users who previously interacted
                    </Text>
                  </View>
                  <Switch
                    value={form.enableRetargeting}
                    onValueChange={(value) => updateField("enableRetargeting", value)}
                    trackColor={{ true: withAlpha(colors.primary, 0.4), false: colors.border }}
                    thumbColor={form.enableRetargeting ? colors.primary : colors.textMuted}
                  />
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 4: Budget */}
          {currentStep === "budget" && (
            <Animated.View entering={FadeInDown.springify()}>
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Budget & Schedule</Text>

                {/* Pricing Model */}
                <Text style={[themedStyles.label, { color: colors.text }]}>Pricing Model</Text>
                <View style={themedStyles.pricingGrid}>
                  {(Object.keys(pricingLabels) as PricingModel[]).map((model) => {
                    const active = form.pricingModel === model;
                    const config = pricingLabels[model];
                    return (
                      <TouchableOpacity
                        key={model}
                        style={[
                          themedStyles.pricingCard,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? withAlpha(colors.primary, 0.08) : colors.card,
                          },
                        ]}
                        onPress={() => updateField("pricingModel", model)}
                      >
                        <Text style={[themedStyles.pricingLabel, { color: active ? colors.primary : colors.text }]}>
                          {config.label}
                        </Text>
                        <Text style={[themedStyles.pricingDesc, { color: colors.textMuted }]}>
                          {config.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Budget Amount */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Total Budget (UGX) *</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g., 500000"
                  placeholderTextColor={colors.textMuted}
                  value={form.budget}
                  onChangeText={(t) => updateField("budget", t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />
                {errors.budget && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.budget}</Text>}

                {/* Bid Amount */}
                <Text style={[themedStyles.label, { color: colors.text }]}>
                  Bid Amount (UGX per {form.pricingModel === "cpm" ? "1,000 impressions" : form.pricingModel === "cpc" ? "click" : "action"}) *
                </Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder={form.pricingModel === "cpm" ? "e.g., 5000" : "e.g., 500"}
                  placeholderTextColor={colors.textMuted}
                  value={form.bidAmount}
                  onChangeText={(t) => updateField("bidAmount", t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />
                {errors.bidAmount && <Text style={[themedStyles.error, { color: colors.error }]}>{errors.bidAmount}</Text>}

                {/* Daily Budget Limit */}
                <Text style={[themedStyles.label, { color: colors.text }]}>Daily Budget Limit (optional)</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="Leave empty for no daily limit"
                  placeholderTextColor={colors.textMuted}
                  value={form.dailyBudgetLimit}
                  onChangeText={(t) => updateField("dailyBudgetLimit", t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />

                {/* Estimated Performance */}
                {Number(form.budget) > 0 && Number(form.bidAmount) > 0 && (
                  <View style={[themedStyles.estimateCard, { backgroundColor: withAlpha(colors.success, 0.08) }]}>
                    <Text style={[themedStyles.estimateTitle, { color: colors.success }]}>Estimated Performance</Text>
                    <View style={themedStyles.estimateGrid}>
                      <View style={themedStyles.estimateItem}>
                        <Text style={[themedStyles.estimateValue, { color: colors.text }]}>
                          {estimatedCost.impressions.toLocaleString()}
                        </Text>
                        <Text style={[themedStyles.estimateLabel, { color: colors.textMuted }]}>Impressions</Text>
                      </View>
                      <View style={themedStyles.estimateItem}>
                        <Text style={[themedStyles.estimateValue, { color: colors.text }]}>
                          {estimatedCost.clicks.toLocaleString()}
                        </Text>
                        <Text style={[themedStyles.estimateLabel, { color: colors.textMuted }]}>Est. Clicks</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Schedule */}
                <Text style={[themedStyles.label, { color: colors.text, marginTop: SPACING.md }]}>Campaign Schedule</Text>
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
                    minimumDate={new Date()}
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
                    minimumDate={form.startDate || new Date()}
                    onChange={(_, date) => {
                      setShowEndPicker(false);
                      if (date) updateField("endDate", date);
                    }}
                  />
                )}

                {/* Advanced Settings */}
                <Text style={[themedStyles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>Advanced</Text>
                
                <View style={themedStyles.switchRow}>
                  <View style={themedStyles.switchLabel}>
                    <Text style={[themedStyles.label, { color: colors.text, marginBottom: 0 }]}>Sponsored Label</Text>
                    <Text style={[themedStyles.switchHint, { color: colors.textMuted }]}>
                      Shows "Sponsored" badge on ad
                    </Text>
                  </View>
                  <Switch
                    value={form.sponsored}
                    onValueChange={(value) => updateField("sponsored", value)}
                    trackColor={{ true: withAlpha(colors.primary, 0.4), false: colors.border }}
                    thumbColor={form.sponsored ? colors.primary : colors.textMuted}
                  />
                </View>

                <View style={themedStyles.switchRow}>
                  <View style={themedStyles.switchLabel}>
                    <Text style={[themedStyles.label, { color: colors.text, marginBottom: 0 }]}>Start Immediately</Text>
                    <Text style={[themedStyles.switchHint, { color: colors.textMuted }]}>
                      Ad goes live after approval
                    </Text>
                  </View>
                  <Switch
                    value={form.isActive}
                    onValueChange={(value) => updateField("isActive", value)}
                    trackColor={{ true: withAlpha(colors.primary, 0.4), false: colors.border }}
                    thumbColor={form.isActive ? colors.primary : colors.textMuted}
                  />
                </View>

                {/* Frequency Cap */}
                <Text style={[themedStyles.label, { color: colors.text }]}>Frequency Cap (per user/day)</Text>
                <TextInput
                  style={[themedStyles.input, { borderColor: colors.border, color: colors.text }]}
                  placeholder="3"
                  placeholderTextColor={colors.textMuted}
                  value={form.frequencyCap}
                  onChangeText={(t) => updateField("frequencyCap", t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  maxLength={2}
                />

                {/* Priority Slider */}
                <Text style={[themedStyles.label, { color: colors.text }]}>Priority: {form.priority}/10</Text>
                <View style={themedStyles.priorityRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        themedStyles.priorityDot,
                        { backgroundColor: p <= form.priority ? colors.primary : colors.border },
                      ]}
                      onPress={() => updateField("priority", p)}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 5: Review */}
          {currentStep === "review" && (
            <Animated.View entering={FadeInDown.springify()}>
              {/* Ad Preview */}
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Ad Preview</Text>
                {mediaPreview}
                <Text style={[themedStyles.previewTitle, { color: colors.text }]}>
                  {form.headline || form.title || "Your Ad Title"}
                </Text>
                <Text style={[themedStyles.previewDesc, { color: colors.textMuted }]} numberOfLines={2}>
                  {form.description || "Your ad description will appear here"}
                </Text>
              </View>

              {/* Campaign Summary */}
              <View style={[themedStyles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: SPACING.md }]}> 
                <Text style={[themedStyles.sectionTitle, { color: colors.text }]}>Campaign Summary</Text>
                
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Ad Type</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{typeLabels[form.type].label}</Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Placement</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{placementLabels[form.placement].label}</Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Call-to-Action</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{ctaOptions[form.callToAction]}</Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Target Audience</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>
                    {form.targetGender === "all" ? "All genders" : form.targetGender}, {form.targetAgeRanges.join(", ")}
                  </Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Pricing Model</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>{pricingLabels[form.pricingModel].label}</Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Total Budget</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.primary }]}>
                    UGX {Number(form.budget || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Schedule</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.text }]}>
                    {form.startDate ? form.startDate.toLocaleDateString() : "ASAP"} → {form.endDate ? form.endDate.toLocaleDateString() : "Ongoing"}
                  </Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Est. Reach</Text>
                  <Text style={[themedStyles.reviewValue, { color: colors.success }]}>
                    ~{estimatedReach.toLocaleString()} users/day
                  </Text>
                </View>
                <View style={themedStyles.reviewRow}>
                  <Text style={[themedStyles.reviewLabel, { color: colors.textMuted }]}>Status</Text>
                  <Text style={[themedStyles.reviewValue, { color: form.isActive ? colors.success : colors.warning }]}>
                    {form.isActive ? "Will go live after approval" : "Paused (manual activation)"}
                  </Text>
                </View>
              </View>

              {/* Terms */}
              <View style={[themedStyles.termsCard, { backgroundColor: withAlpha(colors.warning, 0.08), borderColor: colors.warning }]}> 
                <Ionicons name="information-circle" size={20} color={colors.warning} />
                <Text style={[themedStyles.termsText, { color: colors.text }]}>
                  By creating this campaign, you agree to our Advertising Policies. Ads are subject to review and may be rejected if they violate our guidelines.
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer Navigation */}
        <View style={[themedStyles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={themedStyles.footerButtons}>
            {!isFirstStep && (
              <TouchableOpacity
                style={[themedStyles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={18} color={colors.text} />
                <Text style={[themedStyles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={themedStyles.footerSpacer} />
            {isLastStep ? (
              <PrimaryButton
                title={submitting ? "Creating..." : "Launch Campaign"}
                onPress={handleSubmit}
                disabled={submitting || uploading}
              />
            ) : (
              <TouchableOpacity
                style={[themedStyles.primaryButtonCustom, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (validateStep(currentStep)) {
                    handleNext();
                  }
                }}
              >
                <Text style={themedStyles.primaryButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
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
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
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
    // Step Indicator Styles
    stepIndicator: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepItem: {
      alignItems: "center",
      flex: 1,
    },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      marginBottom: 4,
    },
    stepNumber: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    stepLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: 10,
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
      marginBottom: SPACING.xs,
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
      minHeight: 100,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    charCount: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      textAlign: "right",
      marginTop: 2,
    },
    error: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      marginTop: 2,
    },
    // Upload Placeholder
    uploadPlaceholder: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: RADIUS.lg,
      padding: SPACING.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 160,
    },
    uploadPlaceholderText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.base,
      marginTop: SPACING.md,
    },
    uploadHint: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      marginTop: SPACING.xs,
    },
    progressBar: {
      width: "80%",
      height: 4,
      borderRadius: 2,
      marginTop: SPACING.md,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    // CTA Grid
    ctaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.xs,
      marginTop: SPACING.xs,
    },
    ctaChip: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    ctaChipText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    ctaOverlay: {
      position: "absolute",
      bottom: SPACING.md,
      left: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
    },
    ctaOverlayText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: "#FFFFFF",
    },
    // Placement Row
    placementRow: {
      flexDirection: "row",
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    placementCard: {
      flex: 1,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 70,
    },
    placementLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
      marginTop: SPACING.xs,
    },
    // Chip Row
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
      marginVertical: SPACING.xs,
    },
    chip: {
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
    chipDesc: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      marginTop: 2,
    },
    typeChip: {
      flex: 1,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: "center",
    },
    // Targeting Styles
    reachCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.md,
    },
    reachInfo: {
      marginLeft: SPACING.md,
    },
    reachLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    reachValue: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
    },
    ageRangeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    ageChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    ageChipText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    interestsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.xs,
    },
    interestChip: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    interestText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    // Switch Row
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: SPACING.sm,
    },
    switchLabel: {
      flex: 1,
      marginRight: SPACING.md,
    },
    switchHint: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      marginTop: 2,
    },
    // Pricing Grid
    pricingGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    pricingCard: {
      width: "48%",
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: "center",
    },
    pricingLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.base,
    },
    pricingDesc: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
      textAlign: "center",
      marginTop: 2,
    },
    // Estimate Card
    estimateCard: {
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      marginTop: SPACING.md,
    },
    estimateTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginBottom: SPACING.sm,
    },
    estimateGrid: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    estimateItem: {
      alignItems: "center",
    },
    estimateValue: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.xl,
    },
    estimateLabel: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    // Date Row
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
    // Priority Row
    priorityRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: SPACING.sm,
    },
    priorityDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    // Review Styles
    reviewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    previewTitle: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.lg,
      marginTop: SPACING.md,
    },
    previewDesc: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.sm,
      marginTop: SPACING.xs,
    },
    termsCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      marginTop: SPACING.md,
    },
    termsText: {
      flex: 1,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    // Preview Styles
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
    // Footer Styles
    footer: {
      borderTopWidth: 1,
      padding: SPACING.md,
      borderColor: colors.border,
    },
    footerButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    footerSpacer: {
      flex: 1,
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
    },
    secondaryButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
    primaryButtonCustom: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.md,
    },
    primaryButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: "#FFFFFF",
    },
  });
