import prisma from '../lib/prisma.mjs';

/**
 * Server-side survey-creator paywall.
 *
 * The client gates survey creation behind useSurveyCreatorAccess, but until
 * this middleware existed the /create + /upload endpoints accepted ANY
 * authenticated user — the paywall was client-only and a direct API call
 * bypassed it entirely.
 *
 * Access predicate mirrors getUnifiedSubscriptionStatus
 * (surveyPaymentController.mjs): ADMIN/MODERATOR bypass, or
 * surveysubscriptionStatus === 'ACTIVE' (store-billing sync), or legacy
 * subscriptionStatus === 'ACTIVE', or an unexpired SUCCESSFUL MoMo payment for
 * the SURVEY feature. RevenueCat entitlements that haven't synced a status
 * column yet are covered by the status checks the sync writes to.
 *
 * Runs AFTER verifyToken (needs req.user.id).
 */
export async function requireSurveyCreatorAccess(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { role: true, surveysubscriptionStatus: true, subscriptionStatus: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Account not found' });
    }

    if (user.role === 'ADMIN' || user.role === 'MODERATOR') return next();
    if (user.surveysubscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'ACTIVE') return next();

    // Active billing window only — a future-dated payment must not grant
    // access early (startDate), nor an expired one late (endDate).
    const now = new Date();
    const momoPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: 'SUCCESSFUL',
        featureType: 'SURVEY',
        startDate: { lte: now },
        endDate: { gt: now },
      },
      select: { id: true },
    });
    if (momoPayment) return next();

    return res.status(403).json({
      success: false,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'An active survey subscription is required to create surveys.',
    });
  } catch (error) {
    console.error('[surveyAccess] Error checking creator access:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify survey access' });
  }
}
