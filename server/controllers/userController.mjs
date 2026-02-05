import bcrypt from 'bcryptjs';
import { errorHandler } from '../utils/error.mjs';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';

// ===========================================
// User Profile Endpoints
// ===========================================

/**
 * Get current user's profile
 * GET /api/users/profile
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token

  console.log('👤 Profile request for user ID:', userId);

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        points: true,
        avatar: true,
        role: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('✅ Profile retrieved for user ID:', userId);
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user profile" });
  }
});

/**
 * Update current user's profile
 * PUT /api/users/profile
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token
  const { firstName, lastName, phone, avatar, privacySettings } = req.body;

  console.log('📝 Profile update request for user ID:', userId);
  console.log('📝 Update data:', { firstName, lastName, phone, avatar });

  try {
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(avatar !== undefined && { avatar }),
        ...(privacySettings !== undefined && { privacySettings }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        points: true,
        avatar: true,
        role: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('✅ Profile updated successfully for user ID:', userId);
    res.json({
      success: true,
      data: updatedUser,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    res.status(500).json({ success: false, error: "Failed to update user profile" });
  }
});

/**
 * Get user statistics
 * GET /api/users/stats
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token

  console.log('📊 Stats request for user ID:', userId);

  try {
    // Aggregate user statistics from various tables
    const [
      surveysCompleted,
      questionsAnswered,
      rewardsEarned,
      totalEarnings,
      user
    ] = await Promise.all([
      // Count completed surveys
      prisma.surveyResponse.count({
        where: { userId },
      }),
      // Count answered questions
      prisma.questionAttempt.count({
        where: { userId },
      }),
      // Count rewards earned
      prisma.reward.count({
        where: { userId },
      }),
      // Sum total earnings from rewards
      prisma.reward.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      // Get user points
      prisma.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      }),
    ]);

    const stats = {
      surveysCompleted: surveysCompleted || 0,
      questionsAnswered: questionsAnswered || 0,
      rewardsEarned: rewardsEarned || 0,
      totalEarnings: totalEarnings._sum.amount || 0,
      totalRewards: user?.points || 0,
      // Calculated fields
      totalPoints: user?.points || 0,
    };

    console.log('✅ Stats retrieved for user ID:', userId, stats);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("❌ Error fetching user stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user statistics" });
  }
});

/**
 * Revoke individual login session
 * POST /api/users/sessions/:sessionId/revoke
 */
export const revokeSession = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token
  const { sessionId } = req.params;

  console.log('🔒 Revoke session request:', { userId, sessionId });

  try {
    // Verify session belongs to user
    const session = await prisma.loginSession.findFirst({
      where: {
        id: sessionId,
        userId: userId,
      },
    });

    if (!session) {
      console.log('❌ Session not found or unauthorized:', sessionId);
      return res.status(404).json({
        success: false,
        data: { revoked: false },
        error: "Session not found"
      });
    }

    // Revoke the session
    await prisma.loginSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        logoutTime: new Date(),
      },
    });

    console.log('✅ Session revoked successfully:', sessionId);
    res.json({
      success: true,
      data: { revoked: true },
      message: "Session revoked successfully"
    });
  } catch (error) {
    console.error("❌ Error revoking session:", error);
    res.status(500).json({ success: false, error: "Failed to revoke session" });
  }
});

// ===========================================
// Legacy User Endpoints
// ===========================================

// User Registration
export const createAppUser = asyncHandler(async (req, res) => {
  const {  phoneNumber, password, firstName ,lastName} = req.body;

  try {
    const userExists = await prisma.appUser.findUnique({ where: { phoneNumber } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.appUser.create({
      data: { phoneNumber, password: hashedPassword, firstName,lastName },
    });

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    errorHandler(err, res);
  }
});

// Add/Remove Liked Videos
export const toggleLikedVideo = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;
  const { videoId } = req.params;

  try {
    const user = await prisma.appUser.findUnique({ where: { phoneNumber } });

    if (!user) return res.status(404).json({ message: 'User not found' });

    let updatedLikedVideos;

    if (user.likedVideos.includes(videoId)) {
      updatedLikedVideos = user.likedVideos.filter((id) => id !== videoId);
      res.message = 'Removed video from liked videos';
    } else {
      updatedLikedVideos = [...user.likedVideos, videoId];
      res.message = 'Added video to liked videos';
    }

    await prisma.appUser.update({
      where: { phoneNumber },
      data: { likedVideos: updatedLikedVideos },
    });

    res.json({ message: res.message, likedVideos: updatedLikedVideos });
  } catch (err) {
    errorHandler(err, res);
  }
});

// Get All Liked Videos
export const getAllLikedVideos = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await prisma.appUser.findUnique({
      where: { phoneNumber },
      select: { likedVideos: true },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ likedVideos: user.likedVideos });
  } catch (err) {
    errorHandler(err, res);
  }
});

// Fetch User Rewards
export const getUserRewards = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const rewards = await prisma.reward.findMany({
      where: { appUser: { phoneNumber } },
    });

    res.json(rewards);
  } catch (err) {
    errorHandler(err, res);
  }
});

// Fetch Surveys for User (with Accelerate caching)
export const getUserSurveys = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const surveys = await prisma.survey.findMany({
      where: { appUser: { phoneNumber } },
      // Prisma Accelerate: Cache for 5 min, serve stale for 1 min while revalidating
    });

    res.json(surveys);
  } catch (err) {
    errorHandler(err, res);
  }
});

// Submit Survey Question Attempts
export const submitQuestionAttempt = asyncHandler(async (req, res) => {
  const { phoneNumber, questionId, answer } = req.body;

  try {
    const attempt = await prisma.questionAttempt.create({
      data: {
        appUser: { connect: { phoneNumber } },
        question: { connect: { id: questionId } },
        answer,
      },
    });

    res.status(201).json({ message: 'Attempt recorded successfully', attempt });
  } catch (err) {
    errorHandler(err, res);
  }
});


export const updateSubscriptionStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: { subscriptionStatus: status },
    });

    res.json({ message: `Subscription updated to ${status}!`, user: updatedUser });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ error: "Failed to update subscription status." });
  }
};

// Get privacy settings
export const getPrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token

  console.log('🔒 Privacy settings request for user ID:', userId);

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        privacySettings: true
      },
      // Prisma Accelerate: Standard cache for user privacy settings
    });

    if (!user) {
      console.log('❌ User not found for privacy settings:', userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Return default privacy settings if none exist
    const defaultSettings = {
      profileVisibility: 'public',
      showActivity: true,
      allowMessages: true,
      showEmail: false,
      showPhone: false
    };

    const settings = user.privacySettings || defaultSettings;
    console.log('✅ Privacy settings retrieved for user ID:', userId, settings);
    res.json(settings);
  } catch (error) {
    console.error("❌ Error fetching privacy settings:", error);
    res.status(500).json({ error: "Failed to fetch privacy settings" });
  }
});

// Update privacy settings
export const updatePrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token
  const privacySettings = req.body;

  console.log('🔒 Privacy settings update request for user ID:', userId);
  console.log('📝 New privacy settings:', privacySettings);

  try {
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: { privacySettings },
    });

    console.log('✅ Privacy settings updated successfully for user ID:', userId);

    res.json({
      message: "Privacy settings updated successfully",
      privacySettings: updatedUser.privacySettings
    });
  } catch (error) {
    console.error("❌ Error updating privacy settings:", error);
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

// Get login activity/sessions
export const getLoginActivity = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token

  console.log('📊 Login activity request for user ID:', userId);

  try {
    const sessions = await prisma.loginSession.findMany({
      where: { userId },
      orderBy: { loginTime: 'desc' },
      take: 10, // Limit to last 10 sessions
      // Prisma Accelerate: Short cache for login sessions
    });

    console.log('✅ Found', sessions.length, 'login sessions for user ID:', userId);
    res.json(sessions);
  } catch (error) {
    console.error("❌ Error fetching login activity:", error);
    res.status(500).json({ error: "Failed to fetch login activity" });
  }
});

// Sign out all devices (terminate all sessions)
export const signOutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token

  console.log('🚪 Sign out all devices request for user ID:', userId);

  try {
    // Update all active sessions to inactive and set logout time
    const result = await prisma.loginSession.updateMany({
      where: { 
        userId,
        isActive: true 
      },
      data: {
        isActive: false,
        logoutTime: new Date(),
      },
    });

    console.log('✅ Signed out', result.count, 'active sessions for user ID:', userId);

    res.json({
      message: "All devices have been signed out successfully"
    });
  } catch (error) {
    console.error("❌ Error signing out all devices:", error);
    res.status(500).json({ error: "Failed to sign out all devices" });
  }
});

// Create login session (called during login)
export const createLoginSession = asyncHandler(async (req, res) => {
  const userId = req.user.id; // From JWT token
  const { deviceInfo, ipAddress, userAgent, location, sessionToken } = req.body;

  try {
    const session = await prisma.loginSession.create({
      data: {
        userId,
        deviceInfo,
        ipAddress,
        userAgent,
        location,
        sessionToken,
      },
    });

    res.json({
      message: "Login session created successfully",
      session
    });
  } catch (error) {
    console.error("Error creating login session:", error);
    res.status(500).json({ error: "Failed to create login session" });
  }
});
