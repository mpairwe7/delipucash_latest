import express from 'express';
import { signOut, signin, signup, updateSubscriptionStatus, checkSubscriptionStatus, updateUserPoints, getUserPoints, updateSurveySubscriptionStatus, checkSurveySubscriptionStatus, changePassword, toggleTwoFactor } from '../controllers/auth.controller.mjs';
import { verifyToken } from '../utils/verifyUser.mjs';

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post('/signout', signOut)
router.put("/:userId/subscription-status", updateSubscriptionStatus);
router.get("/:userId/subscription-status", checkSubscriptionStatus);
router.put("/:userId/surveysubscription-status", updateSurveySubscriptionStatus);
router.get("/:userId/surveysubscription-status", checkSurveySubscriptionStatus);
router.put("/:userId/points", updateUserPoints);
// GET /users/:userId/points - Fetch user points
router.get("/:userId/points", getUserPoints);
// Change password endpoint (protected route)
router.put("/change-password", verifyToken, changePassword);
// Two-factor authentication toggle (protected route)
router.put("/two-factor", verifyToken, toggleTwoFactor);

export default router;
