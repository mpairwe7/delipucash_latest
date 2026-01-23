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

// ============================================================================
// Quiz Store (NEW - Industry Standard)
// Use with TanStack Query hooks for server state
// ============================================================================
export {
  useQuizStore,
  // Selectors
  selectCurrentQuestion,
  selectProgress,
  selectAnswerState,
  selectScoreState,
  selectTimerState,
  selectPointsState,
  selectRedemptionState,
  selectAttemptHistory,
  selectCanStartNewSession,
} from './QuizStore';
export type {
  AnswerType,
  AnswerOption,
  NormalizedQuestion,
  QuizSessionProgress,
  QuizUIState,
  QuizUIActions,
  AttemptedQuestion,
  QuizAttemptHistory,
} from './QuizStore';

// ============================================================================
// Instant Reward Store (NEW - Industry Standard)
// Tracks single-attempt instant reward questions
// ============================================================================
export {
  useInstantRewardStore,
  // Selectors
  selectAttemptHistory as selectInstantRewardAttemptHistory,
  selectHasAttempted,
  selectAttemptedCount,
  selectTotalRewardsEarned,
  selectWalletState,
  selectCurrentQuestionState,
} from './InstantRewardStore';
export type {
  AttemptedRewardQuestion,
  InstantRewardAttemptHistory,
  InstantRewardUIState,
  InstantRewardUIActions,
} from './InstantRewardStore';

// ============================================================================
// Video Store (NEW - Industry Standard)
// Manages video upload, recording, livestream state and premium limits
// ============================================================================
export {
  useVideoStore,
  // Constants
  FREE_UPLOAD_LIMIT_BYTES,
  PREMIUM_UPLOAD_LIMIT_BYTES,
  FREE_LIVESTREAM_LIMIT_SECONDS,
  PREMIUM_LIVESTREAM_LIMIT_SECONDS,
  PREMIUM_RECORDING_LIMIT_SECONDS,
  // Selectors
  selectPremiumStatus,
  selectHasVideoPremium,
  selectMaxUploadSize,
  selectMaxRecordingDuration,
  selectMaxLivestreamDuration,
  selectCurrentUpload,
  selectUploadHistory,
  selectIsUploading,
  selectCurrentRecording,
  selectRecordingHistory,
  selectIsRecording,
  selectCurrentLivestream,
  selectLivestreamHistory,
  selectIsLive,
  selectActiveWarning,
  selectShowUpgradePrompt,
  selectLastError,
  // Computed selectors
  selectUploadProgress,
  selectRecordingProgress,
  selectLivestreamProgress,
} from './VideoStore';
export type {
  UploadStatus,
  RecordingStatus,
  LivestreamStatus,
  VideoUploadProgress,
  RecordingSession,
  LivestreamSession,
  VideoPremiumStatus,
  VideoLimitsWarning,
  VideoState,
  VideoActions,
} from './VideoStore';
