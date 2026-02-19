import asyncHandler from "express-async-handler";
import prisma from '../lib/prisma.mjs';
import bcrypt from 'bcryptjs';
import { errorHandler } from "../utils/error.mjs";
import jwt from 'jsonwebtoken';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';
import { send2FACode, sendPasswordResetEmail, isEmailConfigured } from '../lib/emailService.mjs';
import crypto from 'crypto';

import { issueTokenPair, hashToken } from '../utils/tokenUtils.mjs';

// Legacy constant — kept only for reference; new tokens use tokenUtils.mjs
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// ===========================================
// 2FA Helper Functions
// ===========================================

/**
 * Generate a cryptographically secure 6-digit OTP code
 * Uses crypto.randomInt instead of Math.random (CSPRNG)
 */
const generateOTPCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash OTP code for secure storage
 */
const hashOTPCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify OTP code against stored hash using timing-safe comparison
 * Prevents timing side-channel attacks on hash comparison
 */
const verifyOTPCode = (inputCode, hashedCode) => {
  const inputHash = hashOTPCode(inputCode);
  // Use timing-safe comparison to prevent timing attacks
  const inputBuf = Buffer.from(inputHash, 'hex');
  const storedBuf = Buffer.from(hashedCode, 'hex');
  if (inputBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, storedBuf);
};

// ── 2FA brute-force protection ────────────────────────────────
const MAX_2FA_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if user is locked out from 2FA verification.
 * Returns { locked: true, waitSeconds } if locked, { locked: false } otherwise.
 */
const check2FALockout = (user) => {
  if (user.twoFactorLockedUntil && new Date() < user.twoFactorLockedUntil) {
    const waitSeconds = Math.ceil((user.twoFactorLockedUntil.getTime() - Date.now()) / 1000);
    return { locked: true, waitSeconds };
  }
  return { locked: false };
};

/**
 * Record a failed 2FA attempt. Locks the account after MAX_2FA_ATTEMPTS failures.
 */
const record2FAFailure = async (userId, currentAttempts) => {
  const newAttempts = currentAttempts + 1;
  const data = { twoFactorAttempts: newAttempts };

  if (newAttempts >= MAX_2FA_ATTEMPTS) {
    data.twoFactorLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    data.twoFactorCode = null;
    data.twoFactorCodeExpiry = null;
  }

  await prisma.appUser.update({ where: { id: userId }, data });
};

// User Signup
export const signup = asyncHandler(async (req, res, next) => {
  const {email: rawEmail, password,firstName,lastName,phone } = req.body;
  const email = rawEmail?.toLowerCase().trim();

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  // Check if the user already exists
  const userExists = await prisma.appUser.findUnique({ where: {email } });

  if (userExists) {
    return res.status(409).send({ message: "User already registered" });
  }

  // Server-side password validation (mirrors client-side rules)
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return res.status(400).json({ success: false, message: "Password must contain uppercase, lowercase, and a number" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

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

  // Issue access + refresh token pair (creates LoginSession)
  const { accessToken, refreshToken } = await issueTokenPair(newUser.id, req);

  // Return full user profile (strip password hash)
  const { password: _pw, ...safeUser } = newUser;

  res.status(201).send({
    message: "Registered successfully",
    success: true,
    user: safeUser,
    token: accessToken,
    refreshToken,
  });
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

    // Revoke ALL active sessions — forces re-login on every device
    await prisma.loginSession.updateMany({
      where: { userId, isActive: true },
      data: {
        isActive: false,
        logoutTime: new Date(),
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    console.log('✅ Password updated and all sessions revoked for user:', user.email);

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
  const {email: rawEmail, password } = req.body;
  const email = rawEmail?.toLowerCase().trim();

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const validUser = await prisma.appUser.findUnique({ where: {email } });

  if (!validUser) {
    return next(errorHandler(401, 'Invalid credentials'));
  }

  if (typeof validUser.password !== 'string') {
    return next(errorHandler(401, 'Invalid credentials'));
  }

  const validPassword = await bcrypt.compare(password, validUser.password);
  if (!validPassword) {
    return next(errorHandler(401, 'Invalid credentials'));
  }

  // 2FA gate: if enabled, do NOT issue tokens — require code verification first
  if (validUser.twoFactorEnabled) {
    return res.status(200).json({
      success: true,
      twoFactorRequired: true,
      maskedEmail: validUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    });
  }

  // Strip sensitive fields before returning user data
  const { password: _pw, twoFactorCode: _tc, twoFactorCodeExpiry: _te,
          passwordResetToken: _prt, passwordResetExpiry: _pre, ...safeUser } = validUser;

  // Issue access + refresh token pair (creates LoginSession with device metadata)
  const { accessToken, refreshToken } = await issueTokenPair(validUser.id, req);

  res.status(200).json({
    success: true,
    token: accessToken,
    refreshToken,
    user: safeUser,
  });
});



// User SignOut
export const signOut = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;
  const bearerToken = req.headers.authorization?.replace('Bearer ', '');

  // Try to match the exact session first; fall back to revoking all active sessions
  // for this user. The access token in the DB may have been rotated by a refresh,
  // making an exact match impossible.
  try {
    const exact = bearerToken
      ? await prisma.loginSession.updateMany({
          where: { userId, isActive: true, sessionToken: bearerToken },
          data: { isActive: false, logoutTime: new Date(), refreshTokenHash: null, refreshTokenExpiresAt: null },
        })
      : { count: 0 };

    // If no exact match (e.g. token was rotated), revoke all active sessions
    if (exact.count === 0) {
      await prisma.loginSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, logoutTime: new Date(), refreshTokenHash: null, refreshTokenExpiresAt: null },
      });
    }
  } catch (error) {
    // Non-critical — session cleanup failure shouldn't block signout
  }

  res.status(200).json({ success: true, message: 'Signed out successfully' });
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
  const { enabled, password, code } = req.body;
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
        twoFactorCode: true,
        twoFactorCodeExpiry: true,
        twoFactorAttempts: true,
        twoFactorLockedUntil: true,
      },
    });

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // If disabling 2FA — 2-step: password → send OTP, then password + code → disable
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

      // Step 2: Code provided — verify OTP then disable
      if (code) {
        // Brute-force lockout check
        const lockout = check2FALockout(user);
        if (lockout.locked) {
          return res.status(429).json({
            success: false,
            error: `Too many failed attempts. Please try again in ${lockout.waitSeconds} seconds.`
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
            error: "Verification code has expired. Please request a new code."
          });
        }

        if (!verifyOTPCode(code, user.twoFactorCode)) {
          await record2FAFailure(user.id, user.twoFactorAttempts);
          return res.status(400).json({
            success: false,
            error: "Invalid verification code"
          });
        }

        // Disable 2FA and clear all 2FA fields
        await prisma.appUser.update({
          where: { id: userId },
          data: {
            twoFactorEnabled: false,
            twoFactorCode: null,
            twoFactorCodeExpiry: null,
            twoFactorAttempts: 0,
            twoFactorLockedUntil: null,
            updatedAt: new Date(),
          },
        });

        // Invalidate all OTHER sessions (keep current device logged in)
        const currentToken = req.headers['authorization']?.split(' ')[1];
        await prisma.loginSession.updateMany({
          where: {
            userId,
            isActive: true,
            ...(currentToken ? { NOT: { sessionToken: currentToken } } : {}),
          },
          data: { isActive: false, logoutTime: new Date() },
        });

        console.log('✅ 2FA disabled for user ID:', userId);
        return res.status(200).json({
          success: true,
          data: { enabled: false },
          message: "Two-factor authentication disabled successfully"
        });
      }

      // Step 1: No code — send OTP to email for confirmation
      const otpCode = generateOTPCode();
      const hashedCode = hashOTPCode(otpCode);
      const expiryTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      await prisma.appUser.update({
        where: { id: userId },
        data: {
          twoFactorCode: hashedCode,
          twoFactorCodeExpiry: expiryTime,
          twoFactorAttempts: 0,
          twoFactorLockedUntil: null,
        },
      });

      const emailResult = await send2FACode(user.email, otpCode, user.firstName, 3);

      if (!emailResult.success && process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          success: false,
          error: "Failed to send verification code. Please try again."
        });
      }

      console.log('📧 Disable-2FA verification code sent to:', user.email);
      return res.status(200).json({
        success: true,
        data: {
          codeSent: true,
          email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
          expiresIn: 180,
        },
        message: "Verification code sent to confirm disabling 2FA",
        ...(process.env.NODE_ENV !== 'production' && emailResult.devCode && { devCode: emailResult.devCode })
      });
    }

    // If enabling 2FA, send verification code
    if (enabled && !user.twoFactorEnabled) {
      const otpCode = generateOTPCode();
      const hashedCode = hashOTPCode(otpCode);
      const expiryTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      // Store hashed code and reset brute-force counters (fresh code = fresh window)
      await prisma.appUser.update({
        where: { id: userId },
        data: {
          twoFactorCode: hashedCode,
          twoFactorCodeExpiry: expiryTime,
          twoFactorAttempts: 0,
          twoFactorLockedUntil: null,
        },
      });

      // Send code via email
      const emailResult = await send2FACode(user.email, otpCode, user.firstName, 3);

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
        twoFactorAttempts: true,
        twoFactorLockedUntil: true,
      },
    });

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Brute-force lockout check
    const lockout = check2FALockout(user);
    if (lockout.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please try again in ${lockout.waitSeconds} seconds.`
      });
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
      await record2FAFailure(user.id, user.twoFactorAttempts);
      return res.status(400).json({
        success: false,
        error: "Invalid verification code"
      });
    }

    // Enable 2FA, clear code, and reset brute-force counters
    await prisma.appUser.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorCode: null,
        twoFactorCodeExpiry: null,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
        updatedAt: new Date(),
      },
    });

    // Invalidate all OTHER sessions (keep current device logged in)
    const currentToken = req.headers['authorization']?.split(' ')[1];
    await prisma.loginSession.updateMany({
      where: {
        userId,
        isActive: true,
        ...(currentToken ? { NOT: { sessionToken: currentToken } } : {}),
      },
      data: { isActive: false, logoutTime: new Date() },
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
    // Code expiry is set to now + 3 min, so sendTime = expiryTime - 3 min
    if (user.twoFactorCodeExpiry) {
      const codeSentAt = user.twoFactorCodeExpiry.getTime() - 3 * 60 * 1000;
      const timeSinceLastCode = Date.now() - codeSentAt;
      if (timeSinceLastCode < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - timeSinceLastCode) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting a new code`
        });
      }
    }

    // Generate new code and reset brute-force counters (fresh code = fresh window)
    const otpCode = generateOTPCode();
    const hashedCode = hashOTPCode(otpCode);
    const expiryTime = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    await prisma.appUser.update({
      where: { id: userId },
      data: {
        twoFactorCode: hashedCode,
        twoFactorCodeExpiry: expiryTime,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      },
    });

    const emailResult = await send2FACode(user.email, otpCode, user.firstName, 3);

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
        expiresIn: 180, // 3 minutes — matches actual server-side code expiry
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
        twoFactorCodeExpiry: true,
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

    // Rate limit: Allow resend only after 60 seconds (prevents email spam)
    if (user.twoFactorCodeExpiry) {
      const codeSentAt = user.twoFactorCodeExpiry.getTime() - 10 * 60 * 1000;
      const timeSinceLastCode = Date.now() - codeSentAt;
      if (timeSinceLastCode < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - timeSinceLastCode) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting a new code`
        });
      }
    }

    const otpCode = generateOTPCode();
    const hashedCode = hashOTPCode(otpCode);
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    // Store hashed code and reset brute-force counters (fresh code = fresh window)
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        twoFactorCode: hashedCode,
        twoFactorCodeExpiry: expiryTime,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      },
    });

    const emailResult = await send2FACode(user.email, otpCode, user.firstName, 10);

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
        phone: true,
        points: true,
        avatar: true,
        role: true,
        password: true,
        twoFactorEnabled: true,
        emailVerified: true,
        twoFactorCode: true,
        twoFactorCodeExpiry: true,
        twoFactorAttempts: true,
        twoFactorLockedUntil: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        currentSubscriptionId: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: "Invalid request"
      });
    }

    // Brute-force lockout check
    const lockout = check2FALockout(user);
    if (lockout.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please try again in ${lockout.waitSeconds} seconds.`
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
      await record2FAFailure(user.id, user.twoFactorAttempts);
      return res.status(400).json({
        success: false,
        error: "Invalid verification code"
      });
    }

    // Clear the used code and reset brute-force counters
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorCodeExpiry: null,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      },
    });

    // Issue access + refresh token pair for successful 2FA login
    const { accessToken, refreshToken } = await issueTokenPair(user.id, req);

    // Strip sensitive fields before returning user data
    const { password: _pw, twoFactorCode: _tc, twoFactorCodeExpiry: _te, ...safeUser } = user;

    console.log('✅ 2FA login successful for:', email);
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication verified",
      user: safeUser,
      token: accessToken,
      refreshToken,
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

    // Build the reset link.
    // Primary link = HTTPS URL on the backend which serves a smart redirect page.
    // On Android (App Links) / iOS (Universal Links) the OS intercepts this URL
    // and opens the app directly. If not verified or app not installed, the
    // redirect page tries the custom scheme then shows a fallback UI.
    const serverBase = process.env.FRONTEND_URL || 'https://delipucashserver.vercel.app';
    const resetLink = `${serverBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Send email — single HTTPS link (reliable in all email clients)
    if (isEmailConfigured()) {
      const emailResult = await sendPasswordResetEmail(
        user.email,
        resetLink,
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
        console.log('🔗 Reset link:', resetLink);
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

    // Revoke ALL active sessions — forces re-login everywhere
    await prisma.loginSession.updateMany({
      where: { userId: user.id, isActive: true },
      data: {
        isActive: false,
        logoutTime: new Date(),
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    console.log('✅ Password reset successful and all sessions revoked for:', user.email);

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

// ===========================================
// Refresh Access Token
// ===========================================

/**
 * Exchange a valid refresh token for a new access + refresh token pair.
 * Implements rotation: each refresh token is single-use.
 * Detects reuse of old tokens and revokes the entire token family.
 *
 * POST /api/auth/refresh-token
 * Body: { refreshToken: string }
 */
export const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  const hashed = hashToken(refreshToken);

  try {
    // 1. Look for an active session with this refresh token hash
    const session = await prisma.loginSession.findFirst({
      where: {
        refreshTokenHash: hashed,
        isActive: true,
      },
    });

    if (!session) {
      // Reuse detection: check if an *inactive* session once had this hash.
      // If found, an old rotated token was replayed — revoke entire family.
      const staleSession = await prisma.loginSession.findFirst({
        where: { refreshTokenHash: hashed, isActive: false },
      });

      if (staleSession && staleSession.tokenFamily) {
        console.warn('⚠️  Refresh token reuse detected — revoking family', staleSession.tokenFamily);
        await prisma.loginSession.updateMany({
          where: { tokenFamily: staleSession.tokenFamily },
          data: {
            isActive: false,
            refreshTokenHash: null,
            refreshTokenExpiresAt: null,
            logoutTime: new Date(),
          },
        });
      }

      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // 2. Check expiry
    if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt < new Date()) {
      await prisma.loginSession.update({
        where: { id: session.id },
        data: { isActive: false, logoutTime: new Date() },
      });
      return res.status(401).json({ success: false, message: 'Refresh token expired' });
    }

    // 3. Rotate: issue new pair and update the same session row
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
      session.userId,
      req,
      session.id
    );

    return res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('❌ Refresh token error:', error);
    next(errorHandler(500, 'Failed to refresh token'));
  }
});
