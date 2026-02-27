-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "magicLinkExpiry" TIMESTAMP(3),
ADD COLUMN     "magicLinkToken" TEXT;
