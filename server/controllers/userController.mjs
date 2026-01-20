import bcrypt from 'bcryptjs';
import { errorHandler } from '../utils/error.mjs';
import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';

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

// Fetch Surveys for User
export const getUserSurveys = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const surveys = await prisma.survey.findMany({
      where: { appUser: { phoneNumber } },
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
      }
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
