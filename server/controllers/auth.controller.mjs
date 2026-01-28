import asyncHandler from "express-async-handler";
import prisma from '../lib/prisma.mjs';
import bcrypt from 'bcryptjs';
import { errorHandler } from "../utils/error.mjs";
import jwt from 'jsonwebtoken';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

// User Signup
export const signup = asyncHandler(async (req, res, next) => {
  console.log("👤 Creating a new user");

  const {email, password,firstName,lastName,phone } = req.body;

  console.log('📝 Signup request for email:', email);

  // Check if the user already exists
  const userExists = await prisma.appUser.findUnique({ where: {email } });

  if (userExists) {
    console.log("❌ User already exists:", email);
    return res.status(409).send({ message: "User already registered" });
  }

  console.log('✅ User does not exist, proceeding with registration');

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('🔒 Password hashed successfully');

  // Create new user
  const newUser = await prisma.appUser.create({
    data: {
     email,     
      password: hashedPassword,
      firstName,
      lastName,
      phone,
    },
  });

  console.log('✅ New user created successfully:', { id: newUser.id, email: newUser.email, firstName: newUser.firstName, lastName: newUser.lastName });

  // Create JWT token
  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '3h' });

  console.log('🎫 JWT token created with 3-hour expiration');

  // Send response with user data and token
  res.status(200).send({
    message: "Registered successfully",
    user: {
      id: newUser.id,
    email: newUser.email,
      // image: newUser.image,
    },
    token,
  });

  console.log('🎉 User registration completed successfully for:', email);
});


// Update user points
export const updateUserPoints = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { points } = req.body;

  console.log(`Updating points for user ${userId} to ${points}`);

  // Validate input
  if (!userId || typeof userId !== "string" || isNaN(points)) {
    return next(errorHandler(400, "Invalid user ID or points value"));
  }

  try {
    // Find the user and update their points
    const updatedUser = await prisma.appUser.update({
      where: { id: userId }, // Pass userId as a string (no parseInt needed)
      data: { points: parseInt(points) }, // Ensure points is an integer
    });

    if (!updatedUser) {
      return next(errorHandler(404, "User not found"));
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: "Points updated successfully!",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        points: updatedUser.points,
      },
    });
  } catch (error) {
    console.error("Failed to update user points:", error);
    next(errorHandler(500, "Failed to update points"));
  }
});
// signin code

// Fetch user points
// Change password endpoint
export const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // From JWT token

  console.log('🔐 Password change request received for user ID:', userId);
  console.log('📝 Request body:', { currentPassword: '***', newPassword: '***' });

  try {
    // Find the user
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { password: true, email: true, firstName: true, lastName: true }
    });

    if (!user) {
      console.log('❌ User not found for ID:', userId);
      return next(errorHandler(404, "User not found"));
    }

    console.log('✅ User found:', { email: user.email, firstName: user.firstName, lastName: user.lastName });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      console.log('❌ Current password verification failed for user:', user.email);
      return next(errorHandler(400, "Current password is incorrect"));
    }

    console.log('✅ Current password verified successfully for user:', user.email);

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 New password hashed successfully');

    // Update the password
    await prisma.appUser.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    console.log('✅ Password updated successfully in database for user:', user.email);

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

    console.log('🎉 Password change completed successfully for user:', user.email);
  } catch (error) {
    console.error("❌ Failed to change password:", error);
    next(errorHandler(500, "Failed to change password"));
  }
});

export const getUserPoints = async (req, res, next) => {
  const { userId } = req.params;

  try {
    // Find the user and select only the points field
    const user = await prisma.appUser.findUnique({
      where: { id: String(userId) }, // Ensure it's a string
      select: { points: true },
      // Prisma Accelerate: Short cache for user points (30s TTL, 10s SWR)
      cacheStrategy: cacheStrategies.shortLived,
    });
    
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Return the user's points
    res.status(200).json(user);
  } catch (error) {
    console.error("Failed to fetch user points:", error);
    next(errorHandler(500, "Failed to fetch user points"));
  }
};


export const signin = asyncHandler(async (req, res, next) => {
  const {email, password } = req.body;
  console.log('Incoming request:', req.body);

  const validUser = await prisma.appUser.findUnique({ where: {email } });

  if (!validUser) {
    console.error('user not found');
    return next(errorHandler(404, 'User not found!'));
  }

  console.log('User found:', validUser);

  if (typeof validUser.password !== 'string') {
    return next(errorHandler(500, 'Invalid password format!'));
  }

  const validPassword = await bcrypt.compare(password, validUser.password);
  if (!validPassword) {
    return next(errorHandler(401, 'Wrong credentials!'));
  }

  const token = jwt.sign({ id: validUser.id }, process.env.JWT_SECRET, { expiresIn: '3h' });
  const { password: pass, ...rest } = validUser;
  console.log('✅ Successful login for user:', validUser.email);
  console.log('🕐 Token expiration set to 3 hours');
  
  // Log the user data to ensure the image is included
  console.log('📤 User data to be returned:', rest);

  // Create login session
  try {
    const deviceInfo = {
      platform: req.headers['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: req.headers['user-agent']?.includes('Chrome') ? 'Chrome' : 
               req.headers['user-agent']?.includes('Safari') ? 'Safari' : 
               req.headers['user-agent']?.includes('Firefox') ? 'Firefox' : 'Unknown',
      os: req.headers['user-agent']?.includes('Android') ? 'Android' : 
          req.headers['user-agent']?.includes('iOS') ? 'iOS' : 
          req.headers['user-agent']?.includes('Windows') ? 'Windows' : 
          req.headers['user-agent']?.includes('Mac') ? 'macOS' : 'Unknown'
    };

    console.log('📱 Creating login session with device info:', deviceInfo);

    const loginSession = await prisma.loginSession.create({
      data: {
        userId: validUser.id,
        deviceInfo,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionToken: token,
      },
    });

    console.log('✅ Login session created successfully:', { sessionId: loginSession.id, userId: loginSession.userId });
  } catch (error) {
    console.error('❌ Failed to create login session:', error);
    // Don't fail the login if session creation fails
  }

  res.status(200).json({
    success: true,
    token,
    user: rest,
  });
});



// User SignOut
export const signOut = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;
  console.log('🚪 User signout request for user ID:', userId);
  
  // Mark current session as inactive
  try {
    await prisma.loginSession.updateMany({
      where: { 
        userId: userId,
        sessionToken: req.headers.authorization?.replace('Bearer ', '')
      },
      data: {
        isActive: false,
        logoutTime: new Date(),
      },
    });
    console.log('✅ User session marked as inactive for user ID:', userId);
  } catch (error) {
    console.error('❌ Failed to update login session on logout:', error);
  }
  
  res.status(200).json('User has been logged out!');
  console.log('🎉 User logged out successfully for user ID:', userId);
});



export const updateSubscriptionStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user's latest payment
    const latestPayment = await prisma.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // Get the most recent payment
    });

    if (!latestPayment) {
      return res.status(404).json({ error: "No payment found for this user." });
    }

    const currentDate = new Date();
    const startDate = new Date(latestPayment.startDate);
    const endDate = new Date(latestPayment.endDate);

    let subscriptionStatus;

    // Check if the current date is within the subscription period
    if (currentDate >= startDate && currentDate <= endDate) {
      subscriptionStatus = 'ACTIVE';
    } else {
      subscriptionStatus = 'INACTIVE';
    }

    // Update the user's subscription status
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: { subscriptionStatus },
    });

    res.json({
      message: `Subscription updated to ${subscriptionStatus}!`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ error: "Failed to update subscription status." });
  }
};

// Check Subscription Status
// Check Subscription Status
export const checkSubscriptionStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user's subscription status from the AppUser model
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Return the subscription status
    res.json({
      subscriptionStatus: user.subscriptionStatus,
    });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ error: "Failed to check subscription status." });
  }
});


export const updateSurveySubscriptionStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user's latest payment
    const latestPayment = await prisma.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // Get the most recent payment
    });

    if (!latestPayment) {
      return res.status(404).json({ error: "No payment found for this user." });
    }

    const currentDate = new Date();
    const startDate = new Date(latestPayment.startDate);
    const endDate = new Date(latestPayment.endDate);

    let surveysubscriptionStatus;

    // Check if the current date is within the subscription period
    if (currentDate >= startDate && currentDate <= endDate) {
      surveysubscriptionStatus = 'ACTIVE';
    } else {
      surveysubscriptionStatus = 'INACTIVE';
    }

    // Update the user's subscription status
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: { surveysubscriptionStatus },
    });

    res.json({
      message: `Subscription updated to ${surveysubscriptionStatus}!`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ error: "Failed to update survey subscription status." });
  }
};

// Check Subscription Status
// Check Subscription Status
export const checkSurveySubscriptionStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user's subscription status from the AppUser model
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { surveysubscriptionStatus: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Return the subscription status
    res.json({
      surveysubscriptionStatus: user.surveysubscriptionStatus,
    });
  } catch (error) {
    console.error("Error checking survey subscription status:", error);
    res.status(500).json({ error: "Failed to check  survey subscription status." });
  }
});

// Get Rewards for User by User ID
export const getRewardsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // First, get the user to find their phone number
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Then get rewards for that phone number
    const rewards = await prisma.reward.findMany({
      where: { userPhoneNumber: user.phone },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rewards);
  } catch (error) {
    console.error("Error fetching rewards for user:", error);
    res.status(500).json({ error: "Failed to fetch rewards." });
  }
});

// ===========================================
// Two-Factor Authentication
// ===========================================

/**
 * Toggle Two-Factor Authentication
 * PUT /api/auth/two-factor
 * Note: This is a basic implementation. For production, integrate with OTP service like Twilio
 */
export const toggleTwoFactor = asyncHandler(async (req, res, next) => {
  const { enabled } = req.body;
  const userId = req.user.id; // From JWT token

  console.log('🔐 2FA toggle request for user ID:', userId, '| Enabled:', enabled);

  try {
    // Update user's 2FA setting
    const updatedUser = await prisma.appUser.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: enabled,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    });

    console.log('✅ 2FA setting updated for user ID:', userId, '| Now:', updatedUser.twoFactorEnabled);

    res.status(200).json({
      success: true,
      data: { enabled: updatedUser.twoFactorEnabled },
      message: enabled
        ? "Two-factor authentication enabled successfully"
        : "Two-factor authentication disabled"
    });
  } catch (error) {
    console.error("❌ Failed to toggle 2FA:", error);
    next(errorHandler(500, "Failed to update two-factor authentication"));
  }
});
