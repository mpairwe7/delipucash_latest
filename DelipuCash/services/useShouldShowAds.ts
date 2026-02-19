/**
 * Hook to determine if the current user should see ads.
 *
 * Premium subscribers see zero ads (in-feed, interstitial, banner).
 * While the subscription status is loading, ads are shown to avoid
 * a flash of empty space.
 *
 * @module services/useShouldShowAds
 */

import { usePremiumStatus } from './purchasesHooks';

export function useShouldShowAds() {
  const { isPremium, isLoading } = usePremiumStatus();

  return {
    shouldShowAds: !isPremium,
    isLoading,
    isPremium,
  };
}
