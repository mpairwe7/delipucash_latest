import express from 'express';
import {
    getPrivacySettings,
    updatePrivacySettings,
    getLoginActivity,
    signOutAllDevices,
    createLoginSession,
    getUserProfile,
    updateUserProfile,
    getUserStats,
    revokeSession
} from '../controllers/userController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// User profile endpoints (protected routes)
router.get("/profile", verifyToken, getUserProfile);
router.put("/profile", verifyToken, updateUserProfile);

// User stats endpoint (protected route)
router.get("/stats", verifyToken, getUserStats);

// Privacy settings endpoints (protected routes)
router.get("/privacy", verifyToken, getPrivacySettings);
router.put("/privacy", verifyToken, updatePrivacySettings);

// Login activity endpoints (protected routes)
router.get("/login-activity", verifyToken, getLoginActivity);
router.post("/signout-all-devices", verifyToken, signOutAllDevices);
router.post("/login-session", verifyToken, createLoginSession);

// Individual session management (protected route)
router.post("/sessions/:sessionId/revoke", verifyToken, revokeSession);

export default router; 