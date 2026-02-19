/**
 * Hook to determine if the current user should see ads.
 *
 * Premium subscribers see zero ads (in-feed, interstitial, banner).
 * While the subscription status is loading, ads are suppressed to
 * avoid unnecessary ad API calls for premium users. The ad queries
 * will fire once premium status resolves to non-premium.
 *
 * @module services/useShouldShowAds
 */

import { usePremiumStatus } from './purchasesHooks';

export function useShouldShowAds() {
  const { isPremium, isLoading } = usePremiumStatus();

  // Suppress ads while loading to prevent premium users from briefly triggering ad queries.
  // Non-premium users see a brief delay (< 1s) before ads load — acceptable trade-off.
  return {
    shouldShowAds: !isLoading && !isPremium,
    isLoading,
    isPremium,
  };
}
