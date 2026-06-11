import rateLimit from 'express-rate-limit';

/**
 * Rate limiters for survey endpoints (pattern: adRateLimit / videoRateLimit).
 * Keyed by client IP (express-rate-limit's IPv6-safe default key generator).
 *
 * Submission: the @@unique([userId, surveyId]) constraint is the deep defense
 * against double-crediting — this cap just blunts spam/scrape pressure on a
 * write endpoint that fans out notifications + webhooks per call.
 */
export const surveySubmitRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // a human answers at most a handful of surveys a minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many survey submissions, slow down.' },
});

/** Creation is heavier (bulk question inserts) and paywalled — keep it modest. */
export const surveyCreateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many surveys created, try again later.' },
});
