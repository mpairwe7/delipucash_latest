/**
 * Video Reseed Script
 *
 * Clears all existing video data (videos, likes, bookmarks, comments)
 * and inserts fresh sample videos using publicly accessible Google
 * sample video URLs — no R2 dependency.
 *
 * Run: node scripts/seed-videos.mjs
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ── Database connection (bypass Accelerate cache) ────────────────────────────
const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_VIDEOS = [
  {
    title: 'How to Earn Money with DelipuCash',
    description: 'Learn the best strategies to maximize your earnings on DelipuCash through surveys, quizzes, and reward questions.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://picsum.photos/seed/earnings/640/360',
    duration: 60,
    likes: 24,
    views: 312,
  },
  {
    title: 'Top 5 Savings Tips for Students',
    description: 'Simple and practical savings tips every student in Uganda should know. Start building wealth early!',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnail: 'https://picsum.photos/seed/savings/640/360',
    duration: 45,
    likes: 18,
    views: 198,
  },
  {
    title: 'Mobile Money vs. Bank Account — Which is Better?',
    description: 'A detailed comparison of MTN Mobile Money, Airtel Money, and traditional bank accounts in Uganda.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://picsum.photos/seed/mobile/640/360',
    duration: 75,
    likes: 42,
    views: 567,
  },
  {
    title: 'Understanding Financial Literacy',
    description: 'Breaking down the basics of financial literacy — budgeting, investing, and growing your money.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://picsum.photos/seed/finance/640/360',
    duration: 55,
    likes: 31,
    views: 423,
  },
  {
    title: 'Survey Strategies — Complete More, Earn More',
    description: 'Tips and tricks for completing surveys faster and getting the most points per question.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnail: 'https://picsum.photos/seed/survey/640/360',
    duration: 50,
    likes: 15,
    views: 156,
  },
  {
    title: 'How Airtime Rewards Work',
    description: 'Step-by-step guide on redeeming your DelipuCash points for airtime on MTN and Airtel networks.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    thumbnail: 'https://picsum.photos/seed/rewards/640/360',
    duration: 40,
    likes: 27,
    views: 289,
  },
  {
    title: 'Building a Side Income Online',
    description: 'Explore different ways to earn money online in East Africa — from micro-tasks to content creation.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    thumbnail: 'https://picsum.photos/seed/business/640/360',
    duration: 90,
    likes: 56,
    views: 834,
  },
  {
    title: 'Investment Basics for Beginners',
    description: 'An introduction to investing — stocks, bonds, mutual funds, and how to get started with small amounts.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail: 'https://picsum.photos/seed/investment/640/360',
    duration: 65,
    likes: 38,
    views: 512,
  },
  {
    title: 'Tech Tips — Get More From Your Smartphone',
    description: 'Hidden features and productivity hacks for your Android or iPhone that save time and money.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    thumbnail: 'https://picsum.photos/seed/tech/640/360',
    duration: 70,
    likes: 22,
    views: 345,
  },
  {
    title: 'Daily Quiz Challenge — How It Works',
    description: 'Everything you need to know about the daily quiz challenge, streak bonuses, and how to maximize rewards.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://picsum.photos/seed/tips/640/360',
    duration: 35,
    likes: 12,
    views: 178,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬 Video Reseed Script\n');

  // 1. Find the admin user (or any user) to attach videos to
  const adminUser = await prisma.appUser.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!adminUser) {
    console.error('❌ No admin user found. Run `npx prisma db seed` first.');
    process.exit(1);
  }

  console.log(`👤 Using user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})\n`);

  // 2. Clear existing video data (order matters — foreign keys)
  console.log('🗑️  Clearing existing video data...');
  const deletedComments = await prisma.comment.deleteMany({});
  const deletedLikes = await prisma.videoLike.deleteMany({});
  const deletedBookmarks = await prisma.videoBookmark.deleteMany({});
  const deletedVideos = await prisma.video.deleteMany({});

  console.log(`   Deleted ${deletedComments.count} comments`);
  console.log(`   Deleted ${deletedLikes.count} likes`);
  console.log(`   Deleted ${deletedBookmarks.count} bookmarks`);
  console.log(`   Deleted ${deletedVideos.count} videos\n`);

  // 3. Insert new sample videos
  console.log('📦 Inserting sample videos...');

  const createdVideos = [];
  for (const [index, video] of SAMPLE_VIDEOS.entries()) {
    const created = await prisma.video.create({
      data: {
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
        thumbnail: video.thumbnail,
        userId: adminUser.id,
        duration: video.duration,
        likes: video.likes,
        views: video.views,
        commentsCount: 0,
        // No R2 keys — these are public Google URLs, so the signed-URL
        // fallback path in videoController will serve them directly.
        storageProvider: 'external',
        isProcessed: true,
        processingStatus: 'completed',
        // Stagger creation dates so feed has time-based ordering
        createdAt: new Date(Date.now() - (SAMPLE_VIDEOS.length - index) * 3600_000),
      },
    });

    createdVideos.push(created);
    console.log(`   ✅ ${index + 1}. ${video.title}`);
  }

  console.log(`\n🎉 Successfully seeded ${createdVideos.length} videos!`);
  console.log('   All videos use publicly accessible Google sample URLs.');
  console.log('   No R2 bucket access required for playback.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
