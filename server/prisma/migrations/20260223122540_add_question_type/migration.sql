-- AlterTable
ALTER TABLE "RewardQuestion" ADD COLUMN     "matchMode" TEXT NOT NULL DEFAULT 'case_insensitive',
ADD COLUMN     "questionType" TEXT NOT NULL DEFAULT 'multiple_choice';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
