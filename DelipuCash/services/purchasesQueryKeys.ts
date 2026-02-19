/**
 * Shared query keys for purchase/subscription hooks
 *
 * Extracted into a separate module to break the circular dependency
 * between purchasesHooks.ts and subscriptionPaymentHooks.ts.
 *
 * @module services/purchasesQueryKeys
 */

export const purchasesQueryKeys = {
  all: ['purchases'] as const,
  offerings: () => [...purchasesQueryKeys.all, 'offerings'] as const,
  subscription: () => [...purchasesQueryKeys.all, 'subscription'] as const,
  customerInfo: () => [...purchasesQueryKeys.all, 'customerInfo'] as const,
};
