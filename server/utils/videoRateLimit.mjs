import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for the PUBLIC video-tracking endpoints (views / completion / telemetry
 * events). These feed the trending engagement score, so they must not be spammable.
 * Keyed by client IP (express-rate-limit's default key generator, which is IPv6-safe).
 * A modest per-minute cap blunts count-inflation abuse from a single source; the
 * per-viewer-per-day dedup (VideoViewEvent unique key, in the controller) is the
 * deeper defense.
 */
export const videoTrackingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 tracking calls / minute / IP — generous for real use, caps abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many video tracking requests, slow down.' },
});
