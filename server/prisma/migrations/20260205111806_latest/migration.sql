-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "surveysubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_PENDING', 'REWARD_EARNED', 'REWARD_REDEEMED', 'SURVEY_COMPLETED', 'SURVEY_EXPIRING', 'SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_EXPIRED', 'SECURITY_ALERT', 'SYSTEM_UPDATE', 'PROMOTIONAL', 'ACHIEVEMENT', 'REFERRAL_BONUS', 'WELCOME');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT DEFAULT 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
    "role" "UserRole" DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorCode" TEXT,
    "twoFactorCodeExpiry" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "surveysubscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "currentSubscriptionId" UUID,
    "privacySettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "r2VideoKey" TEXT,
    "r2ThumbnailKey" TEXT,
    "r2VideoEtag" TEXT,
    "r2ThumbnailEtag" TEXT,
    "videoMimeType" TEXT,
    "thumbnailMimeType" TEXT,
    "videoSizeBytes" BIGINT,
    "thumbnailSizeBytes" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'r2',
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" TEXT,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livestream" (
    "id" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "streamKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "scheduledStartAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "maxDurationSeconds" INTEGER NOT NULL DEFAULT 300,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "peakViewerCount" INTEGER NOT NULL DEFAULT 0,
    "r2RecordingKey" TEXT,
    "r2ThumbnailKey" TEXT,
    "recordingUrl" TEXT,
    "thumbnailUrl" TEXT,
    "recordingSizeBytes" BIGINT,
    "isRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livestream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSurvey" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "placeholder" TEXT,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "userId" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "headline" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'regular',
    "placement" TEXT NOT NULL DEFAULT 'feed',
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "frequency" INTEGER,
    "lastShown" TIMESTAMP(3),
    "targetUrl" TEXT,
    "callToAction" TEXT NOT NULL DEFAULT 'learn_more',
    "pricingModel" TEXT NOT NULL DEFAULT 'cpm',
    "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyBudgetLimit" DOUBLE PRECISION,
    "amountSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetAgeRanges" JSONB,
    "targetGender" TEXT NOT NULL DEFAULT 'all',
    "targetLocations" JSONB,
    "targetInterests" JSONB,
    "enableRetargeting" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "r2ImageKey" TEXT,
    "r2VideoKey" TEXT,
    "r2ThumbnailKey" TEXT,
    "r2ImageEtag" TEXT,
    "r2VideoEtag" TEXT,
    "r2ThumbnailEtag" TEXT,
    "imageMimeType" TEXT,
    "videoMimeType" TEXT,
    "thumbnailMimeType" TEXT,
    "imageSizeBytes" BIGINT,
    "videoSizeBytes" BIGINT,
    "thumbnailSizeBytes" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'r2',

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "responses" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardQuestion" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "expiryTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isInstantReward" BOOLEAN NOT NULL DEFAULT false,
    "maxWinners" INTEGER NOT NULL DEFAULT 2,
    "winnersCount" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "paymentProvider" TEXT,
    "phoneNumber" TEXT,

    CONSTRAINT "RewardQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardQuestionOnAttempt" (
    "id" UUID NOT NULL,
    "rewardQuestionId" UUID NOT NULL,
    "questionAttemptId" UUID NOT NULL,

    CONSTRAINT "RewardQuestionOnAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstantRewardWinner" (
    "id" UUID NOT NULL,
    "rewardQuestionId" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "amountAwarded" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paymentProvider" TEXT,
    "phoneNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstantRewardWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" UUID NOT NULL,
    "responseText" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseLike" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseDislike" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseDislike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseReply" (
    "id" UUID NOT NULL,
    "replyText" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadQuestion" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT[],
    "correctAnswers" TEXT[],
    "placeholder" TEXT,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "questionId" UUID NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "TransactionId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "subscriptionType" "SubscriptionType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "icon" TEXT,
    "imageUrl" TEXT,
    "actionUrl" TEXT,
    "actionText" TEXT,
    "metadata" JSONB,
    "category" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),
    "sessionToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "Video_userId_idx" ON "Video"("userId");

-- CreateIndex
CREATE INDEX "Video_r2VideoKey_idx" ON "Video"("r2VideoKey");

-- CreateIndex
CREATE UNIQUE INDEX "Livestream_sessionId_key" ON "Livestream"("sessionId");

-- CreateIndex
CREATE INDEX "Livestream_userId_idx" ON "Livestream"("userId");

-- CreateIndex
CREATE INDEX "Livestream_sessionId_idx" ON "Livestream"("sessionId");

-- CreateIndex
CREATE INDEX "Livestream_status_idx" ON "Livestream"("status");

-- CreateIndex
CREATE INDEX "Ad_userId_idx" ON "Ad"("userId");

-- CreateIndex
CREATE INDEX "Ad_type_idx" ON "Ad"("type");

-- CreateIndex
CREATE INDEX "Ad_placement_idx" ON "Ad"("placement");

-- CreateIndex
CREATE INDEX "Ad_isActive_idx" ON "Ad"("isActive");

-- CreateIndex
CREATE INDEX "Ad_priority_idx" ON "Ad"("priority");

-- CreateIndex
CREATE INDEX "Ad_lastShown_idx" ON "Ad"("lastShown");

-- CreateIndex
CREATE INDEX "Ad_status_idx" ON "Ad"("status");

-- CreateIndex
CREATE INDEX "Ad_pricingModel_idx" ON "Ad"("pricingModel");

-- CreateIndex
CREATE INDEX "Ad_r2ImageKey_idx" ON "Ad"("r2ImageKey");

-- CreateIndex
CREATE INDEX "Ad_r2VideoKey_idx" ON "Ad"("r2VideoKey");

-- CreateIndex
CREATE INDEX "survey_responses_userId_idx" ON "survey_responses"("userId");

-- CreateIndex
CREATE INDEX "survey_responses_surveyId_idx" ON "survey_responses"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_userId_surveyId_key" ON "survey_responses"("userId", "surveyId");

-- CreateIndex
CREATE INDEX "RewardQuestion_userId_idx" ON "RewardQuestion"("userId");

-- CreateIndex
CREATE INDEX "RewardQuestion_isActive_idx" ON "RewardQuestion"("isActive");

-- CreateIndex
CREATE INDEX "RewardQuestion_expiryTime_idx" ON "RewardQuestion"("expiryTime");

-- CreateIndex
CREATE INDEX "RewardQuestion_isInstantReward_idx" ON "RewardQuestion"("isInstantReward");

-- CreateIndex
CREATE INDEX "RewardQuestion_isCompleted_idx" ON "RewardQuestion"("isCompleted");

-- CreateIndex
CREATE INDEX "RewardQuestionOnAttempt_rewardQuestionId_questionAttemptId_idx" ON "RewardQuestionOnAttempt"("rewardQuestionId", "questionAttemptId");

-- CreateIndex
CREATE INDEX "InstantRewardWinner_rewardQuestionId_idx" ON "InstantRewardWinner"("rewardQuestionId");

-- CreateIndex
CREATE INDEX "InstantRewardWinner_userEmail_idx" ON "InstantRewardWinner"("userEmail");

-- CreateIndex
CREATE INDEX "InstantRewardWinner_paymentStatus_idx" ON "InstantRewardWinner"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "InstantRewardWinner_rewardQuestionId_userEmail_key" ON "InstantRewardWinner"("rewardQuestionId", "userEmail");

-- CreateIndex
CREATE INDEX "Response_userId_questionId_idx" ON "Response"("userId", "questionId");

-- CreateIndex
CREATE INDEX "ResponseLike_responseId_idx" ON "ResponseLike"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseLike_userId_responseId_key" ON "ResponseLike"("userId", "responseId");

-- CreateIndex
CREATE INDEX "ResponseDislike_responseId_idx" ON "ResponseDislike"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDislike_userId_responseId_key" ON "ResponseDislike"("userId", "responseId");

-- CreateIndex
CREATE INDEX "ResponseReply_responseId_idx" ON "ResponseReply"("responseId");

-- CreateIndex
CREATE INDEX "ResponseReply_userId_idx" ON "ResponseReply"("userId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userEmail_questionId_idx" ON "QuestionAttempt"("userEmail", "questionId");

-- CreateIndex
CREATE INDEX "Reward_userEmail_idx" ON "Reward"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_TransactionId_key" ON "Payment"("TransactionId");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_idx" ON "Notification"("userId", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_priority_idx" ON "Notification"("userId", "priority");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginSession_userId_idx" ON "LoginSession"("userId");

-- CreateIndex
CREATE INDEX "LoginSession_isActive_idx" ON "LoginSession"("isActive");

-- CreateIndex
CREATE INDEX "LoginSession_sessionToken_idx" ON "LoginSession"("sessionToken");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSurvey" ADD CONSTRAINT "UploadSurvey_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSurvey" ADD CONSTRAINT "UploadSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQuestion" ADD CONSTRAINT "RewardQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQuestionOnAttempt" ADD CONSTRAINT "RewardQuestionOnAttempt_questionAttemptId_fkey" FOREIGN KEY ("questionAttemptId") REFERENCES "QuestionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQuestionOnAttempt" ADD CONSTRAINT "RewardQuestionOnAttempt_rewardQuestionId_fkey" FOREIGN KEY ("rewardQuestionId") REFERENCES "RewardQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantRewardWinner" ADD CONSTRAINT "InstantRewardWinner_rewardQuestionId_fkey" FOREIGN KEY ("rewardQuestionId") REFERENCES "RewardQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantRewardWinner" ADD CONSTRAINT "InstantRewardWinner_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "AppUser"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseLike" ADD CONSTRAINT "ResponseLike_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseLike" ADD CONSTRAINT "ResponseLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseDislike" ADD CONSTRAINT "ResponseDislike_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseDislike" ADD CONSTRAINT "ResponseDislike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseReply" ADD CONSTRAINT "ResponseReply_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseReply" ADD CONSTRAINT "ResponseReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadQuestion" ADD CONSTRAINT "UploadQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "AppUser"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "AppUser"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
