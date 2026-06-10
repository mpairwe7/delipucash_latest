import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for the PUBLIC ad-tracking endpoints (view / impression / click /
 * conversion). These deduct advertiser budget, so they must not be spammable. Keyed by
 * client IP (express-rate-limit's default key generator, which is IPv6-safe). A modest
 * per-minute cap blunts budget-drain abuse from a single source; the per-event dedup
 * (Phase 2) and the atomic budget guard (in the controller) are the deeper defenses.
 */
export const adTrackingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 tracking calls / minute / IP — generous for real use, caps abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many ad tracking requests, slow down.' },
});
