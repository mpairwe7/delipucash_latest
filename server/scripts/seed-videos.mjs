/**
 * Video Reseed Script — Multi-Creator Edition
 *
 * Creates a realistic video ecosystem matching the frontend tab logic:
 *   - Following: Videos from creators the user follows (+ engagement proxy fallback)
 *   - For You:   ML-lite personalized feed with diversity enforcement (max 2/creator)
 *   - Trending:  Engagement-velocity scoring with time-decay (min 10 views, max 3/creator)
 *
 * Seed data includes:
 *   - 6 creator profiles (reuses existing users or creates sample creators)
 *   - 30 videos distributed across creators (5 each)
 *   - CreatorFollow records (follow graph for Following tab)
 *   - VideoLike records (engagement for feed ranking + Following fallback)
 *   - VideoBookmark records (engagement signal)
 *   - VideoEvent telemetry records (personalization signals for For You tab)
 *   - Realistic engagement metrics (views, likes, shares, completions)
 *   - Topic tags, country/language metadata (regional trending)
 *
 * Public video URLs from Google's GTV sample bucket — no R2/S3 dependency.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Random integer in [min, max] */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Random item from array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Random subset of array */
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

/** Hours ago as Date */
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000);

// ── Public video URLs (Google GTV sample bucket — highly reliable) ───────────
// These are Google-hosted sample videos used by Chromecast/Android TV demos.
// They are stable, CORS-friendly, and don't require authentication.

const VIDEO_URLS = [
  // Short clips (15s each) — perfect for short-form vertical feed
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',       duration: 15 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',      duration: 15 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',          duration: 60 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',     duration: 15 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',    duration: 15 },
  // Medium clips
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 66 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',   duration: 66 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',   duration: 47 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4', duration: 72 },
  // Longer clips (feature-length samples)
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',          duration: 596 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',        duration: 653 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',                duration: 888 },
  { url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',          duration: 734 },
];

// ── Creator profiles ─────────────────────────────────────────────────────────

const CREATOR_PROFILES = [
  { firstName: 'Sarah',   lastName: 'Nakamya',   email: 'sarah.creator@delipucash.test',  phone: '+256700100001' },
  { firstName: 'James',   lastName: 'Okello',    email: 'james.creator@delipucash.test',  phone: '+256700100002' },
  { firstName: 'Grace',   lastName: 'Achieng',   email: 'grace.creator@delipucash.test',  phone: '+256700100003' },
  { firstName: 'David',   lastName: 'Mugisha',   email: 'david.creator@delipucash.test',  phone: '+256700100004' },
  { firstName: 'Faith',   lastName: 'Nabirye',   email: 'faith.creator@delipucash.test',  phone: '+256700100005' },
  { firstName: 'Brian',   lastName: 'Ssemanda',  email: 'brian.creator@delipucash.test',  phone: '+256700100006' },
];

// ── Video content library ────────────────────────────────────────────────────
// 30 videos across 6 creators (5 per creator), covering diverse topics

const TOPIC_TAGS = {
  finance: ['finance', 'money', 'savings', 'investment'],
  tech: ['tech', 'gadgets', 'smartphone', 'apps'],
  education: ['education', 'learning', 'tips', 'howto'],
  lifestyle: ['lifestyle', 'daily', 'motivation', 'wellness'],
  business: ['business', 'entrepreneur', 'side-hustle', 'income'],
  entertainment: ['entertainment', 'fun', 'challenge', 'trending'],
};

const SAMPLE_VIDEOS = [
  // ── Creator 0: Sarah Nakamya (Finance & Savings) ──
  { creatorIdx: 0, title: 'How to Save 50% of Your Salary',            desc: 'Practical budgeting strategies that help you save half your income every month.',             tags: TOPIC_TAGS.finance,       views: 1240, likes: 89,  shares: 34, completions: 620, hoursOld: 6   },
  { creatorIdx: 0, title: 'MTN Mobile Money Hidden Fees Exposed',       desc: 'A breakdown of all the hidden charges in MTN Mobile Money transactions.',                    tags: TOPIC_TAGS.finance,       views: 2800, likes: 215, shares: 92, completions: 1400, hoursOld: 18  },
  { creatorIdx: 0, title: 'Best Investment Apps in Uganda 2026',        desc: 'My top 5 investment platforms accessible from Uganda with as little as 5,000 UGX.',           tags: TOPIC_TAGS.finance,       views: 890,  likes: 67,  shares: 28, completions: 445, hoursOld: 48  },
  { creatorIdx: 0, title: 'Emergency Fund — How Much Do You Need?',     desc: 'Calculate exactly how much you should keep in your emergency fund based on your expenses.',   tags: TOPIC_TAGS.finance,       views: 560,  likes: 41,  shares: 15, completions: 280, hoursOld: 96  },
  { creatorIdx: 0, title: 'Airtel Money vs MTN MoMo Comparison',        desc: 'Head-to-head comparison of fees, limits, and features between the two mobile money giants.',   tags: TOPIC_TAGS.finance,       views: 3200, likes: 248, shares: 110, completions: 1920, hoursOld: 3  },

  // ── Creator 1: James Okello (Tech & Gadgets) ──
  { creatorIdx: 1, title: 'Top 5 Budget Phones Under 500K UGX',        desc: 'Best smartphones you can get in Uganda without breaking the bank. Full comparison.',           tags: TOPIC_TAGS.tech,          views: 4500, likes: 320, shares: 145, completions: 2700, hoursOld: 12  },
  { creatorIdx: 1, title: 'How to Get Free WiFi Anywhere',             desc: 'Legal tips for finding free internet access points across Kampala and major towns.',            tags: TOPIC_TAGS.tech,          views: 6200, likes: 510, shares: 280, completions: 4340, hoursOld: 5   },
  { creatorIdx: 1, title: 'Android Hidden Settings You Must Know',      desc: 'Secret developer settings that can speed up your phone and save battery life.',                tags: TOPIC_TAGS.tech,          views: 1800, likes: 134, shares: 56,  completions: 900, hoursOld: 72  },
  { creatorIdx: 1, title: 'Best Free Apps for Students 2026',           desc: 'Essential apps every student needs — from note-taking to budget tracking, all free.',          tags: TOPIC_TAGS.tech,          views: 980,  likes: 72,  shares: 31, completions: 490, hoursOld: 120 },
  { creatorIdx: 1, title: 'Data Saver Tricks for Low-Budget Plans',     desc: 'Reduce your mobile data usage by 70% with these simple settings changes.',                    tags: TOPIC_TAGS.tech,          views: 2100, likes: 168, shares: 74, completions: 1260, hoursOld: 24  },

  // ── Creator 2: Grace Achieng (Education & Tips) ──
  { creatorIdx: 2, title: 'How to Ace DelipuCash Surveys',             desc: 'Pro tips for completing surveys faster and earning maximum rewards every time.',              tags: TOPIC_TAGS.education,     views: 1500, likes: 112, shares: 45, completions: 900, hoursOld: 8   },
  { creatorIdx: 2, title: 'Study Hacks That Actually Work',            desc: 'Science-backed study techniques that improve retention and save you hours of revision.',        tags: TOPIC_TAGS.education,     views: 3400, likes: 276, shares: 120, completions: 2380, hoursOld: 15  },
  { creatorIdx: 2, title: 'English Vocabulary for Everyday Use',       desc: 'Common English phrases and vocabulary that will help you communicate more confidently.',        tags: TOPIC_TAGS.education,     views: 780,  likes: 58,  shares: 22, completions: 390, hoursOld: 60  },
  { creatorIdx: 2, title: 'How to Write a Winning CV',                 desc: 'Step-by-step guide to writing a professional CV that stands out to employers in East Africa.',  tags: TOPIC_TAGS.education,     views: 2200, likes: 178, shares: 85, completions: 1540, hoursOld: 36  },
  { creatorIdx: 2, title: 'Quiz Strategies — Score Higher Every Time', desc: 'Mental techniques and strategies for the daily quiz challenge on DelipuCash.',                tags: TOPIC_TAGS.education,     views: 640,  likes: 48,  shares: 18, completions: 384, hoursOld: 100 },

  // ── Creator 3: David Mugisha (Business & Income) ──
  { creatorIdx: 3, title: 'Side Hustles That Pay in UGX',              desc: 'Realistic side business ideas you can start today with less than 100K UGX capital.',            tags: TOPIC_TAGS.business,      views: 5100, likes: 390, shares: 170, completions: 3570, hoursOld: 10  },
  { creatorIdx: 3, title: 'How I Made 500K in One Week on DelipuCash', desc: 'My real earnings breakdown from surveys, quizzes, and reward questions in 7 days.',             tags: TOPIC_TAGS.business,      views: 8200, likes: 680, shares: 350, completions: 6560, hoursOld: 2   },
  { creatorIdx: 3, title: 'Freelancing in East Africa — Getting Started', desc: 'A complete beginner guide to freelancing on Upwork, Fiverr, and local platforms.',          tags: TOPIC_TAGS.business,      views: 1200, likes: 92,  shares: 38, completions: 600, hoursOld: 48  },
  { creatorIdx: 3, title: 'Dropshipping from Uganda — Is It Worth It?', desc: 'Honest review of dropshipping opportunities and challenges from an East African perspective.',tags: TOPIC_TAGS.business,      views: 3600, likes: 287, shares: 125, completions: 2520, hoursOld: 20  },
  { creatorIdx: 3, title: 'How to Price Your Services',                desc: 'A framework for setting prices that attract clients while keeping your business profitable.',    tags: TOPIC_TAGS.business,      views: 920,  likes: 69,  shares: 27, completions: 460, hoursOld: 80  },

  // ── Creator 4: Faith Nabirye (Lifestyle & Motivation) ──
  { creatorIdx: 4, title: 'Morning Routine for Productivity',          desc: 'My 5 AM morning routine that transformed my productivity and energy levels.',                  tags: TOPIC_TAGS.lifestyle,     views: 2900, likes: 220, shares: 95, completions: 2030, hoursOld: 14  },
  { creatorIdx: 4, title: 'How I Stay Motivated Every Day',            desc: 'Practical motivation tips that go beyond "just believe in yourself" — real strategies.',        tags: TOPIC_TAGS.lifestyle,     views: 1600, likes: 128, shares: 52, completions: 960, hoursOld: 30  },
  { creatorIdx: 4, title: 'Healthy Eating on a Student Budget',        desc: 'Nutritious meals you can prepare for under 5,000 UGX that taste amazing.',                    tags: TOPIC_TAGS.lifestyle,     views: 4100, likes: 334, shares: 148, completions: 2870, hoursOld: 7   },
  { creatorIdx: 4, title: 'Dealing with Exam Stress',                  desc: 'Mental health tips for managing anxiety during exam season — you are not alone.',              tags: TOPIC_TAGS.lifestyle,     views: 1100, likes: 89,  shares: 35, completions: 660, hoursOld: 55  },
  { creatorIdx: 4, title: 'Weekend Self-Care Ideas (Free!)',           desc: 'Self-care activities that cost absolutely nothing but make a huge difference.',                 tags: TOPIC_TAGS.lifestyle,     views: 750,  likes: 56,  shares: 21, completions: 375, hoursOld: 110 },

  // ── Creator 5: Brian Ssemanda (Entertainment & Trending) ──
  { creatorIdx: 5, title: 'Kampala Street Food Tour',                  desc: 'Trying the best street food in Kampala — rolex, kikomando, and hidden gems you must try.',     tags: TOPIC_TAGS.entertainment, views: 7500, likes: 620, shares: 310, completions: 5625, hoursOld: 4   },
  { creatorIdx: 5, title: 'Guess the Price Challenge',                 desc: 'Can you guess how much these everyday items cost? Fun challenge with surprising answers!',      tags: TOPIC_TAGS.entertainment, views: 3800, likes: 305, shares: 135, completions: 2660, hoursOld: 16  },
  { creatorIdx: 5, title: 'Day in My Life — University Edition',       desc: 'What a typical day looks like as a university student in Uganda. Lectures, hustle, and fun.',    tags: TOPIC_TAGS.entertainment, views: 2400, likes: 192, shares: 78, completions: 1440, hoursOld: 28  },
  { creatorIdx: 5, title: 'Things Ugandans Say vs What They Mean',     desc: 'Hilarious compilation of everyday Ugandan phrases and their real hidden meanings.',             tags: TOPIC_TAGS.entertainment, views: 9500, likes: 780, shares: 420, completions: 7600, hoursOld: 1   },
  { creatorIdx: 5, title: 'TikTok Trends vs Reality — Uganda Edition', desc: 'Recreating viral TikTok trends and seeing if they actually work in real life here in UG.',      tags: TOPIC_TAGS.entertainment, views: 5800, likes: 470, shares: 210, completions: 4060, hoursOld: 22  },
];

// Telemetry event types with weights (higher weight = more common)
const EVENT_TYPES = [
  { type: 'impression',   weight: 10 },
  { type: 'play_3s',      weight: 8 },
  { type: 'play_25pct',   weight: 6 },
  { type: 'play_50pct',   weight: 5 },
  { type: 'play_75pct',   weight: 3 },
  { type: 'play_100pct',  weight: 2 },
  { type: 'skip',         weight: 4 },
  { type: 'like',         weight: 2 },
  { type: 'bookmark',     weight: 1 },
  { type: 'share',        weight: 1 },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬 Video Reseed Script — Multi-Creator Edition\n');

  // ── Step 1: Find or create primary user (the "viewer" who will have engagement data) ──
  const primaryUser = await prisma.appUser.findFirst({
    where: { role: { in: ['ADMIN', 'USER'] } },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!primaryUser) {
    console.error('❌ No users found. Run the main seed first.');
    process.exit(1);
  }

  console.log(`👤 Primary viewer: ${primaryUser.firstName} ${primaryUser.lastName} (${primaryUser.email})`);

  // ── Step 2: Find or create creator users ──
  console.log('\n📋 Setting up creator accounts...');
  const creators = [];

  for (const profile of CREATOR_PROFILES) {
    let user = await prisma.appUser.findFirst({
      where: { email: profile.email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      user = await prisma.appUser.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          password: '$2b$10$placeholder_hash_not_for_login', // Not a real password
          role: 'USER',
          followersCount: 0,
          followingCount: 0,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      console.log(`   ✅ Created: ${user.firstName} ${user.lastName}`);
    } else {
      console.log(`   ♻️  Reusing: ${user.firstName} ${user.lastName}`);
    }

    creators.push(user);
  }

  // ── Step 3: Clear existing video data (order matters — foreign keys) ──
  console.log('\n🗑️  Clearing existing video data...');
  const deletedEvents    = await prisma.videoEvent.deleteMany({});
  const deletedFeedback  = await prisma.videoFeedback.deleteMany({});
  const deletedShares    = await prisma.videoShare.deleteMany({});
  const deletedComments  = await prisma.comment.deleteMany({});
  const deletedLikes     = await prisma.videoLike.deleteMany({});
  const deletedBookmarks = await prisma.videoBookmark.deleteMany({});
  const deletedVideos    = await prisma.video.deleteMany({});
  const deletedFollows   = await prisma.creatorFollow.deleteMany({
    where: {
      OR: [
        { followerId: primaryUser.id },
        { followerId: { in: creators.map(c => c.id) } },
      ],
    },
  });

  console.log(`   Events: ${deletedEvents.count}, Feedback: ${deletedFeedback.count}, Shares: ${deletedShares.count}`);
  console.log(`   Comments: ${deletedComments.count}, Likes: ${deletedLikes.count}, Bookmarks: ${deletedBookmarks.count}`);
  console.log(`   Videos: ${deletedVideos.count}, Follows: ${deletedFollows.count}`);

  // ── Step 4: Create videos (30 videos across 6 creators) ──
  console.log('\n📦 Creating 30 videos across 6 creators...');
  const createdVideos = [];

  for (const [index, video] of SAMPLE_VIDEOS.entries()) {
    const creator = creators[video.creatorIdx];
    const videoSource = VIDEO_URLS[index % VIDEO_URLS.length];

    const created = await prisma.video.create({
      data: {
        title: video.title,
        description: video.desc,
        videoUrl: videoSource.url,
        thumbnail: `https://picsum.photos/seed/vid${index}/640/360`,
        userId: creator.id,
        duration: videoSource.duration,
        likes: video.likes,
        views: video.views,
        sharesCount: video.shares,
        completionsCount: video.completions,
        commentsCount: 0,
        topicTags: video.tags,
        country: 'UG',
        language: 'en',
        storageProvider: 'external',
        isProcessed: true,
        processingStatus: 'completed',
        createdAt: hoursAgo(video.hoursOld),
      },
    });

    createdVideos.push({ ...created, creatorIdx: video.creatorIdx, hoursOld: video.hoursOld });
    console.log(`   ✅ ${String(index + 1).padStart(2)}. [${creator.firstName}] ${video.title}`);
  }

  // ── Step 5: Create follow graph ──
  // Primary user follows 4 of 6 creators (so Following tab has content + For You has follow-boost)
  console.log('\n🔗 Creating follow graph...');
  const followedCreators = creators.slice(0, 4); // Follow first 4 creators

  for (const creator of followedCreators) {
    if (creator.id === primaryUser.id) continue; // Don't self-follow

    await prisma.creatorFollow.create({
      data: {
        followerId: primaryUser.id,
        followingId: creator.id,
      },
    });

    // Update denormalized follower counts
    await prisma.appUser.update({
      where: { id: creator.id },
      data: { followersCount: { increment: 1 } },
    });
    await prisma.appUser.update({
      where: { id: primaryUser.id },
      data: { followingCount: { increment: 1 } },
    });

    console.log(`   ✅ ${primaryUser.firstName} → follows → ${creator.firstName} ${creator.lastName}`);
  }

  // Also create some inter-creator follows for organic feel
  const interCreatorFollows = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // Chain
    [0, 3], [1, 4], [2, 5], // Cross links
  ];

  for (const [fromIdx, toIdx] of interCreatorFollows) {
    const from = creators[fromIdx];
    const to = creators[toIdx];
    if (from.id === to.id) continue;

    try {
      await prisma.creatorFollow.create({
        data: { followerId: from.id, followingId: to.id },
      });
      await prisma.appUser.update({
        where: { id: to.id },
        data: { followersCount: { increment: 1 } },
      });
      await prisma.appUser.update({
        where: { id: from.id },
        data: { followingCount: { increment: 1 } },
      });
    } catch {
      // Skip duplicate follows
    }
  }
  console.log(`   ✅ Created ${interCreatorFollows.length} inter-creator follow links`);

  // ── Step 6: Create VideoLike records ──
  // Primary user likes ~60% of videos (engagement signal for feed ranking)
  console.log('\n❤️  Creating like records...');
  const likedVideos = pickN(createdVideos, Math.ceil(createdVideos.length * 0.6));
  let likeCount = 0;

  for (const video of likedVideos) {
    await prisma.videoLike.create({
      data: { userId: primaryUser.id, videoId: video.id },
    });
    likeCount++;
  }

  // Some creators also like each other's videos
  for (const creator of creators) {
    const othersVideos = createdVideos.filter(v => v.userId !== creator.id);
    const toLike = pickN(othersVideos, randInt(3, 8));
    for (const video of toLike) {
      try {
        await prisma.videoLike.create({
          data: { userId: creator.id, videoId: video.id },
        });
        likeCount++;
      } catch {
        // Skip duplicates
      }
    }
  }
  console.log(`   ✅ Created ${likeCount} like records`);

  // ── Step 7: Create VideoBookmark records ──
  // Primary user bookmarks ~30% of videos
  console.log('\n🔖 Creating bookmark records...');
  const bookmarkedVideos = pickN(createdVideos, Math.ceil(createdVideos.length * 0.3));
  let bookmarkCount = 0;

  for (const video of bookmarkedVideos) {
    await prisma.videoBookmark.create({
      data: { userId: primaryUser.id, videoId: video.id },
    });
    bookmarkCount++;
  }
  console.log(`   ✅ Created ${bookmarkCount} bookmark records`);

  // ── Step 8: Create VideoEvent telemetry records ──
  // These power the ML-lite personalization in the For You tab
  console.log('\n📊 Creating telemetry events...');
  let eventCount = 0;
  const sessionId = `seed_${Date.now()}`;

  for (const video of createdVideos) {
    // Generate 3-8 events per video for the primary user
    const numEvents = randInt(3, 8);
    for (let i = 0; i < numEvents; i++) {
      // Weight-based event type selection
      const totalWeight = EVENT_TYPES.reduce((sum, e) => sum + e.weight, 0);
      let roll = Math.random() * totalWeight;
      let eventType = EVENT_TYPES[0].type;
      for (const et of EVENT_TYPES) {
        roll -= et.weight;
        if (roll <= 0) {
          eventType = et.type;
          break;
        }
      }

      await prisma.videoEvent.create({
        data: {
          userId: primaryUser.id,
          videoId: video.id,
          eventType,
          sessionId,
          payload: {},
          createdAt: hoursAgo(randInt(0, 336)), // Random time in last 14 days
        },
      });
      eventCount++;
    }
  }

  // Also generate some events from creator accounts (cross-engagement)
  for (const creator of creators.slice(0, 3)) {
    const otherVideos = pickN(
      createdVideos.filter(v => v.userId !== creator.id),
      randInt(5, 10)
    );
    for (const video of otherVideos) {
      const eventType = pick(['impression', 'play_3s', 'play_50pct', 'play_100pct', 'like']);
      await prisma.videoEvent.create({
        data: {
          userId: creator.id,
          videoId: video.id,
          eventType,
          sessionId: `seed_creator_${creator.id}`,
          payload: {},
          createdAt: hoursAgo(randInt(0, 168)),
        },
      });
      eventCount++;
    }
  }
  console.log(`   ✅ Created ${eventCount} telemetry events`);

  // ── Step 9: Create some comments for engagement feel ──
  console.log('\n💬 Creating sample comments...');
  const COMMENT_TEMPLATES = [
    'This is so helpful, thank you!',
    'I learned something new today',
    'Great content as always!',
    'Can you make more videos like this?',
    'This is exactly what I needed',
    'Shared this with all my friends',
    'The best video on this topic',
    'Keep up the great work!',
    'I tried this and it actually works!',
    'More videos about this topic please',
    'Everyone needs to see this',
    'Love the energy in this video',
  ];

  let commentCount = 0;
  const commenters = [primaryUser, ...creators];

  for (const video of createdVideos) {
    const numComments = randInt(0, 4);
    for (let i = 0; i < numComments; i++) {
      const commenter = pick(commenters.filter(c => c.id !== video.userId));
      if (!commenter) continue;

      await prisma.comment.create({
        data: {
          text: pick(COMMENT_TEMPLATES),
          userId: commenter.id,
          videoId: video.id,
          createdAt: hoursAgo(randInt(0, video.hoursOld || 24)),
        },
      });
      commentCount++;
    }

    // Update video's comment count
    if (numComments > 0) {
      const actualCount = await prisma.comment.count({ where: { videoId: video.id } });
      await prisma.video.update({
        where: { id: video.id },
        data: { commentsCount: actualCount },
      });
    }
  }
  console.log(`   ✅ Created ${commentCount} comments`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Video Ecosystem Seeded Successfully!');
  console.log('═'.repeat(60));
  console.log(`   👤 Primary viewer:      ${primaryUser.firstName} ${primaryUser.lastName}`);
  console.log(`   🎬 Creators:            ${creators.length}`);
  console.log(`   📹 Videos:              ${createdVideos.length}`);
  console.log(`   🔗 Follows:             ${followedCreators.length} + ${interCreatorFollows.length} inter-creator`);
  console.log(`   ❤️  Likes:               ${likeCount}`);
  console.log(`   🔖 Bookmarks:           ${bookmarkCount}`);
  console.log(`   📊 Telemetry events:    ${eventCount}`);
  console.log(`   💬 Comments:            ${commentCount}`);
  console.log();
  console.log('   Tab Coverage:');
  console.log('   ✅ Following  — Primary user follows 4 creators (20 videos in feed)');
  console.log('   ✅ For You    — 30 videos from 6 creators (max 2/creator/page diversity)');
  console.log('   ✅ Trending   — All 30 videos have ≥10 views (max 3/creator trending cap)');
  console.log('   ✅ Telemetry  — Personalization signals for ML-lite scoring');
  console.log();
  console.log('   All videos use Google GTV sample bucket (no R2 dependency).');
  console.log();
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
