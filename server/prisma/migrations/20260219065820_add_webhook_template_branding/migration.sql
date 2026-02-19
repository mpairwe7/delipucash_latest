-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "branding" JSONB;

-- CreateTable
CREATE TABLE "SurveyWebhook" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFired" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyTemplate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "questions" JSONB NOT NULL,
    "branding" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyWebhook_surveyId_idx" ON "SurveyWebhook"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyTemplate_userId_idx" ON "SurveyTemplate"("userId");

-- CreateIndex
CREATE INDEX "SurveyTemplate_isPublic_idx" ON "SurveyTemplate"("isPublic");

-- AddForeignKey
ALTER TABLE "SurveyWebhook" ADD CONSTRAINT "SurveyWebhook_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyTemplate" ADD CONSTRAINT "SurveyTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
