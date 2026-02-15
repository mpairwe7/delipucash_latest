import express from 'express';
import {
    signOut,
    signin,
    signup,
    refreshAccessToken,
    updateSubscriptionStatus,
    checkSubscriptionStatus,
    updateUserPoints,
    getUserPoints,
    updateSurveySubscriptionStatus,
    checkSurveySubscriptionStatus,
    changePassword,
    toggleTwoFactor,
    verify2FACode,
    resend2FACode,
    send2FALoginCode,
    verify2FALoginCode,
    forgotPassword,
    resetPassword,
    validateResetToken,
} from '../controllers/auth.controller.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Public auth routes
router.post("/signup", signup);
router.post("/signin", signin);
router.post('/signout', verifyToken, signOut);
router.post('/refresh-token', refreshAccessToken);

// Password reset routes (public)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/validate-reset-token", validateResetToken);

// Subscription status routes
router.put("/:userId/subscription-status", updateSubscriptionStatus);
router.get("/:userId/subscription-status", checkSubscriptionStatus);
router.put("/:userId/surveysubscription-status", updateSurveySubscriptionStatus);
router.get("/:userId/surveysubscription-status", checkSurveySubscriptionStatus);

// Points routes
router.put("/:userId/points", updateUserPoints);
router.get("/:userId/points", getUserPoints);

// Password management (protected route)
router.put("/change-password", verifyToken, changePassword);

// Two-factor authentication routes
// Protected routes (require auth token)
router.put("/two-factor", verifyToken, toggleTwoFactor);           // Enable/disable 2FA
router.post("/two-factor/verify", verifyToken, verify2FACode);     // Verify code to enable 2FA
router.post("/two-factor/resend", verifyToken, resend2FACode);     // Resend verification code

// Public routes (for login flow)
router.post("/two-factor/send", send2FALoginCode);                 // Send 2FA code during login
router.post("/two-factor/verify-login", verify2FALoginCode);       // Verify 2FA code to complete login

export default router;
