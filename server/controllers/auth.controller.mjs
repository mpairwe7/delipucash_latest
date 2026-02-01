import asyncHandler from "express-async-handler";
import prisma from '../lib/prisma.mjs';
import bcrypt from 'bcryptjs';
import { errorHandler } from "../utils/error.mjs";
import jwt from 'jsonwebtoken';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { send2FACode, sendPasswordResetEmail, isEmailConfigured } from '../lib/emailService.mjs';
import crypto from 'crypto';

// ===========================================
// 2FA Helper Functions
// ===========================================

/**
 * Generate a 6-digit OTP code
 */
const generateOTPCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP code for secure storage
 */
const hashOTPCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify OTP code against stored hash
 */
const verifyOTPCode = (inputCode, hashedCode) => {
  const inputHash = hashOTPCode(inputCode);
  return inputHash === hashedCode;
};

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
 * Toggle Two-Factor Authentication (enable/disable)
 * PUT /api/auth/two-factor
 * 
 * When enabling: Sends verification code to email first
 * When disabling: Requires current password verification
 */
export const toggleTwoFactor = asyncHandler(async (req, res, next) => {
  const { enabled, password } = req.body;
  const userId = req.user.id;

  console.log('🔐 2FA toggle request for user ID:', userId, '| Enable:', enabled);

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        password: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // If disabling 2FA, verify password first
    if (!enabled && user.twoFactorEnabled) {
      if (!password) {
        return res.status(400).json({
          success: false,
          error: "Password required to disable 2FA"
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: "Invalid password"
        });
      }

      // Disable 2FA
      await prisma.appUser.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorCode: null,
          twoFactorCodeExpiry: null,
          updatedAt: new Date(),
        },
      });

      console.log('✅ 2FA disabled for user ID:', userId);
      return res.status(200).json({
        success: true,
        data: { enabled: false },
        message: "Two-factor authentication disabled successfully"
      });
    }

    // If enabling 2FA, send verification code
    if (enabled && !user.twoFactorEnabled) {
      const otpCode = generateOTPCode();
      const hashedCode = hashOTPCode(otpCode);
      const expiryTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      // Store hashed code
      await prisma.appUser.update({
        where: { id: userId },
        data: {
          twoFactorCode: hashedCode,
          twoFactorCodeExpiry: expiryTime,
        },
      });

      // Send code via email
      const emailResult = await send2FACode(user.email, otpCode, user.firstName);

      if (!emailResult.success && process.env.NODE_ENV === 'production') {
        console.error('❌ Failed to send 2FA email:', emailResult.error);
        return res.status(500).json({
          success: false,
          error: "Failed to send verification code. Please try again."
        });
      }

      console.log('📧 2FA verification code sent to:', user.email);
      return res.status(200).json({
        success: true,
        data: {
          codeSent: true,
          email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
          expiresIn: 180, // seconds (3 minutes)
        },
        message: "Verification code sent to your email",
        // In dev mode, include code for testing
        ...(process.env.NODE_ENV !== 'production' && emailResult.devCode && { devCode: emailResult.devCode })
      });
    }

    // Already in desired state
    return res.status(200).json({
      success: true,
      data: { enabled: user.twoFactorEnabled },
      message: user.twoFactorEnabled
        ? "Two-factor authentication is already enabled"
        : "Two-factor authentication is already disabled"
    });

  } catch (error) {
    console.error("❌ Failed to toggle 2FA:", error);
    next(errorHandler(500, "Failed to update two-factor authentication"));
  }
});

/**
 * Verify 2FA code and enable 2FA
 * POST /api/auth/two-factor/verify
 */
export const verify2FACode = asyncHandler(async (req, res, next) => {
  const { code } = req.body;
  const userId = req.user.id;

  console.log('🔐 2FA verification attempt for user ID:', userId);

  if (!code || code.length !== 6) {
    return res.status(400).json({
      success: false,
      error: "Invalid verification code format"
    });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorCode: true,
        twoFactorCodeExpiry: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Check if already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: "Two-factor authentication is already enabled"
      });
    }

    // Check if code exists
    if (!user.twoFactorCode || !user.twoFactorCodeExpiry) {
      return res.status(400).json({
        success: false,
        error: "No verification code found. Please request a new code."
      });
    }

    // Check if code expired
    if (new Date() > user.twoFactorCodeExpiry) {
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }

    // Verify the code
    if (!verifyOTPCode(code, user.twoFactorCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code"
      });
    }

    // Enable 2FA and clear code
    await prisma.appUser.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorCode: null,
        twoFactorCodeExpiry: null,
        updatedAt: new Date(),
      },
    });

    console.log('✅ 2FA enabled successfully for user ID:', userId);
    return res.status(200).json({
      success: true,
      data: { enabled: true },
      message: "Two-factor authentication enabled successfully"
    });

  } catch (error) {
    console.error("❌ Failed to verify 2FA code:", error);
    next(errorHandler(500, "Failed to verify code"));
  }
});

/**
 * Resend 2FA verification code
 * POST /api/auth/two-factor/resend
 */
export const resend2FACode = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  console.log('📧 Resend 2FA code request for user ID:', userId);

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        twoFactorEnabled: true,
        twoFactorCodeExpiry: true,
      },
    });

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: "Two-factor authentication is already enabled"
      });
    }

    // Rate limit: Allow resend only after 1 minute
    if (user.twoFactorCodeExpiry) {
      const timeSinceLastCode = Date.now() - (user.twoFactorCodeExpiry.getTime() - 10 * 60 * 1000);
      if (timeSinceLastCode < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - timeSinceLastCode) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting a new code`
        });
      }
    }

    // Generate new code
    const otpCode = generateOTPCode();
    const hashedCode = hashOTPCode(otpCode);
    const expiryTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    await prisma.appUser.update({
      where: { id: userId },
      data: {
        twoFactorCode: hashedCode,
        twoFactorCodeExpiry: expiryTime,
      },
    });

    const emailResult = await send2FACode(user.email, otpCode, user.firstName);

    if (!emailResult.success && process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: "Failed to send verification code. Please try again."
      });
    }

    console.log('📧 New 2FA code sent to:', user.email);
    return res.status(200).json({
      success: true,
      data: {
        codeSent: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        expiresIn: 600,
      },
      message: "New verification code sent",
      ...(process.env.NODE_ENV !== 'production' && emailResult.devCode && { devCode: emailResult.devCode })
    });

  } catch (error) {
    console.error("❌ Failed to resend 2FA code:", error);
    next(errorHandler(500, "Failed to send verification code"));
  }
});

/**
 * Send 2FA code for login verification (when 2FA is enabled)
 * POST /api/auth/two-factor/send
 * Note: Called during login flow, uses email from request body
 */
export const send2FALoginCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  console.log('📧 Login 2FA code request for:', email);

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required"
    });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        success: true,
        message: "If an account exists, a verification code has been sent"
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: "Two-factor authentication is not enabled for this account"
      });
    }

    const otpCode = generateOTPCode();
    const hashedCode = hashOTPCode(otpCode);
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        twoFactorCode: hashedCode,
        twoFactorCodeExpiry: expiryTime,
      },
    });

    const emailResult = await send2FACode(user.email, otpCode, user.firstName);

    if (!emailResult.success && process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: "Failed to send verification code"
      });
    }

    console.log('📧 Login 2FA code sent to:', user.email);
    return res.status(200).json({
      success: true,
      data: {
        codeSent: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        expiresIn: 600,
      },
      message: "Verification code sent",
      ...(process.env.NODE_ENV !== 'production' && emailResult.devCode && { devCode: emailResult.devCode })
    });

  } catch (error) {
    console.error("❌ Failed to send login 2FA code:", error);
    next(errorHandler(500, "Failed to send verification code"));
  }
});

/**
 * Verify 2FA code during login
 * POST /api/auth/two-factor/verify-login
 */
export const verify2FALoginCode = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;

  console.log('🔐 Login 2FA verification for:', email);

  if (!email || !code || code.length !== 6) {
    return res.status(400).json({
      success: false,
      error: "Email and valid 6-digit code are required"
    });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        twoFactorCode: true,
        twoFactorCodeExpiry: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: "Invalid request"
      });
    }

    if (!user.twoFactorCode || !user.twoFactorCodeExpiry) {
      return res.status(400).json({
        success: false,
        error: "No verification code found. Please request a new code."
      });
    }

    if (new Date() > user.twoFactorCodeExpiry) {
      return res.status(400).json({
        success: false,
        error: "Verification code has expired"
      });
    }

    if (!verifyOTPCode(code, user.twoFactorCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code"
      });
    }

    // Clear the used code
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorCodeExpiry: null,
      },
    });

    // Generate JWT token for successful 2FA login
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '3h' });

    console.log('✅ 2FA login successful for:', email);
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication verified",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });

  } catch (error) {
    console.error("❌ Failed to verify login 2FA code:", error);
    next(errorHandler(500, "Failed to verify code"));
  }
});

// ===========================================
// Password Reset Functions
// ===========================================

/**
 * Generate a secure random token for password reset
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash reset token for secure storage
 */
const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Request password reset - sends reset link via email
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  console.log('🔐 Password reset requested for:', email);

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  try {
    // Find user by email
    const user = await prisma.appUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    // Always return success even if user not found (security best practice)
    // This prevents email enumeration attacks
    if (!user) {
      console.log('⚠️ Password reset requested for non-existent email:', email);
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, we've sent a password reset link."
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashResetToken(resetToken);
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store hashed token in database
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiryTime,
      },
    });

    console.log('✅ Reset token generated and stored for user:', user.email);

    // Build reset link
    const baseURL = process.env.MOBILE_APP_SCHEME || 'delipucash';
    const resetLink = `${baseURL}://reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // For web fallback
    const webResetLink = `${process.env.FRONTEND_URL || 'https://delipucash.com'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Send email
    if (isEmailConfigured()) {
      const emailResult = await sendPasswordResetEmail(
        user.email,
        webResetLink,
        user.firstName || ''
      );

      if (!emailResult.success) {
        console.error('❌ Failed to send password reset email:', emailResult.error);
        // Don't expose this error to the user
      } else {
        console.log('✅ Password reset email sent to:', user.email);
      }
    } else {
      console.warn('⚠️ Email not configured. Reset token:', resetToken);
      // In development, log the token for testing
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔑 Development mode - Reset token:', resetToken);
        console.log('🔗 Reset link:', webResetLink);
      }
    }

    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, we've sent a password reset link."
    });

  } catch (error) {
    console.error("❌ Failed to process password reset request:", error);
    next(errorHandler(500, "Failed to process password reset request"));
  }
});

/**
 * Reset password with valid token
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { token, email, newPassword } = req.body;

  console.log('🔐 Password reset attempt for:', email);

  if (!token || !email || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Token, email, and new password are required"
    });
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long"
    });
  }

  try {
    const hashedToken = hashResetToken(token);

    // Find user with valid reset token
    const user = await prisma.appUser.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedToken,
        passwordResetExpiry: {
          gt: new Date(), // Token not expired
        },
      },
      select: { id: true, email: true, firstName: true }
    });

    if (!user) {
      console.log('❌ Invalid or expired reset token for:', email);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new password reset."
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    console.log('✅ Password reset successful for:', user.email);

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password."
    });

  } catch (error) {
    console.error("❌ Failed to reset password:", error);
    next(errorHandler(500, "Failed to reset password"));
  }
});

/**
 * Validate reset token without resetting password
 * POST /api/auth/validate-reset-token
 */
export const validateResetToken = asyncHandler(async (req, res, next) => {
  const { token, email } = req.body;

  console.log('🔐 Validating reset token for:', email);

  if (!token || !email) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: "Token and email are required"
    });
  }

  try {
    const hashedToken = hashResetToken(token);

    // Check if token exists and is not expired
    const user = await prisma.appUser.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedToken,
        passwordResetExpiry: {
          gt: new Date(),
        },
      },
      select: { id: true }
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        valid: false,
        message: "Invalid or expired reset token"
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: "Token is valid"
    });

  } catch (error) {
    console.error("❌ Failed to validate reset token:", error);
    next(errorHandler(500, "Failed to validate token"));
  }
});

