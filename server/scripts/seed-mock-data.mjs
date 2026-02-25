/**
 * Mock Data Seeding Script via Direct Prisma DB Operations
 *
 * This script populates the database with mock data using Prisma Client directly,
 * bypassing REST API endpoints and authentication requirements.
 *
 * Run with: bun scripts/seed-mock-data.mjs
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

import {
  mockUsers,
  mockVideos,
  mockComments,
  mockSurveys,
  mockSurveyQuestions,
  mockAds,
  mockQuestions,
  mockResponses,
  mockResponseReplies,
  mockRewardQuestions,
} from './mockData.js';

// Use direct database connection (bypasses Accelerate cache)
const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ No DATABASE_URL or DIRECT_DATABASE_URL found in environment');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Maps mock IDs → real DB UUIDs
const realUserIds = new Map();
const realVideoIds = new Map();
const realSurveyIds = new Map();
const realQuestionIds = new Map();
const realResponseIds = new Map();

// ─── Users ───────────────────────────────────────────────────────────────────
const seedUsers = async () => {
  console.log('\n🌱 Seeding Users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminHashedPassword = await bcrypt.hash('admin123456', 10);

  for (const user of mockUsers) {
    const isAdmin = user.role === 'ADMIN';
    try {
      const dbUser = await prisma.appUser.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          password: isAdmin ? adminHashedPassword : hashedPassword,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          points: user.points || 0,
          avatar: user.avatar || undefined,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus || 'INACTIVE',
          surveysubscriptionStatus: user.surveysubscriptionStatus || 'INACTIVE',
          privacySettings: user.privacySettings || undefined,
        },
      });
      realUserIds.set(user.id, dbUser.id);
      console.log(`  ✅ ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`  ❌ ${user.email}: ${error.message}`);
    }
  }
};

// ─── Videos ──────────────────────────────────────────────────────────────────
const seedVideos = async () => {
  console.log('\n🎥 Seeding Videos...');

  for (const video of mockVideos) {
    const userId = realUserIds.get(video.userId);
    if (!userId) {
      console.log(`  ⚠️  No user for ${video.userId}, skipping video`);
      continue;
    }
    try {
      const dbVideo = await prisma.video.create({
        data: {
          title: video.title,
          description: video.description,
          videoUrl: video.videoUrl,
          thumbnail: video.thumbnail,
          userId,
          likes: video.likes || 0,
          views: video.views || 0,
          duration: video.duration || null,
          commentsCount: video.commentsCount || 0,
        },
      });
      realVideoIds.set(video.id, dbVideo.id);
      console.log(`  ✅ ${video.title}`);
    } catch (error) {
      console.error(`  ❌ ${video.title}: ${error.message}`);
    }
  }
};

// ─── Comments ────────────────────────────────────────────────────────────────
const seedComments = async () => {
  console.log('\n💬 Seeding Video Comments...');

  for (const comment of mockComments) {
    const userId = realUserIds.get(comment.userId);
    const videoId = realVideoIds.get(comment.videoId);
    if (!userId || !videoId) {
      console.log(`  ⚠️  Missing user/video for comment ${comment.id}, skipping`);
      continue;
    }
    try {
      await prisma.comment.create({
        data: {
          text: comment.text,
          mediaUrls: comment.mediaUrls || [],
          userId,
          videoId,
        },
      });
      console.log(`  ✅ Comment on ${comment.videoId}`);
    } catch (error) {
      console.error(`  ❌ Comment ${comment.id}: ${error.message}`);
    }
  }
};

// ─── Surveys + Survey Questions ──────────────────────────────────────────────
const seedSurveys = async () => {
  console.log('\n📊 Seeding Surveys...');

  for (const survey of mockSurveys) {
    const userId = realUserIds.get(survey.userId);
    if (!userId) {
      console.log(`  ⚠️  No user for ${survey.userId}, skipping survey`);
      continue;
    }

    try {
      const dbSurvey = await prisma.survey.create({
        data: {
          title: survey.title,
          description: survey.description || null,
          userId,
          rewardAmount: survey.rewardAmount || 2000,
          maxResponses: survey.maxResponses || null,
          startDate: new Date(survey.startDate),
          endDate: new Date(survey.endDate),
        },
      });
      realSurveyIds.set(survey.id, dbSurvey.id);
      console.log(`  ✅ ${survey.title}`);
    } catch (error) {
      console.error(`  ❌ ${survey.title}: ${error.message}`);
    }
  }

  // Now seed survey questions (UploadSurvey records)
  console.log('\n❓ Seeding Survey Questions...');

  for (const question of mockSurveyQuestions) {
    const userId = realUserIds.get(question.userId);
    const surveyId = realSurveyIds.get(question.surveyId);
    if (!userId || !surveyId) {
      console.log(`  ⚠️  Missing user/survey for question ${question.id}, skipping`);
      continue;
    }

    try {
      await prisma.uploadSurvey.create({
        data: {
          text: question.text,
          type: question.type,
          options: typeof question.options === 'string' ? question.options : JSON.stringify(question.options),
          placeholder: question.placeholder || null,
          minValue: question.minValue ?? null,
          maxValue: question.maxValue ?? null,
          required: true,
          userId,
          surveyId,
        },
      });
      console.log(`  ✅ ${question.text.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ❌ ${question.text.substring(0, 50)}: ${error.message}`);
    }
  }
};

// ─── Ads ─────────────────────────────────────────────────────────────────────
const seedAds = async () => {
  console.log('\n📢 Seeding Ads...');

  for (const ad of mockAds) {
    const userId = realUserIds.get(ad.userId);
    if (!userId) {
      console.log(`  ⚠️  No user for ${ad.userId}, skipping ad`);
      continue;
    }

    try {
      await prisma.ad.create({
        data: {
          title: ad.title,
          headline: ad.headline || null,
          description: ad.description,
          imageUrl: ad.imageUrl || null,
          videoUrl: ad.videoUrl || null,
          thumbnailUrl: ad.thumbnailUrl || null,
          type: ad.type || 'regular',
          placement: ad.placement || 'feed',
          sponsored: ad.sponsored ?? false,
          isActive: ad.isActive ?? true,
          startDate: ad.startDate ? new Date(ad.startDate) : null,
          endDate: ad.endDate ? new Date(ad.endDate) : null,
          userId,
          priority: ad.priority || 5,
          frequency: ad.frequency || null,
          targetUrl: ad.targetUrl || null,
          callToAction: ad.callToAction || 'learn_more',
          pricingModel: ad.pricingModel || 'cpm',
          totalBudget: ad.totalBudget || 0,
          bidAmount: ad.bidAmount || 0,
          dailyBudgetLimit: ad.dailyBudgetLimit || null,
          targetAgeRanges: ad.targetAgeRanges || null,
          targetGender: ad.targetGender || 'all',
          targetLocations: ad.targetLocations || null,
          targetInterests: ad.targetInterests || null,
          enableRetargeting: ad.enableRetargeting ?? false,
          status: ad.status || 'approved',
          approvedAt: ad.status === 'approved' ? new Date() : null,
        },
      });
      console.log(`  ✅ ${ad.title}`);
    } catch (error) {
      console.error(`  ❌ ${ad.title}: ${error.message}`);
    }
  }
};

// ─── Questions (Q&A) ────────────────────────────────────────────────────────
const seedQuestions = async () => {
  console.log('\n❓ Seeding Questions...');

  for (const question of mockQuestions) {
    const userId = realUserIds.get(question.userId);
    if (!userId) {
      console.log(`  ⚠️  No user for ${question.userId}, skipping question`);
      continue;
    }

    try {
      const dbQuestion = await prisma.question.create({
        data: {
          text: question.text,
          userId,
          category: question.category || 'General',
          rewardAmount: question.rewardAmount || 0,
          isInstantReward: question.isInstantReward ?? false,
        },
      });
      realQuestionIds.set(question.id, dbQuestion.id);
      console.log(`  ✅ ${question.text.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ❌ ${question.text.substring(0, 50)}: ${error.message}`);
    }
  }
};

// ─── Responses (Answers to Questions) ────────────────────────────────────────
const seedResponses = async () => {
  console.log('\n💬 Seeding Responses...');

  for (const response of mockResponses) {
    const userId = realUserIds.get(response.userId);
    const questionId = realQuestionIds.get(response.questionId);
    if (!userId || !questionId) {
      console.log(`  ⚠️  Missing user/question for response ${response.id}, skipping`);
      continue;
    }

    try {
      const dbResponse = await prisma.response.create({
        data: {
          responseText: response.responseText,
          userId,
          questionId,
        },
      });
      realResponseIds.set(response.id, dbResponse.id);
      console.log(`  ✅ Response for ${response.questionId}`);
    } catch (error) {
      console.error(`  ❌ Response ${response.id}: ${error.message}`);
    }
  }
};

// ─── Response Replies ────────────────────────────────────────────────────────
const seedResponseReplies = async () => {
  console.log('\n💬 Seeding Response Replies...');

  for (const reply of mockResponseReplies) {
    const userId = realUserIds.get(reply.userId);
    const responseId = realResponseIds.get(reply.responseId);
    if (!userId || !responseId) {
      console.log(`  ⚠️  Missing user/response for reply ${reply.id}, skipping`);
      continue;
    }

    try {
      await prisma.responseReply.create({
        data: {
          replyText: reply.replyText,
          userId,
          responseId,
        },
      });
      console.log(`  ✅ Reply to ${reply.responseId}`);
    } catch (error) {
      console.error(`  ❌ Reply ${reply.id}: ${error.message}`);
    }
  }
};

// ─── Reward Questions ────────────────────────────────────────────────────────
const seedRewardQuestions = async () => {
  console.log('\n🎁 Seeding Reward Questions...');

  for (const rq of mockRewardQuestions) {
    const userId = realUserIds.get(rq.userId);
    if (!userId) {
      console.log(`  ⚠️  No user for ${rq.userId}, skipping reward question`);
      continue;
    }

    try {
      await prisma.rewardQuestion.create({
        data: {
          text: rq.text,
          options: rq.options,
          correctAnswer: rq.correctAnswer,
          rewardAmount: rq.rewardAmount || 0,
          expiryTime: rq.expiryTime ? new Date(rq.expiryTime) : null,
          isActive: rq.isActive ?? true,
          userId,
          isInstantReward: rq.isInstantReward ?? false,
          maxWinners: rq.maxWinners || 2,
          winnersCount: rq.winnersCount || 0,
          isCompleted: rq.isCompleted ?? false,
          paymentProvider: rq.paymentProvider || null,
          phoneNumber: rq.phoneNumber || null,
        },
      });
      console.log(`  ✅ ${rq.text.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ❌ ${rq.text.substring(0, 50)}: ${error.message}`);
    }
  }
};

// ─── Main ────────────────────────────────────────────────────────────────────
const seedAllData = async () => {
  console.log('🚀 Starting mock data seeding via Prisma...');
  console.log(`📍 Database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  try {
    // Seed data in dependency order
    await seedUsers();
    await seedVideos();
    await seedComments();
    await seedSurveys();
    await seedAds();
    await seedQuestions();
    await seedResponses();
    await seedResponseReplies();
    await seedRewardQuestions();

    console.log('\n🎉 Mock data seeding completed!');
    console.log('📊 Summary:');
    console.log(`   Users:            ${realUserIds.size}`);
    console.log(`   Videos:           ${realVideoIds.size}`);
    console.log(`   Surveys:          ${realSurveyIds.size}`);
    console.log(`   Questions:        ${realQuestionIds.size}`);
    console.log(`   Responses:        ${realResponseIds.size}`);
  } catch (error) {
    console.error('\n💥 Error during seeding:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

seedAllData();
