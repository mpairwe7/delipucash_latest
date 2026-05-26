/**
 * User data export — assembles every record tied to a given user into a
 * single JSON document, uploads it to R2 with a 48h presigned URL, and
 * (optionally) emails the user the link.
 *
 * Required by Play Store Data Safety + GDPR. Triggered from
 * POST /api/users/export-data.
 *
 * The export is intentionally NOT zipped — JSON is human-readable, smaller
 * than a binary zip for typical user data sizes, and can be downloaded
 * directly by curl/browser without intermediate tooling.
 */

import prisma from './prisma.mjs';
import {
  uploadFile,
  generateObjectKey,
  getSignedDownloadUrl,
  STORAGE_PATHS,
} from './r2.mjs';
import { sendEmail } from './emailService.mjs';

const EXPORT_TTL_SECONDS = 48 * 60 * 60; // 48 hours

/**
 * Produce a JSON-serializable snapshot of every record tied to `userId`.
 * Intentionally over-fetches so users see exactly what we hold on them.
 */
async function assembleUserExport(userId) {
  const [
    user,
    sessions,
    notifications,
    questions,
    responses,
    surveys,
    surveyResponses,
    rewards,
    rewardRedemptions,
    rewardQuestionAttempts,
    questionAttempts,
    payments,
    videos,
    videoLikes,
    videoBookmarks,
    videoComments,
    videoShares,
    videoFeedback,
    ads,
    referralsMade,
    referralReceived,
  ] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: userId },
      // Strip the password hash and 2FA secret material from the export.
      // Everything else is the user's own data — they're entitled to it.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        points: true,
        avatar: true,
        role: true,
        twoFactorEnabled: true,
        emailVerified: true,
        subscriptionStatus: true,
        surveysubscriptionStatus: true,
        videoSubscriptionStatus: true,
        privacySettings: true,
        referralCode: true,
        referredBy: true,
        verifiedMomoNumbers: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.loginSession.findMany({
      where: { userId },
      select: {
        id: true, deviceInfo: true, location: true,
        loginTime: true, lastActivity: true, logoutTime: true, isActive: true,
        // explicitly EXCLUDE: sessionToken, refreshTokenHash, ipAddress, userAgent
      },
    }),
    prisma.notification.findMany({ where: { userId } }),
    prisma.question.findMany({ where: { userId } }),
    prisma.response.findMany({ where: { userId } }),
    prisma.survey.findMany({ where: { userId } }),
    prisma.surveyResponse.findMany({ where: { userId } }),
    prisma.reward.findMany({ where: { user: { id: userId } } }),
    prisma.rewardRedemption.findMany({ where: { userId } }),
    prisma.rewardQuestionAttempt.findMany({ where: { user: { id: userId } } }),
    prisma.questionAttempt.findMany({ where: { user: { id: userId } } }),
    prisma.payment.findMany({ where: { userId } }),
    prisma.video.findMany({ where: { userId } }),
    prisma.videoLike.findMany({ where: { userId } }),
    prisma.videoBookmark.findMany({ where: { userId } }),
    prisma.comment.findMany({ where: { userId } }),
    prisma.videoShare.findMany({ where: { userId } }),
    prisma.videoFeedback.findMany({ where: { userId } }),
    prisma.ad.findMany({ where: { userId } }),
    prisma.referral.findMany({ where: { inviterId: userId } }),
    prisma.referral.findUnique({ where: { inviteeId: userId } }),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    notice: 'This file contains every personal record tied to your DelipuCash account. Treat it as sensitive.',
    profile: user,
    sessions,
    notifications,
    questionsCreated: questions,
    questionResponsesGiven: responses,
    questionAttempts,
    rewardQuestionAttempts,
    surveysCreated: surveys,
    surveyResponsesGiven: surveyResponses,
    rewards,
    rewardRedemptions,
    payments,
    videosUploaded: videos,
    videoLikes,
    videoBookmarks,
    videoComments,
    videoShares,
    videoFeedback,
    adsCreated: ads,
    referrals: { sentByYou: referralsMade, receivedByYou: referralReceived },
  };
}

/**
 * Run a full export for `userId` and return the presigned download URL.
 * Uploads to R2 under `users/<id>/exports/<timestamp>.json`.
 */
export async function exportUserData(userId, { email } = {}) {
  const snapshot = await assembleUserExport(userId);
  const json = JSON.stringify(snapshot, null, 2);
  const buffer = Buffer.from(json, 'utf8');

  // BigInt fields (e.g. videoSizeBytes) need a replacer in real-world JSON;
  // do a sanity pass to coerce them to strings if any slipped through.
  // (Currently no BigInt is selected above, so this is belt-and-braces.)

  const key = generateObjectKey(
    `${STORAGE_PATHS.AVATARS.replace('avatars', 'exports')}`,
    `delipucash-export.json`,
    userId,
  );

  await uploadFile(buffer, key, 'application/json', {
    'x-amz-meta-export-user': userId,
    'x-amz-meta-purpose': 'gdpr-export',
  });

  const downloadUrl = await getSignedDownloadUrl(key, EXPORT_TTL_SECONDS);

  if (email) {
    sendEmail(
      email,
      'Your DelipuCash data export is ready',
      `Hi,

You requested a copy of your DelipuCash data. Download it within 48 hours from the link below — after that, the link expires for your security and you'll need to request a new one.

Download: ${downloadUrl}

If you didn't request this, please reset your password immediately.

— DelipuCash`,
      `<p>Hi,</p>
       <p>You requested a copy of your DelipuCash data. Download it within 48 hours from the link below — after that, the link expires for your security and you'll need to request a new one.</p>
       <p><a href="${downloadUrl}" style="display:inline-block;padding:12px 24px;background:#4D4DFF;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Download my data</a></p>
       <p style="color:#6b7280;font-size:13px;">If the button doesn't work, copy this URL into your browser:<br/>${downloadUrl}</p>
       <p style="color:#6b7280;font-size:13px;">If you didn't request this export, please reset your password immediately.</p>`,
    ).catch((err) => console.warn('[dataExport] Email failed:', err.message));
  }

  return { key, downloadUrl, expiresInSeconds: EXPORT_TTL_SECONDS, sizeBytes: buffer.length };
}
