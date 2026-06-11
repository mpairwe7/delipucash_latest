import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { getSignedDownloadUrl, URL_EXPIRY } from '../lib/r2.mjs';
import { getStore, mediaCacheMaxMs } from '../lib/memoryCache.mjs';

// In-process cache for the public ad feed. The response is fully global (no
// per-user state), so it is safe to cache by query params. 5 min TTL — well
// under the signed-URL lifetime (DOWNLOAD_URL_EXPIRY = 24h).
const adsCache = getStore('ads', 200);
const ADS_TTL_MS = Math.min(5 * 60 * 1000, mediaCacheMaxMs(URL_EXPIRY.DOWNLOAD_URL_EXPIRY));

/**
 * Replace public R2 URLs with signed URLs for ad media.
 */
async function signAdUrls(ad) {
  const [imageUrl, videoUrl, thumbnailUrl] = await Promise.all([
    ad.r2ImageKey
      ? getSignedDownloadUrl(ad.r2ImageKey, URL_EXPIRY.DOWNLOAD_URL_EXPIRY)
      : Promise.resolve(ad.imageUrl),
    ad.r2VideoKey
      ? getSignedDownloadUrl(ad.r2VideoKey, URL_EXPIRY.DOWNLOAD_URL_EXPIRY)
      : Promise.resolve(ad.videoUrl),
    ad.thumbnailUrl && ad.r2ImageKey
      ? getSignedDownloadUrl(ad.r2ImageKey, URL_EXPIRY.DOWNLOAD_URL_EXPIRY)
      : Promise.resolve(ad.thumbnailUrl),
  ]);
  return { imageUrl, videoUrl, thumbnailUrl };
}

// ============================================================================
// HELPER: Serialize BigInt values for JSON response
// ============================================================================

function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
}

// ============================================================================
// CONSTANTS - Industry Standard Ad Configuration
// ============================================================================

const VALID_AD_TYPES = ['regular', 'featured', 'banner', 'compact'];
const VALID_PLACEMENTS = ['home', 'feed', 'survey', 'video', 'question', 'profile', 'explore', 'interstitial', 'native', 'rewarded', 'story'];
const VALID_PRICING_MODELS = ['cpm', 'cpc', 'cpa', 'flat'];
const VALID_CTA_TYPES = [
  'learn_more', 'shop_now', 'sign_up', 'download', 'watch_video', 'watch_more',
  'get_offer', 'book_now', 'contact_us', 'apply_now', 'subscribe', 'get_quote', 'none'
];
const VALID_GENDERS = ['all', 'male', 'female', 'other'];
const VALID_AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

// Campaign fields a user may set via updateAd. Excludes status/isActive/amountSpent/
// counters/approval/ownership so an owner can't self-approve (bypassing moderation),
// reset their spend, or hijack another account's ad. Status changes go through the
// approve/reject/pause/resume endpoints only.
const UPDATABLE_AD_FIELDS = new Set([
  'title', 'description', 'headline', 'imageUrl', 'videoUrl', 'thumbnailUrl', 'targetUrl',
  'type', 'placement', 'sponsored', 'startDate', 'endDate', 'priority', 'frequency',
  'callToAction', 'pricingModel', 'totalBudget', 'bidAmount', 'dailyBudgetLimit',
  'targetAgeRanges', 'targetGender', 'targetLocations', 'targetInterests', 'enableRetargeting',
  // R2 media metadata (set when media is replaced)
  'r2ImageKey', 'r2VideoKey', 'r2ThumbnailKey', 'r2ImageEtag', 'r2VideoEtag', 'r2ThumbnailEtag',
  'imageMimeType', 'videoMimeType', 'thumbnailMimeType', 'imageSizeBytes', 'videoSizeBytes',
  'thumbnailSizeBytes', 'storageProvider',
]);

/**
 * Prisma `where` fragment for an ad that may legitimately be served/charged right now:
 * active, approved, and within its (optional) start/end window. Used by the atomic
 * tracking guards so budget is never spent on a paused/expired/unapproved ad.
 */
const servableAdWhere = (now) => ({
  isActive: true,
  status: 'approved',
  AND: [
    { OR: [{ startDate: null }, { startDate: { lte: now } }] },
    { OR: [{ endDate: null }, { endDate: { gte: now } }] },
  ],
});

/**
 * Load the ad named by req.params.adId and authorize the caller as its owner OR an
 * ADMIN/MODERATOR. Sends the 404/403 response and returns null on failure; returns the
 * ad on success. Callers must `if (!ad) return;` after invoking.
 */
async function loadOwnedAd(req, res) {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.adId } });
  if (!ad) {
    res.status(404).json({ success: false, message: 'Ad not found' });
    return null;
  }
  if (ad.userId !== req.user?.id) {
    const user = await prisma.appUser.findUnique({
      where: { id: req.user?.id },
      select: { role: true },
    });
    const role = user?.role || 'USER';
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      res.status(403).json({ success: false, message: 'Forbidden: you do not own this ad' });
      return null;
    }
  }
  return ad;
}

const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Attribution context for an ad event, taken from the request. NB: userId comes from the
 * verified token (softAuth), never from the body — a client must not be able to attribute
 * events to other users.
 */
function adEventContext(req) {
  const b = req.body || {};
  const str = (v, n) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const int = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : 0);
  return {
    eventId: str(b.eventId, 128),
    userId: req.user?.id || null,
    deviceId: str(b.deviceId, 128),
    sessionId: str(b.sessionId, 128),
    ipAddress: (req.ip || '').slice(0, 64) || null,
    userAgent: str(req.headers?.['user-agent'], 256),
    placement: str(b.placement, 64),
    viewable: b.wasVisible === true,
    viewDuration: int(b.duration, 0, 86_400_000),
    viewportPercentage: int(b.viewportPercentage, 0, 100),
  };
}

function eventRowData(eventModel, adId, ctx) {
  const base = {
    eventId: ctx.eventId,
    adId,
    userId: ctx.userId,
    deviceId: ctx.deviceId,
    sessionId: ctx.sessionId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    placement: ctx.placement,
  };
  if (eventModel === 'adImpression') {
    return { ...base, viewable: ctx.viewable, viewDuration: ctx.viewDuration, viewportPercentage: ctx.viewportPercentage };
  }
  return base;
}

/** Decide the response when the atomic guard rejected the spend (count === 0). */
async function notServableOrExhausted(ad, cost) {
  if ((Number(ad.amountSpent) || 0) + cost > (Number(ad.totalBudget) || 0)) {
    await prisma.ad.updateMany({
      where: { id: ad.id, status: 'approved' },
      data: { status: 'completed', isActive: false },
    });
    return { ok: false, status: 200, message: 'Budget exhausted', budgetExhausted: true };
  }
  return { ok: false, status: 409, message: 'Ad not servable' };
}

/**
 * Atomically count an ad event and charge its budget — only if the ad is servable
 * (active/approved/in-window) and the charge keeps it within total AND daily budget. The
 * total-budget check and increment are a single `updateMany` (race-safe). When eventModel +
 * eventId are supplied, the count and a deduped event row are written in one transaction:
 * a duplicate eventId (client retry) is idempotent (counts once); the event rows also give
 * an audit trail + fraud signals. Returns { ok } or { ok:false, status, message }.
 */
async function recordBillableEvent(adId, { counterField, computeCost, eventModel = null }, eventCtx = {}) {
  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) return { ok: false, status: 404, message: 'Ad not found' };

  const cost = computeCost(ad);
  const now = new Date();
  const today = startOfUtcDay(now);

  // Daily budget (best-effort; total budget is the atomic guard below). A new UTC day
  // resets the effective daily spend.
  const sameDay = ad.dailySpendDate && startOfUtcDay(new Date(ad.dailySpendDate)).getTime() === today.getTime();
  const effectiveDailySpend = sameDay ? (Number(ad.dailySpend) || 0) : 0;
  if (ad.dailyBudgetLimit != null && effectiveDailySpend + cost > Number(ad.dailyBudgetLimit)) {
    return { ok: false, status: 429, message: 'Daily budget reached' };
  }

  const guardWhere = {
    id: adId,
    ...servableAdWhere(now),
    amountSpent: { lte: (Number(ad.totalBudget) || 0) - cost },
  };
  const incrementData = {
    [counterField]: { increment: 1 },
    amountSpent: { increment: cost },
    dailySpend: sameDay ? { increment: cost } : cost,
    dailySpendDate: today,
    lastShown: now,
  };

  // Idempotent path: dedup via the unique eventId, count + log atomically.
  if (eventModel && eventCtx.eventId) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx[eventModel].create({ data: eventRowData(eventModel, adId, eventCtx) });
        const r = await tx.ad.updateMany({ where: guardWhere, data: incrementData });
        if (r.count === 0) { const e = new Error('guard'); e.guardRejected = true; throw e; }
        return { ok: true };
      });
    } catch (e) {
      if (e?.code === 'P2002') return { ok: true, duplicate: true }; // retry of an already-counted event
      if (e?.guardRejected) return notServableOrExhausted(ad, cost);
      throw e;
    }
  }

  // No idempotency key: count atomically, then best-effort log a (server-keyed) event row.
  const r = await prisma.ad.updateMany({ where: guardWhere, data: incrementData });
  if (r.count === 0) return notServableOrExhausted(ad, cost);
  if (eventModel) {
    try {
      await prisma[eventModel].create({ data: eventRowData(eventModel, adId, { ...eventCtx, eventId: randomUUID() }) });
    } catch { /* logging is best-effort — the counter is the source of truth */ }
  }
  return { ok: true };
}

// ============================================================================
// CREATE AD - Enhanced with industry-standard fields
// ============================================================================

export const createAd = asyncHandler(async (req, res) => {
    try {
      const { 
        // Basic Info
        title,
        description,
        headline,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        targetUrl,
        type = "regular",
        placement = "feed",
        sponsored = false,
        isActive = true,
        startDate,
        endDate,
        userId,
        
        // Call-to-Action
        callToAction = "learn_more",
        
        // Budget & Bidding
        pricingModel = "cpm",
        totalBudget = 0,
        bidAmount = 0,
        dailyBudgetLimit,
        
        // Targeting
        targetAgeRanges = ["18-24", "25-34"],
        targetGender = "all",
        targetLocations = [],
        targetInterests = [],
        enableRetargeting = false,
        
        // Advanced
        priority = 5,
        frequency,
        
        // R2 Storage Metadata (Cloudflare R2 / S3-compatible)
        r2ImageKey,
        r2VideoKey,
        r2ThumbnailKey,
        r2ImageEtag,
        r2VideoEtag,
        r2ThumbnailEtag,
        imageMimeType,
        videoMimeType,
        thumbnailMimeType,
        imageSizeBytes,
        videoSizeBytes,
        thumbnailSizeBytes,
        storageProvider = "r2",
      } = req.body;
  
      console.log("Creating ad campaign with data:", req.body);
  
      // ========== VALIDATION ==========
      
      // Required fields
      if (!title || !description || !userId) {
        return res.status(400).json({ 
          success: false,
          message: "Title, description and userId are required" 
        });
      }
  
      // Media validation
      if (!imageUrl && !videoUrl) {
        return res.status(400).json({
          success: false,
          message: "Either imageUrl or videoUrl must be provided"
        });
      }
  
      // Ad type validation
      if (type && !VALID_AD_TYPES.includes(type)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid ad type. Must be one of: ${VALID_AD_TYPES.join(', ')}` 
        });
      }

      // Placement validation
      if (placement && !VALID_PLACEMENTS.includes(placement)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid placement. Must be one of: ${VALID_PLACEMENTS.join(', ')}` 
        });
      }

      // Pricing model validation
      if (pricingModel && !VALID_PRICING_MODELS.includes(pricingModel)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid pricing model. Must be one of: ${VALID_PRICING_MODELS.join(', ')}` 
        });
      }

      // CTA validation
      if (callToAction && !VALID_CTA_TYPES.includes(callToAction)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid call-to-action. Must be one of: ${VALID_CTA_TYPES.join(', ')}` 
        });
      }

      // Gender validation
      if (targetGender && !VALID_GENDERS.includes(targetGender)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid target gender. Must be one of: ${VALID_GENDERS.join(', ')}` 
        });
      }

      // Age ranges validation
      if (targetAgeRanges && Array.isArray(targetAgeRanges)) {
        const invalidAges = targetAgeRanges.filter(age => !VALID_AGE_RANGES.includes(age));
        if (invalidAges.length > 0) {
          return res.status(400).json({ 
            success: false,
            message: `Invalid age ranges: ${invalidAges.join(', ')}. Valid options: ${VALID_AGE_RANGES.join(', ')}` 
          });
        }
      }

      // Budget validation
      if (totalBudget < 0 || bidAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Budget and bid amount cannot be negative"
        });
      }

      // Priority validation (1-10)
      const validPriority = Math.min(10, Math.max(1, priority || 5));
  
      // ========== CREATE AD ==========
      
      const ad = await prisma.ad.create({
        data: {
          // Basic Info
          title,
          description,
          headline,
          imageUrl,
          videoUrl,
          thumbnailUrl,
          targetUrl,
          type,
          placement,
          sponsored,
          isActive,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          userId,
          
          // Call-to-Action
          callToAction,
          
          // Budget & Bidding
          pricingModel,
          totalBudget: parseFloat(totalBudget) || 0,
          bidAmount: parseFloat(bidAmount) || 0,
          dailyBudgetLimit: dailyBudgetLimit ? parseFloat(dailyBudgetLimit) : null,
          amountSpent: 0,
          
          // Targeting (stored as JSON)
          targetAgeRanges: targetAgeRanges || [],
          targetGender,
          targetLocations: targetLocations || [],
          targetInterests: targetInterests || [],
          enableRetargeting,
          
          // Advanced
          priority: validPriority,
          frequency: frequency ? parseInt(frequency) : null,
          
          // R2 Storage Metadata (Cloudflare R2 / S3-compatible)
          r2ImageKey: r2ImageKey || null,
          r2VideoKey: r2VideoKey || null,
          r2ThumbnailKey: r2ThumbnailKey || null,
          r2ImageEtag: r2ImageEtag || null,
          r2VideoEtag: r2VideoEtag || null,
          r2ThumbnailEtag: r2ThumbnailEtag || null,
          imageMimeType: imageMimeType || null,
          videoMimeType: videoMimeType || null,
          thumbnailMimeType: thumbnailMimeType || null,
          imageSizeBytes: imageSizeBytes ? BigInt(imageSizeBytes) : null,
          videoSizeBytes: videoSizeBytes ? BigInt(videoSizeBytes) : null,
          thumbnailSizeBytes: thumbnailSizeBytes ? parseInt(thumbnailSizeBytes) : null,
          storageProvider: storageProvider || 'r2',
          
          // Initial stats
          views: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          
          // Status
          status: 'pending', // New ads go to pending for review
          
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Calculate estimated reach for response
      const estimatedReach = calculateEstimatedReach({
        targetAgeRanges,
        targetGender,
        targetLocations,
        targetInterests,
        placement
      });
  
      res.status(201).json({
        success: true,
        message: "Ad campaign created successfully. Pending review.",
        data: serializeBigInt({
          ...ad,
          estimatedReach
        })
      });
      
      console.log("Ad campaign created:", ad.id);
  
    } catch (error) {
      console.error("Error creating ad:", error);
      res.status(500).json({ 
        success: false,
        message: "Something went wrong",
        error: error.message 
      });
    }
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate estimated daily reach based on targeting parameters
 */
function calculateEstimatedReach({ targetAgeRanges, targetGender, targetLocations, targetInterests, placement }) {
  const baseReach = 10000;
  let multiplier = 1;
  
  // Fewer age ranges = more targeted = lower reach
  if (targetAgeRanges && Array.isArray(targetAgeRanges)) {
    multiplier *= Math.max(0.3, targetAgeRanges.length / VALID_AGE_RANGES.length);
  }
  
  // Gender targeting
  if (targetGender && targetGender !== "all") {
    multiplier *= 0.5;
  }
  
  // More interests = more targeted
  if (targetInterests && Array.isArray(targetInterests) && targetInterests.length > 0) {
    multiplier *= Math.max(0.4, 1 - (targetInterests.length * 0.08));
  }
  
  // Location targeting
  if (targetLocations && Array.isArray(targetLocations) && targetLocations.length > 0) {
    multiplier *= 0.7;
  }
  
  // Placement affects reach
  const placementMultipliers = {
    home: 1,
    feed: 0.9,
    survey: 0.5,
    video: 0.6,
    question: 0.7,
    profile: 0.4,
    explore: 0.8,
    interstitial: 0.3,
    native: 0.8,
    rewarded: 0.4,
    story: 0.6,
  };
  multiplier *= placementMultipliers[placement] || 1;
  
  return Math.round(baseReach * multiplier);
}

// ============================================================================
// GET ALL ADS - Enhanced with new fields
// ============================================================================

// Get all ads
export const getAllAds = asyncHandler(async (req, res) => {
  try {
    const {
      type,
      placement,
      sponsored,
      userId,
      limit = 50,
      offset = 0
    } = req.query;

    // Serve from cache when warm (key on every param that varies the result).
    const cacheKey = `ads:${type || ''}:${placement || ''}:${sponsored ?? ''}:${userId || ''}:${limit}:${offset}`;
    const cachedPayload = adsCache.get(cacheKey);
    if (cachedPayload) return res.json(cachedPayload);

    // Build where clause — this is a PUBLIC, cached endpoint, so it is hard-locked to
    // active + approved ads within their (optional) start/end window. The `status`/
    // `isActive` client overrides were removed: they let `?status=pending` leak unapproved
    // ads, and a cached admin response could leak to anonymous callers (the cache key is
    // param-only, not auth-scoped). Admin/moderator review uses the authenticated
    // /admin/pending + /user/:userId endpoints instead. (Date-window staleness is bounded
    // by the 5-min cache TTL.)
    const where = { ...servableAdWhere(new Date()) };
    if (type) where.type = type;
    if (placement) where.placement = placement;
    if (sponsored !== undefined) where.sponsored = sponsored === 'true';
    if (userId) where.userId = userId;

    const ads = await prisma.ad.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset),
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    // Get total count for pagination
    const total = await prisma.ad.count({ where });

    // Format the data to match frontend expectations
    const formattedAds = await Promise.all(ads.map(async (ad) => {
      const signed = await signAdUrls(ad);
      return {
      id: ad.id,
      title: ad.title,
      description: ad.description,
      headline: ad.headline,
      imageUrl: signed.imageUrl,
      videoUrl: signed.videoUrl,
      thumbnailUrl: signed.thumbnailUrl,
      targetUrl: ad.targetUrl,
      type: ad.type,
      placement: ad.placement,
      sponsored: ad.sponsored,
      views: ad.views,
      clicks: ad.clicks,
      impressions: ad.impressions,
      conversions: ad.conversions,
      isActive: ad.isActive,
      startDate: ad.startDate?.toISOString() ?? null,
      endDate: ad.endDate?.toISOString() ?? null,
      createdAt: ad.createdAt.toISOString(),
      updatedAt: ad.updatedAt.toISOString(),
      userId: ad.userId,
      user: ad.user,
      priority: ad.priority,
      frequency: ad.frequency,
      callToAction: ad.callToAction,
      pricingModel: ad.pricingModel,
      totalBudget: ad.totalBudget,
      bidAmount: ad.bidAmount,
      dailyBudgetLimit: ad.dailyBudgetLimit,
      amountSpent: ad.amountSpent,
      targetAgeRanges: ad.targetAgeRanges,
      targetGender: ad.targetGender,
      targetLocations: ad.targetLocations,
      targetInterests: ad.targetInterests,
      enableRetargeting: ad.enableRetargeting,
      status: ad.status,
      rejectionReason: ad.rejectionReason,
      approvedAt: ad.approvedAt?.toISOString() ?? null,
      approvedBy: ad.approvedBy,
      lastShown: ad.lastShown?.toISOString() ?? null,
      // Calculate CTR
      ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0,
      // Calculate spend efficiency
      costPerClick: ad.clicks > 0 ? (ad.amountSpent / ad.clicks).toFixed(2) : 0,
    };
    }));

    // Separate ads by type for backward compatibility
    const featuredAd = formattedAds.find(ad => ad.type === 'featured') || null;
    const bannerAd = formattedAds.find(ad => ad.type === 'banner') || null;
    const regularAds = formattedAds.filter(ad => ad.type === 'regular' || !ad.type);
   
    const payload = {
      success: true,
      data: {
        ads: regularAds,
        featuredAd,
        bannerAd,
        all: formattedAds,
      },
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      }
    };
    adsCache.set(cacheKey, payload, ADS_TTL_MS);
    res.json(payload);

  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Get ads by user
export const getAdsByUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;
    
    const where = { userId };
    if (status) where.status = status;

    const ads = await prisma.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.ad.count({ where });

    // Format ads with analytics
    const formattedAds = ads.map(ad => ({
      ...ad,
      ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0,
      costPerClick: ad.clicks > 0 ? (ad.amountSpent / ad.clicks).toFixed(2) : 0,
      budgetRemaining: ad.totalBudget - ad.amountSpent,
      budgetUtilization: ad.totalBudget > 0 ? ((ad.amountSpent / ad.totalBudget) * 100).toFixed(1) : 0,
    }));

    res.json({
      success: true,
      data: formattedAds,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      }
    });
  } catch (error) {
    console.error("Error fetching user ads:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// ============================================================================
// UPDATE AD - Enhanced with validation
// ============================================================================

export const updateAd = asyncHandler(async (req, res) => {
  try {
    // Only the ad's owner (or an admin/moderator) may update it.
    const ad = await loadOwnedAd(req, res);
    if (!ad) return;

    // Whitelist campaign fields only — never status/isActive/amountSpent/counters/owner.
    const updateData = {};
    for (const key of Object.keys(req.body)) {
      if (UPDATABLE_AD_FIELDS.has(key)) updateData[key] = req.body[key];
    }

    // Handle date fields if present
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    // Validate type if being updated
    if (updateData.type && !VALID_AD_TYPES.includes(updateData.type)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid ad type. Must be one of: ${VALID_AD_TYPES.join(', ')}` 
      });
    }

    // Validate placement if being updated
    if (updateData.placement && !VALID_PLACEMENTS.includes(updateData.placement)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid placement. Must be one of: ${VALID_PLACEMENTS.join(', ')}` 
      });
    }

    // Validate pricing model if being updated
    if (updateData.pricingModel && !VALID_PRICING_MODELS.includes(updateData.pricingModel)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid pricing model. Must be one of: ${VALID_PRICING_MODELS.join(', ')}` 
      });
    }

    // Convert numeric fields
    if (updateData.totalBudget) updateData.totalBudget = parseFloat(updateData.totalBudget);
    if (updateData.bidAmount) updateData.bidAmount = parseFloat(updateData.bidAmount);
    if (updateData.dailyBudgetLimit) updateData.dailyBudgetLimit = parseFloat(updateData.dailyBudgetLimit);
    if (updateData.priority) updateData.priority = Math.min(10, Math.max(1, parseInt(updateData.priority)));
    if (updateData.frequency) updateData.frequency = parseInt(updateData.frequency);

    updateData.updatedAt = new Date();

    const updatedAd = await prisma.ad.update({
      where: { id: ad.id },
      data: updateData
    });

    res.json({
      success: true,
      message: "Ad updated successfully",
      data: updatedAd
    });
    console.log("Ad updated:", updatedAd.id);
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// ============================================================================
// ADMIN FUNCTIONS - Approval, Rejection, Status Management
// ============================================================================

// Approve an ad (Admin only)
export const approveAd = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const { adminUserId } = req.body;

    const ad = await prisma.ad.update({
      where: { id: adId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: adminUserId,
        rejectionReason: null,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: "Ad approved successfully",
      data: ad
    });
    console.log("Ad approved:", adId);
  } catch (error) {
    console.error("Error approving ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Reject an ad (Admin only)
export const rejectAd = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required"
      });
    }

    const ad = await prisma.ad.update({
      where: { id: adId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: "Ad rejected",
      data: ad
    });
    console.log("Ad rejected:", adId, "Reason:", reason);
  } catch (error) {
    console.error("Error rejecting ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Pause an ad campaign
export const pauseAd = asyncHandler(async (req, res) => {
  try {
    // Only the ad's owner (or an admin/moderator) may pause it.
    const owned = await loadOwnedAd(req, res);
    if (!owned) return;

    const ad = await prisma.ad.update({
      where: { id: owned.id },
      data: {
        status: 'paused',
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: "Ad campaign paused",
      data: ad
    });
  } catch (error) {
    console.error("Error pausing ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Resume an ad campaign
export const resumeAd = asyncHandler(async (req, res) => {
  try {
    // Only the ad's owner (or an admin/moderator) may resume it.
    const ad = await loadOwnedAd(req, res);
    if (!ad) return;

    if (ad.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Cannot resume a rejected ad. Please create a new campaign."
      });
    }

    const updatedAd = await prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: 'approved',
        isActive: true,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: "Ad campaign resumed",
      data: updatedAd
    });
  } catch (error) {
    console.error("Error resuming ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Get pending ads for admin review
export const getPendingAds = asyncHandler(async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const ads = await prisma.ad.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' }, // Oldest first
      take: parseInt(limit),
      skip: parseInt(offset),
      include: { 
        user: { 
          select: { firstName: true, lastName: true, email: true } 
        } 
      },
    });

    const total = await prisma.ad.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      data: ads,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      }
    });
  } catch (error) {
    console.error("Error fetching pending ads:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// Get ad analytics
export const getAdAnalytics = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;

    const ad = await prisma.ad.findUnique({
      where: { id: adId }
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found"
      });
    }

    const analytics = {
      id: ad.id,
      title: ad.title,
      status: ad.status,
      // Performance metrics
      impressions: ad.impressions,
      views: ad.views,
      clicks: ad.clicks,
      conversions: ad.conversions,
      ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0,
      conversionRate: ad.clicks > 0 ? ((ad.conversions / ad.clicks) * 100).toFixed(2) : 0,
      // Budget metrics
      totalBudget: ad.totalBudget,
      amountSpent: ad.amountSpent,
      budgetRemaining: ad.totalBudget - ad.amountSpent,
      budgetUtilization: ad.totalBudget > 0 ? ((ad.amountSpent / ad.totalBudget) * 100).toFixed(1) : 0,
      // Cost metrics
      costPerClick: ad.clicks > 0 ? (ad.amountSpent / ad.clicks).toFixed(2) : 0,
      costPerMille: ad.impressions > 0 ? ((ad.amountSpent / ad.impressions) * 1000).toFixed(2) : 0,
      costPerConversion: ad.conversions > 0 ? (ad.amountSpent / ad.conversions).toFixed(2) : 0,
      // Schedule
      startDate: ad.startDate,
      endDate: ad.endDate,
      daysRunning: ad.startDate ? Math.ceil((new Date() - new Date(ad.startDate)) / (1000 * 60 * 60 * 24)) : 0,
      // Targeting
      targetAgeRanges: ad.targetAgeRanges,
      targetGender: ad.targetGender,
      targetLocations: ad.targetLocations,
      targetInterests: ad.targetInterests,
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error("Error fetching ad analytics:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// ============================================================================
// DELETE AD
// ============================================================================

// Delete an ad
export const deleteAd = asyncHandler(async (req, res) => {
  try {
    // Only the ad's owner (or an admin/moderator) may delete it.
    const ad = await loadOwnedAd(req, res);
    if (!ad) return;

    await prisma.ad.delete({
      where: { id: ad.id }
    });

    res.json({
      success: true,
      message: "Ad deleted successfully"
    });
    console.log("Ad deleted:", ad.id);
  } catch (error) {
    console.error("Error deleting ad:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong",
      error: error.message 
    });
  }
});

// ============================================================================
// TRACKING FUNCTIONS - Enhanced with budget tracking
// ============================================================================

// Track ad view (non-billable — only counts for a live ad)
export const trackAdView = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;

    const result = await prisma.ad.updateMany({
      where: { id: adId, isActive: true },
      data: {
        views: { increment: 1 },
        lastShown: new Date()
      }
    });

    if (result.count === 0) {
      return res.status(409).json({ success: false, message: "Ad not servable" });
    }
    res.json({ success: true, message: "View tracked" });
  } catch (error) {
    console.error("Error tracking ad view:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
});

// Track ad impression (atomic, with CPM budget deduction)
export const trackAdImpression = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const outcome = await recordBillableEvent(adId, {
      counterField: 'impressions',
      computeCost: (ad) => (ad.pricingModel === 'cpm' ? (Number(ad.bidAmount) || 0) / 1000 : 0),
      eventModel: 'adImpression',
    }, adEventContext(req));
    if (!outcome.ok) {
      return res.status(outcome.status).json({ success: false, message: outcome.message });
    }
    res.json({ success: true, message: "Impression tracked", duplicate: outcome.duplicate ?? false });
  } catch (error) {
    console.error("Error tracking ad impression:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
});

// Track ad click (atomic, with CPC budget deduction)
export const trackAdClick = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const outcome = await recordBillableEvent(adId, {
      counterField: 'clicks',
      computeCost: (ad) => (ad.pricingModel === 'cpc' ? (Number(ad.bidAmount) || 0) : 0),
      eventModel: 'adClick',
    }, adEventContext(req));
    if (!outcome.ok) {
      return res.status(outcome.status).json({ success: false, message: outcome.message });
    }
    res.json({ success: true, message: "Click tracked", duplicate: outcome.duplicate ?? false });
  } catch (error) {
    console.error("Error tracking ad click:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
});

// Track conversion (atomic, with CPA budget deduction)
export const trackAdConversion = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const outcome = await recordBillableEvent(adId, {
      counterField: 'conversions',
      computeCost: (ad) => (ad.pricingModel === 'cpa' ? (Number(ad.bidAmount) || 0) : 0),
    });
    if (!outcome.ok) {
      return res.status(outcome.status).json({ success: false, message: outcome.message });
    }
    res.json({ success: true, message: "Conversion tracked" });
  } catch (error) {
    console.error("Error tracking conversion:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
});

// Track ad interaction (comprehensive tracking)
export const trackAdInteraction = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const {
      position,
      index,
      action,
      userId,
      deviceInfo,
    } = req.body;

    console.log("Tracking ad interaction:", {
      adId,
      position,
      index,
      action,
      userId,
      deviceInfo
    });

    // Update the ad based on action type
    let updateData = {};
    if (action === 'view') {
      updateData = { views: { increment: 1 } };
    } else if (action === 'click') {
      updateData = { clicks: { increment: 1 } };
    } else if (action === 'impression') {
      // For impressions, we might want to track differently
      updateData = { views: { increment: 1 } };
    }

    // Update the ad
    const ad = await prisma.ad.update({
      where: { id: adId },
      data: updateData
    });

    // Log the interaction for analytics
    console.log(`Ad ${action} tracked for ad: ${adId} at position: ${position}`);

    res.json({ 
      success: true,
      message: `${action} tracked successfully`,
      adId,
      action,
      position,
      views: ad.views,
      clicks: ad.clicks
    });

  } catch (error) {
    console.error("Error tracking ad interaction:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to track ad interaction",
      error: error.message 
    });
  }
});