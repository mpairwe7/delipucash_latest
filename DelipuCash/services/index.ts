/**
 * Services barrel export
 * 
 * Architecture:
 * - API modules: Raw API calls (surveyApi, videoApi, etc.)
 * - Hooks: TanStack Query hooks for data fetching
 * - Use TanStack Query hooks in components, not raw API calls
 */

export * from "./api";
export { default as api } from "./api";
export * from "./hooks";
export * from "./mockAuth";
export * from "./supportApi";
export * from "./notificationApi";
export * from "./surveyApi";
export { default as surveyApi } from "./surveyApi";
export * from "./videoApi";
export { default as videoApi } from "./videoApi";
export * from "./questionApi";
export { default as questionApi } from "./questionApi";
export * from "./surveyPaymentApi";
export { default as surveyPaymentApi } from "./surveyPaymentApi";
export * from "./surveyPaymentHooks";

// Ad Services
export * from "./adApi";
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
    useRecordAdClick as useLegacyRecordAdClick,
    useRecordAdImpression as useLegacyRecordAdImpression,
    useAdRefreshOnFocus as useLegacyAdRefreshOnFocus,
    useAdPreferences as useLegacyAdPreferences,
    usePageAds as useLegacyPageAds,
} from "./adHooks";

// Survey Response TanStack Query Hooks (NEW - Industry Standard)
export * from "./surveyResponseHooks";