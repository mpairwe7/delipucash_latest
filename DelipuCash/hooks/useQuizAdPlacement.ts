/**
 * useQuizAdPlacement — Quiz-Specific Ad Placement Hook
 *
 * Wraps useSmartAdPlacement + useShouldShowAds + useScreenAds to provide
 * quiz-flow-specific ad logic with frequency capping per session.
 *
 * Rules:
 * - Ads only shown AFTER answer submission (never during answering)
 * - Frequency cap: 1 ad per MIN_QUESTIONS_BETWEEN_ADS questions answered
 * - Premium users see zero ads
 * - Data-saver aware: skip ad fetch when data saver is on
 * - Respects IAB frequency manager + user fatigue
 *
 * @example
 * ```tsx
 * const { postAnswerAd, sessionSummaryAd, shouldShowPostAnswerAd, recordQuestionAnswered } =
 *   useQuizAdPlacement({ contextType: 'rewards' });
 *
 * // After user submits answer:
 * recordQuestionAnswered();
 * if (shouldShowPostAnswerAd) {
 *   return <PostQuestionAdSlot ad={postAnswerAd} />;
 * }
 * ```
 */

import { useCallback, useRef, useMemo, useState } from 'react';
import { useShouldShowAds } from '@/services/useShouldShowAds';
import { useScreenAds } from '@/services/adHooksRefactored';
import { useSmartAdPlacement, type AdContextType } from '@/services/useSmartAdPlacement';
import type { Ad } from '@/types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum questions between post-answer ads (Duolingo/Kahoot standard) */
const MIN_QUESTIONS_BETWEEN_ADS = 3;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuizAdPlacementConfig {
  /** Context for ad targeting — 'rewards' for reward questions, 'questions' for Q&A */
  contextType: AdContextType;
  /** Whether the user has submitted an answer (gates post-answer ad visibility) */
  hasSubmitted?: boolean;
  /** Whether ads are enabled for this screen (e.g. false during loading) */
  enabled?: boolean;
}

export interface QuizAdPlacementResult {
  /** Ad to show after answer submission */
  postAnswerAd: Ad | null;
  /** Ad to show in session summary */
  sessionSummaryAd: Ad | null;
  /** Whether to render the post-answer ad slot */
  shouldShowPostAnswerAd: boolean;
  /** Whether to render the session summary ad */
  shouldShowSessionAd: boolean;
  /** Call after each question is answered to update frequency counter */
  recordQuestionAnswered: () => void;
  /** Whether ad data is still loading */
  isLoading: boolean;
  /** Track impression for analytics */
  trackPostAnswerImpression: () => Promise<void>;
  /** Track impression for session ad */
  trackSessionImpression: () => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useQuizAdPlacement({
  contextType,
  hasSubmitted = false,
  enabled = true,
}: QuizAdPlacementConfig): QuizAdPlacementResult {
  // ── Premium gating ──
  const { shouldShowAds, isLoading: premiumLoading } = useShouldShowAds();

  // ── Session frequency tracking ──
  // State-based counter so React re-evaluates visibility when it changes.
  // Ref tracks the question index when the last ad was shown (no re-render needed).
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const lastAdShownAtRef = useRef(0);

  const adsEnabled = enabled && shouldShowAds && !premiumLoading;

  // ── Fetch ad data (deferred until premium check resolves) ──
  // Both quiz contexts use the 'question' placement for ad fetching.
  const { data: screenAds, isLoading: adsLoading } = useScreenAds('question', {
    feedLimit: 2,
    bannerLimit: 1,
    featuredLimit: 1,
    enabled: adsEnabled,
  });

  // ── Smart placement check for post-answer slot ──
  const postAnswerPlacement = useSmartAdPlacement({
    placementType: 'between_content',
    contextType,
    position: questionsAnswered,
    adId: screenAds?.feedAds?.[0]?.id ?? 'quiz-post-answer',
    forceShow: false,
  });

  // ── Smart placement check for session summary slot ──
  const sessionPlacement = useSmartAdPlacement({
    placementType: 'interstitial',
    contextType: 'results',
    position: 0,
    adId: screenAds?.bannerAds?.[0]?.id ?? screenAds?.feedAds?.[1]?.id ?? 'quiz-session-summary',
    forceShow: false,
  });

  // ── Determine which ads to show ──
  const postAnswerAd = useMemo<Ad | null>(() => {
    if (!adsEnabled || !screenAds?.feedAds?.length) return null;
    return screenAds.feedAds[0];
  }, [adsEnabled, screenAds?.feedAds]);

  const sessionSummaryAd = useMemo<Ad | null>(() => {
    if (!adsEnabled) return null;
    // Prefer banner ad for compact display, fall back to second feed ad
    return screenAds?.bannerAds?.[0] ?? screenAds?.feedAds?.[1] ?? null;
  }, [adsEnabled, screenAds?.bannerAds, screenAds?.feedAds]);

  // ── Frequency check: only show post-answer ad every N questions ──
  // Uses state (questionsAnswered) so React re-evaluates when counter changes.
  const meetsFrequencyThreshold = useMemo(() => {
    const questionsSinceLastAd = questionsAnswered - lastAdShownAtRef.current;
    return questionsSinceLastAd >= MIN_QUESTIONS_BETWEEN_ADS;
  }, [questionsAnswered]);

  // ── Final visibility decisions ──
  const shouldShowPostAnswerAd = useMemo(() => {
    return (
      hasSubmitted &&
      adsEnabled &&
      !!postAnswerAd &&
      meetsFrequencyThreshold &&
      postAnswerPlacement.canShowAd &&
      postAnswerPlacement.isReady
    );
  }, [hasSubmitted, adsEnabled, postAnswerAd, meetsFrequencyThreshold, postAnswerPlacement.canShowAd, postAnswerPlacement.isReady]);

  const shouldShowSessionAd = useMemo(() => {
    return (
      adsEnabled &&
      !!sessionSummaryAd &&
      sessionPlacement.canShowAd &&
      sessionPlacement.isReady
    );
  }, [adsEnabled, sessionSummaryAd, sessionPlacement.canShowAd, sessionPlacement.isReady]);

  // ── Callbacks ──
  const recordQuestionAnswered = useCallback(() => {
    setQuestionsAnswered((prev) => prev + 1);
  }, []);

  const trackPostAnswerImpression = useCallback(async () => {
    lastAdShownAtRef.current = questionsAnswered;
    await postAnswerPlacement.trackImpression();
  }, [questionsAnswered, postAnswerPlacement.trackImpression]);

  const trackSessionImpression = useCallback(async () => {
    await sessionPlacement.trackImpression();
  }, [sessionPlacement.trackImpression]);

  return useMemo(() => ({
    postAnswerAd,
    sessionSummaryAd,
    shouldShowPostAnswerAd,
    shouldShowSessionAd,
    recordQuestionAnswered,
    isLoading: premiumLoading || adsLoading,
    trackPostAnswerImpression,
    trackSessionImpression,
  }), [
    postAnswerAd,
    sessionSummaryAd,
    shouldShowPostAnswerAd,
    shouldShowSessionAd,
    recordQuestionAnswered,
    premiumLoading,
    adsLoading,
    trackPostAnswerImpression,
    trackSessionImpression,
  ]);
}
