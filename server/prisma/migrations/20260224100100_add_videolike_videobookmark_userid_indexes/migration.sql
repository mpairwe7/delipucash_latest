-- Add userId indexes to VideoLike and VideoBookmark for personalized feed queries.
-- 10 of 21 backend queries filter by userId alone (getAllVideos, getTrendingVideos,
-- getFollowingVideos, getRecommendedVideos, searchVideos, getRandomVideos).

-- CreateIndex
CREATE INDEX "VideoBookmark_userId_idx" ON "VideoBookmark"("userId");

-- CreateIndex
CREATE INDEX "VideoLike_userId_idx" ON "VideoLike"("userId");
