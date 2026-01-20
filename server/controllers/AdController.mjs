import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

// Create a new ad
export const createAd = asyncHandler(async (req, res) => {
    try {
      const { 
        title,
        description,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        targetUrl,
        type = "regular",
        sponsored = false,
        views = 0,
        clicks = 0,
        isActive = true,
        startDate,
        endDate,
        userId,
        priority = 0,
        frequency,
        lastShown
      } = req.body;
  
      console.log("Creating ad with data:", req.body);
  
      // Validate required fields
      if (!title || !description || !userId) {
        return res.status(400).json({ 
          message: "Title, description and userId are required" 
        });
      }
  
      // Validate that either imageUrl or videoUrl is provided
      if (!imageUrl && !videoUrl) {
        return res.status(400).json({
          message: "Either imageUrl or videoUrl must be provided"
        });
      }
  
      // Validate ad type
      const validTypes = ['regular', 'featured', 'banner', 'compact'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({ 
          message: `Invalid ad type. Must be one of: ${validTypes.join(', ')}` 
        });
      }
  
      // Create the ad
      const ad = await prisma.ad.create({
        data: {
          title,
          description,
          imageUrl,
          videoUrl,
          thumbnailUrl,
          targetUrl,
          type,
          sponsored,
          views,
          clicks,
          isActive,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          userId,
          priority,
          frequency,
          lastShown: lastShown ? new Date(lastShown) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
  
      res.status(201).json(ad);
      console.log("Ad created:", ad);
  
    } catch (error) {
      console.error("Error creating ad:", error);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

// Get all ads
export const getAllAds = asyncHandler(async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
      // Prisma Accelerate: Long-lived cache for ads (1 hour TTL, 10 min SWR)
      cacheStrategy: cacheStrategies.longLived,
    });
// Format the data to match frontend expectations
const formattedAds = ads.map(ad => ({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    imageUrl: ad.imageUrl,
    videoUrl: ad.videoUrl,
    thumbnailUrl: ad.thumbnailUrl,
    targetUrl: ad.targetUrl,
    type: ad.type,
    sponsored: ad.sponsored,
    views: ad.views,
    clicks: ad.clicks,
    isActive: ad.isActive,
    startDate: ad.startDate?.toISOString(),
    endDate: ad.endDate?.toISOString(),
    createdAt: ad.createdAt.getTime(), // Convert to timestamp
    updatedAt: ad.updatedAt.getTime(), // Convert to timestamp
    userId: ad.userId,
    user: ad.user
  }));


    // Separate ads by type
  // Separate ads by type
  const featuredAd = formattedAds.find(ad => ad.type === 'featured') || null;
  const bannerAd = formattedAds.find(ad => ad.type === 'banner') || null;
  const regularAds = formattedAds.filter(ad => ad.type === 'regular' || !ad.type ) || null;
    console.log("Featured ad:", featuredAd);
    console.log("Banner ad:", bannerAd);
   
    res.json({
      ads: regularAds,
      featuredAd: featuredAd || null,
      bannerAd: bannerAd || null
    });

    console.log("Fetched ads:", ads);
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Get ads by user
export const getAdsByUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
    const ads = await prisma.ad.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      // Prisma Accelerate: Long-lived cache for user ads (1 hour TTL, 10 min SWR)
      cacheStrategy: cacheStrategies.longLived,
    });

    res.json(ads);
  } catch (error) {
    console.error("Error fetching user ads:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Update an ad
export const updateAd = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Handle date fields if present
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const updatedAd = await prisma.ad.update({
      where: { id },
      data: updateData
    });

    res.json(updatedAd);
    console.log("Ad updated:", updatedAd);
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Delete an ad
export const deleteAd = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.ad.delete({
      where: { id }
    });

    res.json({ message: "Ad deleted successfully" });
    console.log("Ad deleted:", id);
  } catch (error) {
    console.error("Error deleting ad:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Track ad view
export const trackAdView = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await prisma.ad.update({
      where: { id },
      data: { views: { increment: 1 } }
    });

    res.json({ message: "View tracked", views: ad.views });
    console.log("Ad viewed:", ad);
  } catch (error) {
    console.error("Error tracking ad view:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Track ad click
export const trackAdClick = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await prisma.ad.update({
      where: { id },
      data: { clicks: { increment: 1 } }
    });

    res.json({ message: "Click tracked", clicks: ad.clicks });
    console.log("Ad clicked:", ad);
  } catch (error) {
    console.error("Error tracking ad click:", error);
    res.status(500).json({ message: "Something went wrong" });
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