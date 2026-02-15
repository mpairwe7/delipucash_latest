-- AlterTable
ALTER TABLE "LoginSession" ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenHash" TEXT,
ADD COLUMN     "tokenFamily" UUID;

-- CreateIndex
CREATE INDEX "LoginSession_refreshTokenHash_idx" ON "LoginSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "LoginSession_tokenFamily_idx" ON "LoginSession"("tokenFamily");
