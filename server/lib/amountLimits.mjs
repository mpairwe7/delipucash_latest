/**
 * Payment Amount Validation & Limits
 *
 * Enforces provider-specific min/max amount bounds for both collection
 * (subscription payments) and disbursement (reward payouts).
 *
 * Limits differ between sandbox and production:
 *  - **Sandbox**: MTN uses EUR (tiny amounts, min 1 EUR). Airtel sandbox
 *    accepts small UGX values. Limits are relaxed for testing.
 *  - **Production**: Real provider-enforced UGX limits apply.
 *    MTN MoMo Uganda: min 500 UGX, max 5,000,000 UGX per transaction.
 *    Airtel Money Uganda: min 500 UGX, max 5,000,000 UGX per transaction.
 *
 * Usage:
 * ```js
 * import { validateCollectionAmount, validateDisbursementAmount } from '../lib/amountLimits.mjs';
 *
 * validateCollectionAmount(amount, 'MTN');   // throws if invalid
 * validateDisbursementAmount(amount, 'AIRTEL'); // throws if invalid
 * ```
 *
 * @module lib/amountLimits
 */

import { isSandbox, convertAmount } from './mtnConfig.mjs';

// ---------------------------------------------------------------------------
// Provider limits (UGX — production)
// ---------------------------------------------------------------------------

/**
 * Production limits in UGX.
 * Source: MTN MoMo Open API docs, Airtel Money Open API docs (2025/2026).
 */
const PRODUCTION_LIMITS = {
  MTN: {
    collection: { min: 500, max: 5_000_000 },
    disbursement: { min: 500, max: 5_000_000 },
  },
  AIRTEL: {
    collection: { min: 500, max: 5_000_000 },
    disbursement: { min: 500, max: 5_000_000 },
  },
};

/**
 * Sandbox limits — relaxed for testing.
 * MTN sandbox uses EUR (converted via convertAmount), so raw UGX limits
 * are very low. Airtel sandbox accepts small UGX.
 */
const SANDBOX_LIMITS = {
  MTN: {
    collection: { min: 1, max: 100_000_000 },   // Effectively no upper bound in sandbox
    disbursement: { min: 1, max: 100_000_000 },
  },
  AIRTEL: {
    collection: { min: 1, max: 100_000_000 },
    disbursement: { min: 1, max: 100_000_000 },
  },
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Get the effective limits for a provider + operation + environment.
 *
 * @param {'MTN'|'AIRTEL'} provider
 * @param {'collection'|'disbursement'} operation
 * @returns {{ min: number, max: number }}
 */
export const getLimits = (provider, operation) => {
  const table = isSandbox ? SANDBOX_LIMITS : PRODUCTION_LIMITS;
  const providerLimits = table[provider];
  if (!providerLimits) {
    throw new Error(`Unknown provider: ${provider}. Expected MTN or AIRTEL.`);
  }
  const limits = providerLimits[operation];
  if (!limits) {
    throw new Error(`Unknown operation: ${operation}. Expected collection or disbursement.`);
  }
  return limits;
};

/**
 * Validate a UGX amount against provider limits.
 * Throws a descriptive error if the amount is outside bounds.
 *
 * @param {number} amount - Amount in UGX
 * @param {'MTN'|'AIRTEL'} provider
 * @param {'collection'|'disbursement'} operation
 * @throws {Error} if amount is invalid
 */
const validateAmount = (amount, provider, operation) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`Invalid amount: must be a finite number, got ${typeof amount}`);
  }

  if (amount <= 0) {
    throw new Error('Invalid amount: must be greater than 0');
  }

  // For MTN sandbox, also validate the converted EUR amount
  if (isSandbox && provider === 'MTN') {
    const eurAmount = convertAmount(amount);
    if (eurAmount <= 0) {
      throw new Error(`MTN sandbox: UGX ${amount} converts to EUR ${eurAmount} which is too small`);
    }
  }

  const { min, max } = getLimits(provider, operation);

  if (amount < min) {
    throw new Error(
      `Amount UGX ${amount.toLocaleString()} is below the minimum of UGX ${min.toLocaleString()} for ${provider} ${operation}`
    );
  }

  if (amount > max) {
    throw new Error(
      `Amount UGX ${amount.toLocaleString()} exceeds the maximum of UGX ${max.toLocaleString()} for ${provider} ${operation}`
    );
  }
};

/**
 * Validate a collection (request-to-pay) amount.
 *
 * @param {number} amount - Amount in UGX
 * @param {'MTN'|'AIRTEL'} provider
 * @throws {Error} if amount is outside provider limits
 */
export const validateCollectionAmount = (amount, provider) => {
  validateAmount(amount, provider, 'collection');
};

/**
 * Validate a disbursement (payout) amount.
 *
 * @param {number} amount - Amount in UGX
 * @param {'MTN'|'AIRTEL'} provider
 * @throws {Error} if amount is outside provider limits
 */
export const validateDisbursementAmount = (amount, provider) => {
  validateAmount(amount, provider, 'disbursement');
};
