import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

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
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'paused', 'completed'];

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

/**
 * Calculate estimated performance metrics based on budget and pricing model
 */
function calculateEstimatedPerformance({ totalBudget, bidAmount, pricingModel, estimatedReach }) {
  const budget = parseFloat(totalBudget) || 0;
  const bid = parseFloat(bidAmount) || 0;
  
  if (budget <= 0 || bid <= 0) {
    return { impressions: 0, clicks: 0, estimatedCTR: 0 };
  }
  
  let impressions = 0;
  let clicks = 0;
  const estimatedCTR = 0.02; // 2% CTR estimate
  
  switch (pricingModel) {
    case 'cpm':
      impressions = Math.round((budget / bid) * 1000);
      clicks = Math.round(impressions * estimatedCTR);
      break;
    case 'cpc':
      clicks = Math.round(budget / bid);
      impressions = Math.round(clicks / estimatedCTR);
      break;
    case 'cpa':
      clicks = Math.round((budget / bid) * 10); // 10 clicks per conversion
      impressions = Math.round(clicks / estimatedCTR);
      break;
    case 'flat':
      impressions = estimatedReach || 10000;
      clicks = Math.round(impressions * estimatedCTR);
      break;
  }
  
  return { impressions, clicks, estimatedCTR };
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
      status, 
      sponsored, 
      userId,
      limit = 50,
      offset = 0 
    } = req.query;

    // Build where clause
    const where = { isActive: true };
    if (type) where.type = type;
    if (placement) where.placement = placement;
    if (status) where.status = status;
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
    const formattedAds = ads.map(ad => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      headline: ad.headline,
      imageUrl: ad.imageUrl,
      videoUrl: ad.videoUrl,
      thumbnailUrl: ad.thumbnailUrl,
      targetUrl: ad.targetUrl,
      type: ad.type,
      placement: ad.placement,
      sponsored: ad.sponsored,
      views: ad.views,
      clicks: ad.clicks,
      impressions: ad.impressions,
      conversions: ad.conversions,
      isActive: ad.isActive,
      startDate: ad.startDate?.toISOString(),
      endDate: ad.endDate?.toISOString(),
      createdAt: ad.createdAt.getTime(),
      updatedAt: ad.updatedAt.getTime(),
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
      // Calculate CTR
      ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0,
      // Calculate spend efficiency
      costPerClick: ad.clicks > 0 ? (ad.amountSpent / ad.clicks).toFixed(2) : 0,
    }));

    // Separate ads by type for backward compatibility
    const featuredAd = formattedAds.find(ad => ad.type === 'featured') || null;
    const bannerAd = formattedAds.find(ad => ad.type === 'banner') || null;
    const regularAds = formattedAds.filter(ad => ad.type === 'regular' || !ad.type);
   
    res.json({
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
    });

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
      cacheStrategy: cacheStrategies.longLived,
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
    const { adId } = req.params;
    const updateData = { ...req.body };

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
      where: { id: adId },
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
    const { reason, adminUserId } = req.body;

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
    const { adId } = req.params;

    const ad = await prisma.ad.update({
      where: { id: adId },
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
    const { adId } = req.params;

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    
    if (ad.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Cannot resume a rejected ad. Please create a new campaign."
      });
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
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
    const { adId } = req.params;

    await prisma.ad.delete({
      where: { id: adId }
    });

    res.json({ 
      success: true,
      message: "Ad deleted successfully" 
    });
    console.log("Ad deleted:", adId);
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

// Track ad view
export const trackAdView = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;

    const ad = await prisma.ad.update({
      where: { id: adId },
      data: { 
        views: { increment: 1 },
        lastShown: new Date()
      }
    });

    res.json({ 
      success: true,
      message: "View tracked", 
      views: ad.views 
    });
  } catch (error) {
    console.error("Error tracking ad view:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong" 
    });
  }
});

// Track ad impression (with budget deduction for CPM)
export const trackAdImpression = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    // Calculate cost for CPM
    let costIncrement = 0;
    if (ad.pricingModel === 'cpm') {
      costIncrement = ad.bidAmount / 1000; // Cost per single impression
    }

    // Check budget
    if (ad.amountSpent + costIncrement > ad.totalBudget) {
      // Pause ad if budget exhausted
      await prisma.ad.update({
        where: { id: adId },
        data: { 
          status: 'completed',
          isActive: false 
        }
      });
      return res.json({ 
        success: false, 
        message: "Budget exhausted" 
      });
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: { 
        impressions: { increment: 1 },
        amountSpent: { increment: costIncrement },
        lastShown: new Date()
      }
    });

    res.json({ 
      success: true,
      message: "Impression tracked", 
      impressions: updatedAd.impressions,
      amountSpent: updatedAd.amountSpent
    });
  } catch (error) {
    console.error("Error tracking ad impression:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong" 
    });
  }
});

// Track ad click (with budget deduction for CPC)
export const trackAdClick = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    // Calculate cost for CPC
    let costIncrement = 0;
    if (ad.pricingModel === 'cpc') {
      costIncrement = ad.bidAmount;
    }

    // Check budget
    if (ad.amountSpent + costIncrement > ad.totalBudget) {
      await prisma.ad.update({
        where: { id: adId },
        data: { 
          status: 'completed',
          isActive: false 
        }
      });
      return res.json({ 
        success: false, 
        message: "Budget exhausted" 
      });
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: { 
        clicks: { increment: 1 },
        amountSpent: { increment: costIncrement }
      }
    });

    res.json({ 
      success: true,
      message: "Click tracked", 
      clicks: updatedAd.clicks,
      amountSpent: updatedAd.amountSpent
    });
  } catch (error) {
    console.error("Error tracking ad click:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong" 
    });
  }
});

// Track conversion (with budget deduction for CPA)
export const trackAdConversion = asyncHandler(async (req, res) => {
  try {
    const { adId } = req.params;
    const { conversionType, value } = req.body;

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    // Calculate cost for CPA
    let costIncrement = 0;
    if (ad.pricingModel === 'cpa') {
      costIncrement = ad.bidAmount;
    }

    // Check budget
    if (ad.amountSpent + costIncrement > ad.totalBudget) {
      await prisma.ad.update({
        where: { id: adId },
        data: { 
          status: 'completed',
          isActive: false 
        }
      });
      return res.json({ 
        success: false, 
        message: "Budget exhausted" 
      });
    }

    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: { 
        conversions: { increment: 1 },
        amountSpent: { increment: costIncrement }
      }
    });

    res.json({ 
      success: true,
      message: "Conversion tracked", 
      conversions: updatedAd.conversions,
      amountSpent: updatedAd.amountSpent
    });
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
      timestamp, 
      userId, 
      sessionId, 
      deviceInfo, 
      additionalData 
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