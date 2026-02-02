/**
 * Mock Data Seeding Script via REST APIs
 *
 * This script populates the database with mock data by making HTTP requests
 * to the REST API endpoints. This ensures proper validation and business logic
 * is applied during data creation.
 *
 * Run with: node scripts/seed-mock-data.mjs
 */

import axios from 'axios';
import { mockUsers, mockVideos, mockComments, mockSurveys, mockSurveyQuestions, mockAds, mockQuestions, mockResponses, mockResponseReplies, mockRewardQuestions, mockQuizQuestions } from './mockData.js';

// Server configuration
const BASE_URL = process.env.API_BASE_URL || 'https://delipucash-latest.vercel.app/api';

// Global variables for authentication
let adminToken = null;
let userTokens = new Map(); // userId -> token
let realUserIds = new Map(); // mockUserId -> realUserId
let realVideoIds = new Map(); // mockVideoId -> realVideoId
let realQuestionIds = new Map(); // mockQuestionId -> realQuestionId

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null, token = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

// Authentication functions
const loginUser = async (email, password) => {
  try {
    const response = await makeRequest('POST', '/auth/signin', { email, password });
    return response.token;
  } catch (error) {
    console.log(`⚠️  Could not login ${email}, attempting signup...`);
    return null;
  }
};

const signupUser = async (user) => {
  // Don't try to signup admin user as it already exists
  if (user.email === 'admin@delipucash.com') {
    console.log(`⚠️  Admin user already exists, skipping signup`);
    return null;
  }

  try {
    const signupData = {
      email: user.email,
      password: 'password123', // Default password for mock users
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role.toLowerCase(),
    };

    const response = await makeRequest('POST', '/auth/signup', signupData);
    console.log(`✅ Created user: ${user.email}`);

    // Now login to get token
    const token = await loginUser(user.email, 'password123');
    
    return {
      token,
      userId: response.user?.id || response.id
    };
  } catch (error) {
    console.log(`⚠️  Could not create user ${user.email}:`, error.message);
    return null;
  }
};

const authenticateUser = async (user) => {
  // For admin user, use the provided credentials
  if (user.email === 'admin@delipucash.com') {
    const token = await loginUser(user.email, 'admin123456');
    if (token) {
      console.log(`✅ Admin authenticated: ${user.email}`);
      adminToken = token;
      userTokens.set(user.id, token);
      // Extract user ID from token (assuming JWT structure)
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        realUserIds.set(user.id, payload.id);
      } catch (error) {
        console.log(`⚠️  Could not extract user ID from admin token`);
      }
      return token;
    } else {
      console.log(`❌ Could not authenticate admin user`);
      return null;
    }
  }

  // For other users, try login first, then signup if needed
  let token = await loginUser(user.email, 'password123');
  if (!token) {
    const signupResult = await signupUser(user);
    if (signupResult) {
      token = signupResult.token;
      realUserIds.set(user.id, signupResult.userId);
    }
  } else {
    // If login succeeded, extract user ID from token
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      realUserIds.set(user.id, payload.id);
    } catch (error) {
      console.log(`⚠️  Could not extract user ID from token for ${user.email}`);
    }
  }
  
  if (token) {
    userTokens.set(user.id, token);
  }
  return token;
};

// Data seeding functions
const seedUsers = async () => {
  console.log('\n🌱 Seeding Users...');

  // First try to authenticate admin
  const adminToken = userTokens.get('admin');
  if (!adminToken) {
    console.log('⚠️  No admin token available - user creation may fail');
  }

  for (const user of mockUsers) {
    if (user.email === 'admin@delipucash.com') {
      // Admin user should already exist
      console.log(`⏭️  Skipping admin user (should already exist)`);
      continue;
    }

    const token = await authenticateUser(user);
    if (token) {
      userTokens.set(user.id, token);
      console.log(`✅ User authenticated: ${user.email}`);
      
      // Note: Profile update endpoint has issues on the deployed server
      // Users are created with all fields during signup, so profile update is optional
    }
  }
};

const seedVideos = async () => {
  console.log('\n🎥 Seeding Videos...');

  for (const video of mockVideos) {
    const realUserId = realUserIds.get(video.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${video.userId}, skipping video`);
      continue;
    }

    const videoData = {
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail,
      userId: realUserId,
      duration: video.duration,
    };

    try {
      const result = await makeRequest('POST', '/videos/create', videoData);
      if (result && result.video && result.video.id) {
        realVideoIds.set(video.id, result.video.id);
      }
      console.log(`✅ Created video: ${video.title}`);
    } catch (error) {
      console.log(`⚠️  Could not create video: ${video.title}`);
    }
  }
};

const seedComments = async () => {
  console.log('\n💬 Seeding Comments...');

  for (const comment of mockComments) {
    const realUserId = realUserIds.get(comment.userId);
    const realVideoId = realVideoIds.get(comment.videoId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${comment.userId}, skipping comment`);
      continue;
    }
    if (!realVideoId) {
      console.log(`⚠️  No real video ID found for mock video ${comment.videoId}, skipping comment`);
      continue;
    }

    const commentData = {
      text: comment.text,
      media: comment.mediaUrls,
      user_id: realUserId,
      created_at: comment.createdAt,
    };

    try {
      await makeRequest('POST', `/videos/${realVideoId}/comments`, commentData);
      console.log(`✅ Created comment on video ${comment.videoId}`);
    } catch (error) {
      console.log(`⚠️  Could not create comment on video ${comment.videoId}`);
    }
  }
};

const seedSurveys = async () => {
  console.log('\n📊 Seeding Surveys...');

  for (const survey of mockSurveys) {
    const realUserId = realUserIds.get(survey.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${survey.userId}, skipping survey`);
      continue;
    }

    // Get questions for this survey
    const surveyQuestions = mockSurveyQuestions.filter(q => q.surveyId === survey.id);
    const formattedQuestions = surveyQuestions.map(q => ({
      question: q.text,
      type: q.type,
      options: q.options ? JSON.parse(q.options) : [],
    }));

    const surveyData = {
      surveyTitle: survey.title,
      surveyDescription: survey.description,
      userId: realUserId,
      startDate: survey.startDate,
      endDate: survey.endDate,
      questions: formattedQuestions,
    };

    try {
      const result = await makeRequest('POST', '/surveys/create', surveyData);
      console.log(`✅ Created survey: ${survey.title} with ${formattedQuestions.length} questions`);
    } catch (error) {
      console.log(`⚠️  Could not create survey: ${survey.title}`);
    }
  }
};

const seedSurveyQuestions = async () => {
  console.log('\n❓ Seeding Survey Questions...');

  for (const question of mockSurveyQuestions) {
    const realUserId = realUserIds.get(question.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${question.userId}, skipping survey question`);
      continue;
    }

    const questionData = {
      text: question.text,
      type: question.type,
      options: question.options,
      placeholder: question.placeholder,
      minValue: question.minValue,
      maxValue: question.maxValue,
      surveyId: question.surveyId,
      userId: realUserId,
    };

    try {
      await makeRequest('POST', '/surveys/upload', questionData);
      console.log(`✅ Created survey question: ${question.text.substring(0, 50)}...`);
    } catch (error) {
      console.log(`⚠️  Could not create survey question: ${question.text.substring(0, 50)}...`);
    }
  }
};

const seedAds = async () => {
  console.log('\n📢 Seeding Ads...');

  for (const ad of mockAds) {
    const realUserId = realUserIds.get(ad.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${ad.userId}, skipping ad`);
      continue;
    }

    const adData = {
      title: ad.title,
      headline: ad.headline,
      description: ad.description,
      imageUrl: ad.imageUrl,
      videoUrl: ad.videoUrl,
      thumbnailUrl: ad.thumbnailUrl,
      type: ad.type,
      placement: ad.placement,
      sponsored: ad.sponsored,
      startDate: ad.startDate,
      endDate: ad.endDate,
      priority: ad.priority,
      frequency: ad.frequency,
      targetUrl: ad.targetUrl,
      callToAction: ad.callToAction,
      pricingModel: ad.pricingModel,
      totalBudget: ad.totalBudget,
      bidAmount: ad.bidAmount,
      dailyBudgetLimit: ad.dailyBudgetLimit,
      targetAgeRanges: ad.targetAgeRanges,
      targetGender: ad.targetGender,
      targetLocations: ad.targetLocations,
      targetInterests: ad.targetInterests,
      enableRetargeting: ad.enableRetargeting,
      userId: realUserId,
    };

    try {
      const result = await makeRequest('POST', '/ads/create', adData);
      console.log(`✅ Created ad: ${ad.title}`);
    } catch (error) {
      console.log(`⚠️  Could not create ad: ${ad.title}`);
    }
  }
};

const seedQuestions = async () => {
  console.log('\n❓ Seeding Questions...');

  for (const question of mockQuestions) {
    const realUserId = realUserIds.get(question.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${question.userId}, skipping question`);
      continue;
    }

    const questionData = {
      text: question.text,
      category: question.category,
      rewardAmount: question.rewardAmount,
      isInstantReward: question.isInstantReward,
      userId: realUserId,
    };

    try {
      const result = await makeRequest('POST', '/questions/create', questionData);
      if (result && result.question && result.question.id) {
        realQuestionIds.set(question.id, result.question.id);
      }
      console.log(`✅ Created question: ${question.text.substring(0, 50)}...`);
    } catch (error) {
      console.log(`⚠️  Could not create question: ${question.text.substring(0, 50)}...`);
    }
  }
};

const seedResponses = async () => {
  console.log('\n💬 Seeding Responses...');

  for (const response of mockResponses) {
    const realUserId = realUserIds.get(response.userId);
    const realQuestionId = realQuestionIds.get(response.questionId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${response.userId}, skipping response`);
      continue;
    }
    if (!realQuestionId) {
      console.log(`⚠️  No real question ID found for mock question ${response.questionId}, skipping response`);
      continue;
    }

    const responseData = {
      responseText: response.responseText,
      userId: realUserId,
    };

    try {
      await makeRequest('POST', `/questions/${realQuestionId}/responses`, responseData);
      console.log(`✅ Created response for question ${response.questionId}`);
    } catch (error) {
      console.log(`⚠️  Could not create response for question ${response.questionId}`);
    }
  }
};

const seedRewardQuestions = async () => {
  console.log('\n🎁 Seeding Reward Questions...');

  for (const rewardQuestion of mockRewardQuestions) {
    const realUserId = realUserIds.get(rewardQuestion.userId);
    if (!realUserId) {
      console.log(`⚠️  No real user ID found for mock user ${rewardQuestion.userId}, skipping reward question`);
      continue;
    }

    const questionData = {
      text: rewardQuestion.text,
      options: rewardQuestion.options,
      correctAnswer: rewardQuestion.correctAnswer,
      rewardAmount: rewardQuestion.rewardAmount,
      expiryTime: rewardQuestion.expiryTime,
      isInstantReward: rewardQuestion.isInstantReward,
      maxWinners: rewardQuestion.maxWinners,
      paymentProvider: rewardQuestion.paymentProvider,
      phoneNumber: rewardQuestion.phoneNumber,
      userId: realUserId,
    };

    try {
      const result = await makeRequest('POST', '/reward-questions/create', questionData);
      console.log(`✅ Created reward question: ${rewardQuestion.text.substring(0, 50)}...`);
    } catch (error) {
      console.log(`⚠️  Could not create reward question: ${rewardQuestion.text.substring(0, 50)}...`);
    }
  }
};

// Main seeding function
const seedAllData = async () => {
  console.log('🚀 Starting mock data seeding via REST APIs...');
  console.log('📍 API Base URL:', BASE_URL);
  console.log('⚠️  Note: Using deployed API - some endpoints may require authentication');

  try {
    // Try to authenticate admin first
    console.log('\n🔐 Attempting admin authentication...');
    const adminToken = await loginUser('admin@delipucash.com', 'admin123456');
    if (adminToken) {
      console.log('✅ Admin authenticated successfully');
      userTokens.set('admin', adminToken);
    } else {
      console.log('❌ Admin authentication failed - continuing with available endpoints');
    }

    // Seed data in order of dependencies
    await seedUsers();
    await seedVideos();
    await seedComments();
    await seedSurveys();
    await seedAds();
    await seedQuestions();
    await seedResponses();
    await seedRewardQuestions();

    console.log('\n🎉 Mock data seeding completed!');
    console.log('📊 Summary:');
    console.log(`   - Users authenticated: ${userTokens.size}`);
    console.log('   - Check the output above for success/failure details');

  } catch (error) {
    console.error('\n💥 Error during seeding:', error.message);
    process.exit(1);
  }
};

// Run the seeding script
seedAllData();