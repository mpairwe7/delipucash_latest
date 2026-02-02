/**
 * Services barrel export
 * 
 * Architecture:
 * - API modules: Raw API calls (surveyApi, videoApi, etc.)
 * - Hooks: TanStack Query hooks for data fetching
 * - Use TanStack Query hooks in components, not raw API calls
 * 
 * Note: Some modules have overlapping exports. We use explicit re-exports
 * to avoid conflicts and prefer newer implementations over legacy ones.
 */

// Core API - main unified API object
export { default as api } from "./api";

// Utility functions from api module
export {
    formatCurrency,
    formatDate,
    formatRelativeTime,
    formatDuration,
    paymentMethods,
} from "./api";

// Legacy hooks from ./hooks (excluding video hooks that are in videoHooks)
export {
    // Query keys
    queryKeys,
    // Survey hooks
    useSurveys,
    useRunningSurveys,
    useSurvey,
    useSubmitSurvey,
    useCheckSurveyAttempt,
    // Question hooks
    useQuestions,
    useQuestion,
    // User hooks
    useUserProfile,
    // Comment hooks
    useAddComment,
    useUnlikeVideo,
    useShareVideo,
    // Search
    useSearchVideos,
    // Types
    type SharePlatform,
} from "./hooks";

// Mock auth
export * from "./mockAuth";

// Support API
export * from "./supportApi";

// Notification API
export * from "./notificationApi";

// Survey API
export { default as surveyApi } from "./surveyApi";

// Video API
export { default as videoApi } from "./videoApi";

// Question API
export { default as questionApi } from "./questionApi";

// Survey Payment
export { default as surveyPaymentApi } from "./surveyPaymentApi";
export * from "./surveyPaymentHooks";

// Ad Services
export { default as adApi } from "./adApi";

// ============================================================================
// Ad TanStack Query Hooks (NEW - Industry Standard)
// Use these hooks with AdUIStore for proper state separation
// ============================================================================
export * from "./adHooksRefactored";

// ============================================================================
// Legacy Ad Hooks (deprecated - kept for backward compatibility)
// TODO: Migrate remaining usages to adHooksRefactored + AdUIStore
// ============================================================================
export {
    // Re-export with deprecated naming to avoid conflicts
    useAds as useLegacyAds,
    useFeaturedAds as useLegacyFeaturedAds,
    useBannerAds as useLegacyBannerAds,
    useVideoAds as useLegacyVideoAds,
    useAdById as useLegacyAdById,
    useAdsForPlacement as useLegacyAdsForPlacement,
    useRandomAd as useLegacyRandomAd,
    useTrackAdClick as useLegacyTrackAdClick,
    useTrackAdImpression as useLegacyTrackAdImpression,
    useCreateAd as useLegacyCreateAd,
    useUpdateAd as useLegacyUpdateAd,
    useDeleteAd as useLegacyDeleteAd,
    useAdImpressionTracking as useLegacyAdImpressionTracking,
    useAdRotation as useLegacyAdRotation,
} from "./adHooks";

// Survey Response TanStack Query Hooks (NEW - Industry Standard)
export * from "./surveyResponseHooks";

// ============================================================================
// Video TanStack Query Hooks (Industry Standard)
// Centralized video hooks with optimistic updates and caching
// These are the preferred video hooks - use instead of legacy hooks
// ============================================================================
export * from "./videoHooks";
export { default as videoHooks } from "./videoHooks";

// ============================================================================
// RevenueCat Purchases (Google Play Billing / App Store)
// ============================================================================
export { purchasesService, default as purchasesServiceInstance } from "./purchasesService";
export * from "./purchasesHooks";

// ============================================================================
// Cloudflare R2 Storage (Industry Standard)
// Video, thumbnail, and livestream storage with signed URLs
// ============================================================================
export {
    // Upload functions
    validateUpload,
    uploadVideoToR2,
    uploadMediaToR2,
    uploadThumbnailToR2,
    uploadAdMediaToR2,
    getPresignedUploadUrl,
    uploadToPresignedUrl,
    uploadLivestreamChunk,
    finalizeLivestreamRecording,
    getSignedPlaybackUrl,
    // Types
    type VideoUploadResult,
    type ThumbnailUploadResult,
    type PresignedUploadResult,
    type ValidateUploadResult,
    type UploadProgressEvent,
    type AdMediaUploadResult,
} from "./r2UploadService";

export {
    // Query keys
    r2QueryKeys,
    // Hooks
    useValidateR2Upload,
    useUploadVideoToR2,
    useUploadMediaToR2,
    useUploadThumbnailToR2,
    useUploadAdMediaToR2,
    useGetPresignedUploadUrl,
    useUploadToPresignedUrl,
    useUploadLivestreamChunk,
    useFinalizeLivestreamRecording,
    useGetSignedPlaybackUrl,
    useR2VideoUpload,
    // Types
    type UseUploadVideoParams,
    type UseUploadMediaParams,
    type UseUploadThumbnailParams,
    type UseUploadAdMediaParams,
    type UploadHookResult,
} from "./r2UploadHooks";