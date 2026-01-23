/**
 * Store Index
 * Export all Zustand stores
 * 
 * Architecture:
 * - Zustand: Client-side UI state (view preferences, filters, navigation)
 * - TanStack Query: Server state (data fetching, caching, sync)
 */

// ============================================================================
// Ad UI Store (NEW - Industry Standard)
// Use with TanStack Query hooks for server state
// ============================================================================
export {
  useAdUIStore,
  // Helper functions for ad processing
  filterAdsByPreferences,
  sortAdsByPriority,
  getRandomAdFromPool,
} from './AdUIStore';
export type {
  AdPreferences,
  LocalAdImpression,
  LocalAdMetrics,
  AdUIState,
  AdUIActions,
} from './AdUIStore';

// Ad UI Selectors
export {
  selectAdPreferences,
  selectPersonalizedAds,
  selectAdFrequency,
  selectBlockedAdvertisers,
  selectBlockedCategories,
  selectLocalMetrics,
  selectAdQueue,
  selectCurrentQueueIndex,
  selectDismissedAdIds,
  selectIsAdModalVisible,
  selectCurrentModalAd,
} from './AdUIStore';

// ============================================================================
// Legacy Ad Store (deprecated - kept for backward compatibility)
// TODO: Migrate remaining usages to TanStack Query + AdUIStore
// ============================================================================
export { useAdStore } from './AdStore';
export type { 
  AdType, 
  AdPlacement, 
  AdStatus, 
  AdMetrics, 
  // Note: AdPreferences is now exported from AdUIStore
  AdImpression,
  AdState,
  AdActions,
  Ad,
} from './AdStore';

// Legacy Ad Selectors (deprecated - prefer AdUIStore selectors)
export {
  selectActiveAds,
  selectFeaturedAds,
  selectBannerAds,
  selectVideoAds,
  selectAdMetrics as selectLegacyAdMetrics,
  selectTotalImpressions,
  selectAdPreferences as selectLegacyAdPreferences,
} from './AdStore';

// ============================================================================
// Survey Response UI Store (NEW - Industry Standard)
// Use with TanStack Query hooks for server state
// ============================================================================
export {
  useSurveyResponseUIStore,
  // Helper functions for computed data
  parseResponseData,
  parseResponses,
  filterResponses,
  computeQuestionAggregate,
  computeAnalytics,
  exportToCSV,
  exportToJSON,
  exportToPDFHtml,
} from './SurveyResponseUIStore';
export type {
  ResponseFilters,
  QuestionAggregate,
  SurveyAnalytics,
  ParsedResponse,
  SurveyResponseUIState,
  SurveyResponseUIActions,
} from './SurveyResponseUIStore';

// Survey Response UI Selectors
export {
  selectViewMode,
  selectFilters,
  selectSearchQuery,
  selectCurrentResponseIndex,
  selectExpandedQuestionId,
  selectHasFilters,
} from './SurveyResponseUIStore';

// Legacy Survey Response Store (deprecated - kept for backward compatibility)
// TODO: Migrate remaining usages to TanStack Query + SurveyResponseUIStore
export { useSurveyResponseStore } from './SurveyStore';
export type {
  SurveyResponseState,
  SurveyResponseActions,
} from './SurveyStore';

// Legacy selectors (deprecated)
export {
  selectCurrentSurvey,
  selectResponses,
  selectAnalytics,
  selectIsLoading,
  selectError,
  selectCurrentResponse,
  selectResponseCount,
} from './SurveyStore';
