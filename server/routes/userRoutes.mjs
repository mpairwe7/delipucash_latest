import express from 'express';
import { getPrivacySettings, updatePrivacySettings, getLoginActivity, signOutAllDevices, createLoginSession } from '../controllers/userController.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

// Privacy settings endpoints (protected routes)
router.get("/privacy", verifyToken, getPrivacySettings);
router.put("/privacy", verifyToken, updatePrivacySettings);

// Login activity endpoints (protected routes)
router.get("/login-activity", verifyToken, getLoginActivity);
router.post("/signout-all-devices", verifyToken, signOutAllDevices);
router.post("/login-session", verifyToken, createLoginSession);

export default router; 