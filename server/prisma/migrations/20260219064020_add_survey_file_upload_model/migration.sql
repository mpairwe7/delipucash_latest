-- CreateTable
CREATE TABLE "SurveyFileUpload" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "responseId" UUID,
    "questionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "r2Etag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyFileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyFileUpload_surveyId_questionId_idx" ON "SurveyFileUpload"("surveyId", "questionId");

-- CreateIndex
CREATE INDEX "SurveyFileUpload_userId_idx" ON "SurveyFileUpload"("userId");

-- CreateIndex
CREATE INDEX "SurveyFileUpload_r2Key_idx" ON "SurveyFileUpload"("r2Key");

-- AddForeignKey
ALTER TABLE "SurveyFileUpload" ADD CONSTRAINT "SurveyFileUpload_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyFileUpload" ADD CONSTRAINT "SurveyFileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
