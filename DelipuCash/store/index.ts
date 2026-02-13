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
  selectPageSize,
  selectLastSyncedAt,
  // Object selectors (use with useShallow)
  selectResponseNavigation,
  selectFilterState,
  // Convenience hooks (pre-wrapped with useShallow)
  useResponseNavigation,
  useFilterState,
} from './SurveyResponseUIStore';

// ============================================================================
// Survey UI Store (NEW - Industry Standard)
// Survey creation, builder, sharing, view preferences
// ============================================================================
export {
  useSurveyUIStore,
  // Atomic selectors (stable — no new objects)
  selectActiveTab as selectSurveyActiveTab,
  selectFilters as selectSurveyFilters,
  selectCreationMode,
  selectDrafts as selectSurveyDrafts,
  selectShowShareModal,
  selectShowCreationModal,
  selectBuilderViewMode,
  selectCurrentDraftId,
  selectHasUnsavedChanges,
  selectCardViewStyle,
  selectShareTargetSurveyId,
  selectHasSeenOnboarding,
  // Object selectors (use with useShallow)
  selectAccessibilityPrefs,
  selectCreationState,
  selectShareState,
  selectViewPreferences,
  // Convenience hooks (pre-wrapped with useShallow)
  useAccessibilityPrefs,
  useCreationState,
  useShareState,
  useViewPreferences,
  // Constants
  TEMPLATE_CATEGORIES,
  FEATURED_TEMPLATES,
} from './SurveyUIStore';
export type {
  SurveyUIState,
  SurveyUIActions,
  TemplateCategory,
  SurveyTemplate,
} from './SurveyUIStore';

// ============================================================================
// Survey Attempt Store (NEW - Industry Standard)
// Draft auto-save, progress tracking, submission guard
// Use with TanStack Query hooks for server state
// ============================================================================
export {
  useSurveyAttemptStore,
  // Atomic selectors (stable — no new objects)
  selectActiveSurveyId,
  selectAnswers,
  selectCurrentIndex as selectAttemptCurrentIndex,
  selectTotalQuestions,
  selectSubmissionStatus,
  selectSubmissionError,
  selectSubmittedReward,
  selectDrafts as selectAttemptDrafts,
  selectIsSubmitting as selectAttemptIsSubmitting,
  selectStartedAt,
  selectLastSavedAt,
  selectHasActiveAttempt,
  // Parameterized selectors
  selectIsAnswered,
  selectHasDraft,
  // Derived selectors
  selectAnsweredCount,
  selectProgress as selectAttemptProgress,
  // Object selectors (use with useShallow)
  selectAttemptProgress as selectAttemptProgressState,
  selectSubmissionState,
  selectTimingState,
  // Convenience hooks (pre-wrapped with useShallow)
  useAttemptProgress,
  useSubmissionState,
} from './SurveyAttemptStore';
export type {
  AnswerValue,
  DraftAnswers,
  SurveyAttemptDraft,
  SubmissionStatus,
  SurveyAttemptState,
  SurveyAttemptActions,
} from './SurveyAttemptStore';

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
  // Atomic selectors (stable — no new objects)
  selectCurrentQuestion,
  selectSessionState,
  selectCurrentIndex,
  selectQuestionsCount,
  selectTotalPoints,
  selectCurrentStreak,
  selectMaxStreak,
  selectTimeRemaining,
  selectIsTimerActive,
  selectIsAnswerRevealed,
  selectSelectedAnswer,
  selectIsTransitioning,
  selectShowSessionSummary,
  selectSessionSummary,
  selectQuizError,
  selectIsSubmitting,
  selectCanStartNewSession,
  selectHasAttemptedQuestion,
  selectHasCompletedSession,
  // Object selectors (use with useShallow)
  selectProgress,
  selectAnswerState,
  selectScoreState,
  selectTimerState,
  selectPointsState,
  selectRedemptionState,
  selectAttemptHistory,
  // Pure function
  computeSessionSummary,
  // Convenience hooks (pre-wrapped with useShallow)
  useQuizProgress,
  useQuizScore,
  useQuizTimer,
  useQuizAnswer,
  useQuizRedemption,
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
  REWARD_CONSTANTS,
  // Atomic selectors (stable — no new objects)
  selectAttemptHistory as selectInstantRewardAttemptHistory,
  selectHasAttempted,
  selectAttemptedCount,
  selectTotalRewardsEarned,
  selectCanRedeem,
  selectInstantSessionState,
  selectCurrentQuestionId,
  selectInstantSelectedAnswer,
  selectInstantIsSubmitting,
  selectInstantLastResult,
  selectInstantError,
  selectWalletBalance,
  selectPendingRewards,
  selectIsRedeeming,
  selectInstantSessionSummary,
  selectIsOnline,
  selectIsSessionActive,
  selectHasPendingSubmissions,
  selectPendingSubmissionForQuestion,
  // Object selectors (use with useShallow)
  selectWalletState,
  selectCurrentQuestionState,
  selectSessionState as selectInstantRewardSessionState,
  selectRedemptionState as selectInstantRedemptionState,
  selectOfflineQueueState,
  // Convenience hooks (pre-wrapped with useShallow)
  useWalletState,
  useCurrentQuestionState,
  useInstantSessionState,
  useInstantRedemptionState,
  useOfflineQueueState,
  // Unit conversion helpers
  cashToPoints,
  pointsToCash,
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
  // Selectors — Upload
  selectPremiumStatus,
  selectHasVideoPremium,
  selectMaxUploadSize,
  selectMaxRecordingDuration,
  selectMaxLivestreamDuration,
  selectCurrentUpload,
  selectUploadHistory,
  selectIsUploading,
  // Selectors — Recording
  selectCurrentRecording,
  selectRecordingHistory,
  selectIsRecording,
  // Selectors — Livestream
  selectCurrentLivestream,
  selectLivestreamHistory,
  selectIsLive,
  // Selectors — UI
  selectActiveWarning,
  selectShowUpgradePrompt,
  selectLastError,
  // Selectors — Trending Slider
  selectTrendingSlider,
  selectTrendingSliderIndex,
  // Selectors — Player
  selectPlayer,
  selectCurrentVideoId,
  selectIsPlaying,
  selectIsMuted,
  // Selectors — Watch History & Queue
  selectWatchHistory,
  selectRecentlyWatched,
  selectVideoQueue,
  selectQueueLength,
  // Selectors — Liked (aliased to avoid collision with VideoFeedStore)
  selectLikedVideoIds as selectVideoStoreLikedVideoIds,
  // Computed selectors
  selectUploadProgress,
  selectRecordingProgress,
  selectLivestreamProgress,
  selectLivestreamStatus,
  // Convenience hooks (pre-wrapped with useShallow)
  useVideoPremiumStatus,
  useVideoTrendingSlider,
  useVideoPlayer,
  useVideoUploadProgress,
  useVideoRecordingProgress,
  useVideoLivestreamStatus,
  useVideoLivestreamProgress,
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

// ============================================================================
// Question UI Store - Tab persistence for question screen
// ============================================================================
export {
  useQuestionUIStore,
  selectSelectedTab,
} from './QuestionUIStore';

// ============================================================================
// Question Answer Store - Answer draft & submission state
// ============================================================================
export {
  useQuestionAnswerStore,
  ANSWER_MAX_LENGTH,
  ANSWER_MIN_LENGTH,
  selectActiveQuestionId,
  selectDraftText,
  selectRemainingChars,
  selectIsValidLength,
  selectWasSubmitted,
} from './QuestionAnswerStore';
export type {} from './QuestionAnswerStore';

// ============================================================================
// Video Feed Store (NEW 2025 - TikTok/Reels/Shorts Style)
// Advanced video feed orchestration with visibility-based playback
// ============================================================================
export {
  useVideoFeedStore,
  // Constants
  AUTOPLAY_VISIBILITY_THRESHOLD,
  PAUSE_VISIBILITY_THRESHOLD,
  PRELOAD_AHEAD_COUNT,
  PRELOAD_BEHIND_COUNT,
  SNAP_TO_INTERVAL_RATIO,
  // Selectors
  selectActiveVideo,
  selectFeedMode,
  selectActiveTab as selectFeedActiveTab,
  selectVideos,
  selectUI,
  selectGesture,
  selectLikedVideoIds,
  selectBookmarkedVideoIds,
  // Derived Selectors
  selectIsVideoLiked,
  selectIsVideoBookmarked,
  selectIsActiveVideo,
  selectShouldVideoPlay,
  // Lifecycle Selectors
  selectIsScreenFocused,
  selectIsAppActive,
  selectIsPlaybackAllowed,
  // Convenience hooks (pre-wrapped with useShallow)
  useActiveVideo,
  useFeedUI,
  useFeedGesture,
} from './VideoFeedStore';
export type {
  FeedMode,
  FeedTab,
  PlayerStatus,
  VideoVisibility,
  ActiveVideoState,
  GestureState,
  PreloadState,
  FeedUIState,
  VideoFeedState,
  VideoFeedActions,
} from './VideoFeedStore';

// ============================================================================
// SSE Connection Store — Real-time event connection state
// ============================================================================
export {
  useSSEStore,
  selectSSEStatus,
  selectSSEConnected,
  selectSSEEnabled,
} from './SSEStore';
export type {
  SSEState,
  SSEActions,
} from './SSEStore';
