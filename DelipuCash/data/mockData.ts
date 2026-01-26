/**
 * Comprehensive Mock Data based on Prisma Schema
 * This file contains all mock data matching the database schema
 */

import {
  AppUser,
  Video,
  Comment,
  Survey,
  UploadSurvey,
  Ad,
  SurveyResponse,
  RewardQuestion,
  Question,
  Response,
  ResponseReply,
  QuestionAttempt,
  Reward,
  Payment,
  Notification,
  LoginSession,
  Transaction,
  UserStats,
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionType,
  NotificationType,
  NotificationPriority,
  UserRole,
  QuizQuestion,
} from "@/types";

// ===========================================
// Mock Users
// ===========================================
export const mockUsers: AppUser[] = [
  {
    id: "user_001",
    email: "john.doe@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "+256 700 123 456",
    points: 12500,
    avatar: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
    role: UserRole.ADMIN,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.ACTIVE,
    currentSubscriptionId: "sub_001",
    privacySettings: { showEmail: false, showPhone: false },
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-01-04T00:00:00Z",
  },
  {
    id: "user_002",
    email: "sarah.johnson@example.com",
    firstName: "Sarah",
    lastName: "Johnson",
    phone: "+256 700 234 567",
    points: 8900,
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    role: UserRole.USER,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.INACTIVE,
    currentSubscriptionId: "sub_002",
    privacySettings: null,
    createdAt: "2025-02-15T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
  },
  {
    id: "user_003",
    email: "mike.chen@example.com",
    firstName: "Mike",
    lastName: "Chen",
    phone: "+256 700 345 678",
    points: 15200,
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    role: UserRole.MODERATOR,
    subscriptionStatus: SubscriptionStatus.INACTIVE,
    surveysubscriptionStatus: SubscriptionStatus.ACTIVE,
    currentSubscriptionId: null,
    privacySettings: { showEmail: true, showPhone: false },
    createdAt: "2025-03-10T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "user_004",
    email: "alice.smith@example.com",
    firstName: "Alice",
    lastName: "Smith",
    phone: "+256 700 456 789",
    points: 6750,
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
    role: UserRole.USER,
    subscriptionStatus: SubscriptionStatus.PENDING,
    surveysubscriptionStatus: SubscriptionStatus.INACTIVE,
    currentSubscriptionId: null,
    privacySettings: null,
    createdAt: "2025-04-20T00:00:00Z",
    updatedAt: "2026-01-04T00:00:00Z",
  },
];

// Current logged in user
export const mockCurrentUser: AppUser = mockUsers[0];

// ===========================================
// Mock Videos - Using real sample videos from public sources
// ===========================================

/**
 * Sample video URLs from public sources for testing
 * These are royalty-free/public domain sample videos
 */
const SAMPLE_VIDEOS = {
  // Google/Sample video sources (public domain)
  bigBuckBunny: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  elephantsDream: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  forBiggerBlazes: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  forBiggerEscapes: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  forBiggerFun: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  forBiggerJoyrides: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  forBiggerMeltdowns: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  sintel: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  subaru: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  tearsOfSteel: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  volkswagenGTI: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
  weAreGoingOnBullrun: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  whatCarCanYouGetForAGrand: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
};

/**
 * High-quality thumbnail URLs from picsum.photos (random images)
 */
const SAMPLE_THUMBNAILS = {
  finance: "https://picsum.photos/seed/finance/400/225",
  tech: "https://picsum.photos/seed/tech/400/225",
  money: "https://picsum.photos/seed/money/400/225",
  business: "https://picsum.photos/seed/business/400/225",
  tips: "https://picsum.photos/seed/tips/400/225",
  savings: "https://picsum.photos/seed/savings/400/225",
  investment: "https://picsum.photos/seed/investment/400/225",
  tutorial: "https://picsum.photos/seed/tutorial/400/225",
  survey: "https://picsum.photos/seed/survey/400/225",
  earnings: "https://picsum.photos/seed/earnings/400/225",
  mobile: "https://picsum.photos/seed/mobile/400/225",
  rewards: "https://picsum.photos/seed/rewards/400/225",
};

export const mockVideos: Video[] = [
  {
    id: "video_001",
    title: "How to Earn $100 Daily on Delipucash",
    description: "Complete guide to maximizing your earnings on the platform. Learn the secrets of top earners and how you can replicate their success.",
    videoUrl: SAMPLE_VIDEOS.forBiggerFun,
    thumbnail: SAMPLE_THUMBNAILS.earnings,
    userId: "user_002",
    likes: 892,
    views: 12450,
    duration: 60, // 1:00
    isBookmarked: false,
    commentsCount: 45,
    createdAt: "2026-01-02T08:00:00Z",
    updatedAt: "2026-01-04T10:00:00Z",
  },
  {
    id: "video_002",
    title: "Live Q&A: Making Money Online",
    description: "Join us for tips and tricks on maximizing your online income. Our experts answer your burning questions about earning from home.",
    videoUrl: SAMPLE_VIDEOS.forBiggerJoyrides,
    thumbnail: SAMPLE_THUMBNAILS.money,
    userId: "user_003",
    likes: 456,
    views: 3240,
    duration: 15, // 0:15
    isBookmarked: true,
    commentsCount: 128,
    createdAt: "2026-01-04T14:00:00Z",
    updatedAt: "2026-01-04T14:00:00Z",
  },
  {
    id: "video_003",
    title: "Survey Tips for Maximum Rewards",
    description: "How to qualify for high-paying surveys every time. These proven strategies will help you maximize your survey earnings.",
    videoUrl: SAMPLE_VIDEOS.forBiggerBlazes,
    thumbnail: SAMPLE_THUMBNAILS.survey,
    userId: "user_004",
    likes: 721,
    views: 8920,
    duration: 15, // 0:15
    isBookmarked: false,
    commentsCount: 32,
    createdAt: "2026-01-03T16:30:00Z",
    updatedAt: "2026-01-03T16:30:00Z",
  },
  {
    id: "video_004",
    title: "Airtel Money Withdrawal Guide",
    description: "Step-by-step tutorial for withdrawing your earnings to Airtel Money. Quick, easy, and secure transactions explained.",
    videoUrl: SAMPLE_VIDEOS.forBiggerEscapes,
    thumbnail: SAMPLE_THUMBNAILS.mobile,
    userId: "user_002",
    likes: 1204,
    views: 15680,
    duration: 15, // 0:15
    isBookmarked: true,
    commentsCount: 67,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
  },
  {
    id: "video_005",
    title: "How to Save Money in 2026",
    description: "Practical tips for saving money this year. Start building your financial future with these simple yet effective strategies.",
    videoUrl: SAMPLE_VIDEOS.forBiggerMeltdowns,
    thumbnail: SAMPLE_THUMBNAILS.savings,
    userId: "user_003",
    likes: 543,
    views: 1200,
    duration: 13, // 0:13
    isBookmarked: false,
    commentsCount: 21,
    createdAt: "2025-12-28T10:00:00Z",
    updatedAt: "2025-12-28T10:00:00Z",
  },
  {
    id: "video_006",
    title: "Investment Tips for Beginners",
    description: "Start your investment journey with these essential tips. Learn how to grow your money wisely even with a small starting capital.",
    videoUrl: SAMPLE_VIDEOS.volkswagenGTI,
    thumbnail: SAMPLE_THUMBNAILS.investment,
    userId: "user_002",
    likes: 387,
    views: 850,
    duration: 160, // 2:40
    isBookmarked: false,
    commentsCount: 15,
    createdAt: "2025-12-25T14:00:00Z",
    updatedAt: "2025-12-25T14:00:00Z",
  },
  {
    id: "video_007",
    title: "Complete Platform Tutorial",
    description: "A comprehensive walkthrough of all Delipucash features. From signing up to cashing out, we cover everything you need to know.",
    videoUrl: SAMPLE_VIDEOS.weAreGoingOnBullrun,
    thumbnail: SAMPLE_THUMBNAILS.tutorial,
    userId: "user_003",
    likes: 1567,
    views: 25000,
    duration: 48, // 0:48
    isBookmarked: true,
    commentsCount: 89,
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-01-05T09:00:00Z",
  },
  {
    id: "video_008",
    title: "Top 10 Earning Strategies",
    description: "Discover the top 10 strategies used by our highest earners. These methods have been proven to generate consistent income.",
    videoUrl: SAMPLE_VIDEOS.whatCarCanYouGetForAGrand,
    thumbnail: SAMPLE_THUMBNAILS.business,
    userId: "user_004",
    likes: 2340,
    views: 45000,
    duration: 165, // 2:45
    isBookmarked: false,
    commentsCount: 156,
    createdAt: "2026-01-06T11:30:00Z",
    updatedAt: "2026-01-06T11:30:00Z",
  },
  {
    id: "video_009",
    title: "Understanding Instant Rewards",
    description: "Everything you need to know about our instant reward system. Answer questions correctly and get paid instantly to your mobile money.",
    videoUrl: SAMPLE_VIDEOS.subaru,
    thumbnail: SAMPLE_THUMBNAILS.rewards,
    userId: "user_002",
    likes: 678,
    views: 8900,
    duration: 59, // 0:59
    isBookmarked: false,
    commentsCount: 42,
    createdAt: "2026-01-07T15:00:00Z",
    updatedAt: "2026-01-07T15:00:00Z",
  },
  {
    id: "video_010",
    title: "Mobile App Features Deep Dive",
    description: "Explore all the features of our mobile app. Tips and tricks to navigate the app like a pro and maximize your experience.",
    videoUrl: SAMPLE_VIDEOS.forBiggerFun,
    thumbnail: SAMPLE_THUMBNAILS.tech,
    userId: "user_003",
    likes: 445,
    views: 6200,
    duration: 60, // 1:00
    isBookmarked: true,
    commentsCount: 28,
    createdAt: "2026-01-08T10:00:00Z",
    updatedAt: "2026-01-08T10:00:00Z",
  },
];

// ===========================================
// Mock Comments
// ===========================================
export const mockComments: Comment[] = [
  {
    id: "comment_001",
    text: "This video really helped me understand how to earn more!",
    mediaUrls: [],
    userId: "user_001",
    videoId: "video_001",
    createdAt: "2026-01-02T10:30:00Z",
  },
  {
    id: "comment_002",
    text: "Great tips! Thanks for sharing 🙏",
    mediaUrls: [],
    userId: "user_003",
    videoId: "video_001",
    createdAt: "2026-01-02T11:45:00Z",
  },
  {
    id: "comment_003",
    text: "Can you make a video about crypto rewards?",
    mediaUrls: [],
    userId: "user_004",
    videoId: "video_002",
    createdAt: "2026-01-04T14:30:00Z",
  },
];

// ===========================================
// Mock Surveys
// ===========================================
export const mockSurveys: Survey[] = [
  {
    id: "survey_001",
    title: "Customer Satisfaction Survey",
    description: "Help us improve our services by sharing your feedback",
    userId: "user_002",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-15T23:59:59Z",
    createdAt: "2025-12-28T00:00:00Z",
    updatedAt: "2026-01-04T00:00:00Z",
    totalResponses: 234,
    maxResponses: 500,
    rewardAmount: 15.0,
    status: "running",
  },
  {
    id: "survey_002",
    title: "Product Feedback Survey",
    description: "Share your thoughts on our new features",
    userId: "user_003",
    startDate: "2026-01-02T00:00:00Z",
    endDate: "2026-01-12T23:59:59Z",
    createdAt: "2025-12-30T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    totalResponses: 89,
    maxResponses: 200,
    rewardAmount: 10.0,
    status: "running",
  },
  {
    id: "survey_003",
    title: "User Experience Study",
    description: "Tell us about your app experience",
    userId: "user_002",
    startDate: "2026-01-10T00:00:00Z",
    endDate: "2026-01-20T23:59:59Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    totalResponses: 0,
    maxResponses: 300,
    rewardAmount: 20.0,
    status: "scheduled",
  },
  {
    id: "survey_004",
    title: "Mobile App Usability Survey",
    description: "Help us improve the mobile experience",
    userId: "user_004",
    startDate: "2026-01-05T00:00:00Z",
    endDate: "2026-01-25T23:59:59Z",
    createdAt: "2026-01-03T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    totalResponses: 45,
    maxResponses: 150,
    rewardAmount: 12.5,
    status: "running",
  },
];

// ===========================================
// Mock Survey Questions (UploadSurvey)
// ===========================================
export const mockSurveyQuestions: UploadSurvey[] = [
  {
    id: "sq_001",
    text: "How satisfied are you with our platform?",
    type: "rating",
    options: JSON.stringify({ min: 1, max: 5, labels: ["Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"] }),
    placeholder: null,
    minValue: 1,
    maxValue: 5,
    userId: "user_002",
    surveyId: "survey_001",
    createdAt: "2025-12-28T00:00:00Z",
    updatedAt: "2025-12-28T00:00:00Z",
  },
  {
    id: "sq_002",
    text: "Which features do you use most?",
    type: "checkbox",
    options: JSON.stringify(["Questions & Answers", "Surveys", "Videos", "Live Streaming", "Rewards"]),
    placeholder: null,
    minValue: null,
    maxValue: null,
    userId: "user_002",
    surveyId: "survey_001",
    createdAt: "2025-12-28T00:00:00Z",
    updatedAt: "2025-12-28T00:00:00Z",
  },
  {
    id: "sq_003",
    text: "How did you hear about us?",
    type: "radio",
    options: JSON.stringify(["Social Media", "Friend Referral", "Search Engine", "Advertisement", "Other"]),
    placeholder: null,
    minValue: null,
    maxValue: null,
    userId: "user_002",
    surveyId: "survey_001",
    createdAt: "2025-12-28T00:00:00Z",
    updatedAt: "2025-12-28T00:00:00Z",
  },
  {
    id: "sq_004",
    text: "What improvements would you like to see?",
    type: "text",
    options: JSON.stringify({ multiline: true, placeholder: "Share your suggestions..." }),
    placeholder: "Share your suggestions...",
    minValue: null,
    maxValue: null,
    userId: "user_002",
    surveyId: "survey_001",
    createdAt: "2025-12-28T00:00:00Z",
    updatedAt: "2025-12-28T00:00:00Z",
  },
];

// ===========================================
// Mock Ads
// ===========================================
export const mockAds: Ad[] = [
  {
    id: "ad_001",
    title: "Premium Subscription - 50% Off!",
    description: "Upgrade to premium and unlock all features at half price",
    imageUrl: "https://via.placeholder.com/600x300/4F46E5/FFFFFF?text=Premium+50%25+Off",
    videoUrl: null,
    thumbnailUrl: null,
    type: "banner",
    sponsored: true,
    views: 5420,
    clicks: 342,
    isActive: true,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-31T23:59:59Z",
    createdAt: "2025-12-30T00:00:00Z",
    updatedAt: "2026-01-04T00:00:00Z",
    userId: "user_002",
    priority: 10,
    frequency: 5,
    lastShown: "2026-01-04T12:00:00Z",
    targetUrl: "https://example.com/premium",
  },
  {
    id: "ad_002",
    title: "Refer a Friend, Earn $10",
    description: "Share your referral code and earn rewards for each signup",
    imageUrl: "https://via.placeholder.com/400x200/10B981/FFFFFF?text=Referral+Bonus",
    videoUrl: null,
    thumbnailUrl: null,
    type: "featured",
    sponsored: true,
    views: 3210,
    clicks: 189,
    isActive: true,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-02-28T23:59:59Z",
    createdAt: "2025-12-29T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    userId: "user_003",
    priority: 8,
    frequency: 3,
    lastShown: "2026-01-04T10:30:00Z",
    targetUrl: "https://example.com/referral",
  },
];

// ===========================================
// Mock Questions
// ===========================================
export const mockQuestions: Question[] = [
  {
    id: "question_001",
    text: "What is your favorite programming language and why?",
    userId: "user_002",
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-03T10:00:00Z",
    category: "Technology",
    rewardAmount: 5.0,
    isInstantReward: true,
    totalAnswers: 234,
  },
  {
    id: "question_002",
    text: "How do you stay productive while working remotely?",
    userId: "user_003",
    createdAt: "2026-01-03T11:30:00Z",
    updatedAt: "2026-01-03T11:30:00Z",
    category: "Lifestyle",
    rewardAmount: 3.5,
    isInstantReward: true,
    totalAnswers: 156,
  },
  {
    id: "question_003",
    text: "What are the best practices for mobile app development?",
    userId: "user_004",
    createdAt: "2026-01-03T14:20:00Z",
    updatedAt: "2026-01-03T14:20:00Z",
    category: "Technology",
    rewardAmount: 7.5,
    isInstantReward: false,
    totalAnswers: 89,
  },
  {
    id: "question_004",
    text: "How do you manage your personal finances?",
    userId: "user_002",
    createdAt: "2026-01-02T09:00:00Z",
    updatedAt: "2026-01-02T09:00:00Z",
    category: "Finance",
    rewardAmount: 10.0,
    isInstantReward: true,
    totalAnswers: 312,
  },
  {
    id: "question_005",
    text: "What motivates you to work every day?",
    userId: "user_003",
    createdAt: "2026-01-01T15:00:00Z",
    updatedAt: "2026-01-01T15:00:00Z",
    category: "Lifestyle",
    rewardAmount: 7.5,
    isInstantReward: false,
    totalAnswers: 178,
  },
];

// ===========================================
// Mock Responses (Answers to Questions)
// ===========================================
export const mockResponses: Response[] = [
  {
    id: "response_001",
    responseText: "TypeScript is my favorite because of its strong typing system and excellent IDE support. It catches errors at compile time and makes refactoring much safer.",
    userId: "user_001",
    questionId: "question_001",
    createdAt: "2026-01-03T10:15:00Z",
    updatedAt: "2026-01-03T10:15:00Z",
    likesCount: 45,
    dislikesCount: 2,
    repliesCount: 5,
    isLiked: false,
    isDisliked: false,
  },
  {
    id: "response_002",
    responseText: "Python for its simplicity and vast ecosystem of libraries. It's perfect for data science and machine learning projects.",
    userId: "user_004",
    questionId: "question_001",
    createdAt: "2026-01-03T10:30:00Z",
    updatedAt: "2026-01-03T10:30:00Z",
    likesCount: 78,
    dislikesCount: 5,
    repliesCount: 8,
    isLiked: true,
    isDisliked: false,
  },
  {
    id: "response_003",
    responseText: "I use the Pomodoro technique and have a dedicated workspace. Also, regular breaks and a strict schedule help maintain focus.",
    userId: "user_002",
    questionId: "question_002",
    createdAt: "2026-01-03T12:00:00Z",
    updatedAt: "2026-01-03T12:00:00Z",
    likesCount: 32,
    dislikesCount: 1,
    repliesCount: 3,
    isLiked: false,
    isDisliked: false,
  },
];

// ===========================================
// Mock Response Replies
// ===========================================
export const mockResponseReplies: ResponseReply[] = [
  {
    id: "reply_001",
    replyText: "I agree! TypeScript has been a game changer for our team.",
    userId: "user_003",
    responseId: "response_001",
    createdAt: "2026-01-03T10:45:00Z",
    updatedAt: "2026-01-03T10:45:00Z",
  },
  {
    id: "reply_002",
    replyText: "Have you tried using VS Code with TypeScript? The integration is amazing!",
    userId: "user_004",
    responseId: "response_001",
    createdAt: "2026-01-03T11:00:00Z",
    updatedAt: "2026-01-03T11:00:00Z",
  },
];

// ===========================================
// Mock Reward Questions
// ===========================================

/**
 * Generate a future date for expiry (days from now)
 */
const getFutureDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(23, 59, 59, 0);
  return date.toISOString();
};

/**
 * Get today's date in ISO format
 */
const getTodayDate = (): string => {
  return new Date().toISOString();
};

export const mockRewardQuestions: RewardQuestion[] = [
  {
    id: "rq_001",
    text: "What is the capital of France?",
    options: { a: "London", b: "Berlin", c: "Paris", d: "Madrid" },
    correctAnswer: "c",
    rewardAmount: 5000,
    expiryTime: getFutureDate(7), // 7 days from now
    isActive: true,
    userId: "user_002",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 10,
    winnersCount: 3,
    isCompleted: false,
    paymentProvider: "MTN",
    phoneNumber: "+256 700 123 456",
  },
  {
    id: "rq_002",
    text: "Which planet is known as the Red Planet?",
    options: { a: "Venus", b: "Mars", c: "Jupiter", d: "Saturn" },
    correctAnswer: "b",
    rewardAmount: 10000,
    expiryTime: getFutureDate(14), // 14 days from now
    isActive: true,
    userId: "user_003",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 20,
    winnersCount: 5,
    isCompleted: false,
    paymentProvider: "AIRTEL",
    phoneNumber: "+256 700 234 567",
  },
  {
    id: "rq_003",
    text: "What is the largest ocean on Earth?",
    options: { a: "Atlantic Ocean", b: "Indian Ocean", c: "Pacific Ocean", d: "Arctic Ocean" },
    correctAnswer: "c",
    rewardAmount: 7500,
    expiryTime: getFutureDate(5), // 5 days from now
    isActive: true,
    userId: "user_001",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 15,
    winnersCount: 2,
    isCompleted: false,
    paymentProvider: "MTN",
    phoneNumber: "+256 700 345 678",
  },
  {
    id: "rq_004",
    text: "Who painted the Mona Lisa?",
    options: { a: "Vincent van Gogh", b: "Pablo Picasso", c: "Leonardo da Vinci", d: "Michelangelo" },
    correctAnswer: "c",
    rewardAmount: 15000,
    expiryTime: getFutureDate(10), // 10 days from now
    isActive: true,
    userId: "user_002",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 5,
    winnersCount: 1,
    isCompleted: false,
    paymentProvider: "AIRTEL",
    phoneNumber: "+256 700 456 789",
  },
  {
    id: "rq_005",
    text: "What is the chemical symbol for Gold?",
    options: { a: "Go", b: "Gd", c: "Au", d: "Ag" },
    correctAnswer: "c",
    rewardAmount: 8000,
    expiryTime: getFutureDate(3), // 3 days from now
    isActive: true,
    userId: "user_003",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 25,
    winnersCount: 8,
    isCompleted: false,
    paymentProvider: "MTN",
    phoneNumber: "+256 700 567 890",
  },
  {
    id: "rq_006",
    text: "In which year did World War II end?",
    options: { a: "1943", b: "1944", c: "1945", d: "1946" },
    correctAnswer: "c",
    rewardAmount: 12000,
    expiryTime: getFutureDate(21), // 21 days from now
    isActive: true,
    userId: "user_001",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 8,
    winnersCount: 0,
    isCompleted: false,
    paymentProvider: "AIRTEL",
    phoneNumber: "+256 700 678 901",
  },
  {
    id: "rq_007",
    text: "What is the smallest country in the world?",
    options: { a: "Monaco", b: "San Marino", c: "Vatican City", d: "Liechtenstein" },
    correctAnswer: "c",
    rewardAmount: 6000,
    expiryTime: getFutureDate(12), // 12 days from now
    isActive: true,
    userId: "user_002",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 30,
    winnersCount: 12,
    isCompleted: false,
    paymentProvider: "MTN",
    phoneNumber: "+256 700 789 012",
  },
  {
    id: "rq_008",
    text: "Which programming language was created by Guido van Rossum?",
    options: { a: "Java", b: "C++", c: "Python", d: "Ruby" },
    correctAnswer: "c",
    rewardAmount: 20000,
    expiryTime: getFutureDate(30), // 30 days from now
    isActive: true,
    userId: "user_003",
    createdAt: getTodayDate(),
    updatedAt: getTodayDate(),
    isInstantReward: true,
    maxWinners: 3,
    winnersCount: 0,
    isCompleted: false,
    paymentProvider: "AIRTEL",
    phoneNumber: "+256 700 890 123",
  },
];

// ===========================================
// Mock Quiz Questions (for Answer Questions & Earn)
// ===========================================
export const mockQuizQuestions: QuizQuestion[] = [
  {
    id: "quiz_001",
    text: "What is the largest planet in our solar system?",
    options: { a: "Earth", b: "Mars", c: "Jupiter", d: "Saturn" },
    correctAnswer: "c",
    explanation: "Jupiter is the largest planet in our solar system, with a mass more than twice that of all the other planets combined.",
    category: "Science",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_002",
    text: "Which programming language is known as the 'language of the web'?",
    options: { a: "Python", b: "JavaScript", c: "Java", d: "C++" },
    correctAnswer: "b",
    explanation: "JavaScript is the primary programming language for web development, running in browsers and on servers via Node.js.",
    category: "Technology",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_003",
    text: "What year did the first iPhone launch?",
    options: { a: "2005", b: "2006", c: "2007", d: "2008" },
    correctAnswer: "c",
    explanation: "The first iPhone was unveiled by Steve Jobs on January 9, 2007, and released on June 29, 2007.",
    category: "Technology",
    difficulty: "medium",
    pointValue: 15,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_004",
    text: "Which country has the largest population in Africa?",
    options: { a: "Ethiopia", b: "Egypt", c: "South Africa", d: "Nigeria" },
    correctAnswer: "d",
    explanation: "Nigeria has the largest population in Africa with over 200 million people.",
    category: "Geography",
    difficulty: "medium",
    pointValue: 15,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_005",
    text: "What is the chemical symbol for Gold?",
    options: { a: "Go", b: "Gd", c: "Au", d: "Ag" },
    correctAnswer: "c",
    explanation: "The chemical symbol for Gold is Au, derived from the Latin word 'aurum'.",
    category: "Science",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_006",
    text: "Which company owns Instagram?",
    options: { a: "Google", b: "Microsoft", c: "Meta (Facebook)", d: "Twitter" },
    correctAnswer: "c",
    explanation: "Instagram was acquired by Facebook (now Meta) in 2012 for approximately $1 billion.",
    category: "Technology",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_007",
    text: "What is the capital city of Uganda?",
    options: { a: "Nairobi", b: "Kampala", c: "Dar es Salaam", d: "Kigali" },
    correctAnswer: "b",
    explanation: "Kampala is the capital and largest city of Uganda, located on the shores of Lake Victoria.",
    category: "Geography",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_008",
    text: "How many continents are there on Earth?",
    options: { a: "5", b: "6", c: "7", d: "8" },
    correctAnswer: "c",
    explanation: "There are 7 continents: Africa, Antarctica, Asia, Australia, Europe, North America, and South America.",
    category: "Geography",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_009",
    text: "What does 'HTTP' stand for?",
    options: { a: "HyperText Transfer Protocol", b: "High Tech Transfer Protocol", c: "Hyper Terminal Transfer Program", d: "Home Tool Transfer Protocol" },
    correctAnswer: "a",
    explanation: "HTTP stands for HyperText Transfer Protocol, the foundation of data communication on the World Wide Web.",
    category: "Technology",
    difficulty: "medium",
    pointValue: 15,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_010",
    text: "Which planet is known as the 'Red Planet'?",
    options: { a: "Venus", b: "Mars", c: "Jupiter", d: "Mercury" },
    correctAnswer: "b",
    explanation: "Mars is called the Red Planet because of its reddish appearance, caused by iron oxide (rust) on its surface.",
    category: "Science",
    difficulty: "easy",
    pointValue: 10,
    timeLimit: 90,
    type: "single_choice",
  },
  {
    id: "quiz_011",
    text: "Python is a compiled programming language.",
    options: ["True", "False"],
    correctAnswer: "False",
    explanation: "Python is an interpreted language, not a compiled one. It executes code line by line at runtime.",
    category: "Technology",
    difficulty: "medium",
    pointValue: 15,
    timeLimit: 60,
    type: "boolean",
  },
  {
    id: "quiz_012",
    text: "The Great Wall of China is visible from space with the naked eye.",
    options: ["True", "False"],
    correctAnswer: "False",
    explanation: "This is a common myth. The Great Wall is not visible from space with the naked eye due to its relatively narrow width.",
    category: "General Knowledge",
    difficulty: "medium",
    pointValue: 15,
    timeLimit: 60,
    type: "boolean",
  },
];

// ===========================================
// Mock Rewards
// ===========================================
export const mockRewards: Reward[] = [
  {
    id: "reward_001",
    userEmail: "john.doe@example.com",
    points: 500,
    description: "Completed Customer Satisfaction Survey",
    createdAt: "2026-01-03T10:30:00Z",
    updatedAt: "2026-01-03T10:30:00Z",
  },
  {
    id: "reward_002",
    userEmail: "john.doe@example.com",
    points: 150,
    description: "Answer accepted for question",
    createdAt: "2026-01-03T10:15:00Z",
    updatedAt: "2026-01-03T10:15:00Z",
  },
  {
    id: "reward_003",
    userEmail: "john.doe@example.com",
    points: 50,
    description: "Watched: How to Earn $100 Daily",
    createdAt: "2026-01-02T16:45:00Z",
    updatedAt: "2026-01-02T16:45:00Z",
  },
  {
    id: "reward_004",
    userEmail: "john.doe@example.com",
    points: 100,
    description: "Daily login bonus",
    createdAt: "2026-01-04T08:00:00Z",
    updatedAt: "2026-01-04T08:00:00Z",
  },
];

// ===========================================
// Mock Payments
// ===========================================
export const mockPayments: Payment[] = [
  {
    id: "payment_001",
    amount: 50.0,
    phoneNumber: "+256 700 123 456",
    provider: "AIRTEL",
    TransactionId: "TXN-20260102-001",
    status: PaymentStatus.SUCCESSFUL,
    subscriptionType: SubscriptionType.MONTHLY,
    startDate: "2026-01-02T00:00:00Z",
    endDate: "2026-02-02T00:00:00Z",
    createdAt: "2026-01-02T14:20:00Z",
    updatedAt: "2026-01-02T14:25:00Z",
    userId: "user_001",
  },
  {
    id: "payment_002",
    amount: 100.0,
    phoneNumber: "+256 700 123 456",
    provider: "MTN",
    TransactionId: "TXN-20260104-012",
    status: PaymentStatus.PENDING,
    subscriptionType: SubscriptionType.MONTHLY,
    startDate: "2026-01-04T00:00:00Z",
    endDate: "2026-02-04T00:00:00Z",
    createdAt: "2026-01-04T11:00:00Z",
    updatedAt: "2026-01-04T11:00:00Z",
    userId: "user_001",
  },
];

// ===========================================
// Mock Transactions (Derived from payments and rewards)
// ===========================================
export const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    type: "reward",
    amount: 15.0,
    status: PaymentStatus.SUCCESSFUL,
    description: "Survey completion reward",
    referenceId: "REW-20260103-001",
    createdAt: "2026-01-03T10:30:00Z",
  },
  {
    id: "txn_002",
    type: "withdrawal",
    amount: -50.0,
    status: PaymentStatus.SUCCESSFUL,
    description: "Airtel Money withdrawal",
    referenceId: "WD-20260102-045",
    paymentMethod: "AIRTEL",
    phoneNumber: "+256 700 123 456",
    createdAt: "2026-01-02T14:20:00Z",
  },
  {
    id: "txn_003",
    type: "reward",
    amount: 5.0,
    status: PaymentStatus.SUCCESSFUL,
    description: "Question answer reward",
    referenceId: "REW-20260102-034",
    createdAt: "2026-01-02T09:15:00Z",
  },
  {
    id: "txn_004",
    type: "withdrawal",
    amount: -100.0,
    status: PaymentStatus.PENDING,
    description: "MTN Mobile Money withdrawal",
    referenceId: "WD-20260104-012",
    paymentMethod: "MTN",
    phoneNumber: "+256 700 123 456",
    createdAt: "2026-01-04T11:00:00Z",
  },
  {
    id: "txn_005",
    type: "reward",
    amount: 2.0,
    status: PaymentStatus.SUCCESSFUL,
    description: "Daily login bonus",
    referenceId: "REW-20260104-001",
    createdAt: "2026-01-04T08:00:00Z",
  },
  {
    id: "txn_006",
    type: "deposit",
    amount: 200.0,
    status: PaymentStatus.SUCCESSFUL,
    description: "Account top-up",
    referenceId: "DEP-20260101-001",
    paymentMethod: "MTN",
    phoneNumber: "+256 700 123 456",
    createdAt: "2026-01-01T10:00:00Z",
  },
];

// ===========================================
// Mock Notifications
// ===========================================
export const mockNotifications: Notification[] = [
  {
    id: "notif_001",
    userId: "user_001",
    title: "Payment Successful!",
    body: "Your withdrawal of $50.00 has been processed successfully.",
    type: NotificationType.PAYMENT_SUCCESS,
    priority: NotificationPriority.HIGH,
    icon: "check-circle",
    imageUrl: null,
    actionUrl: "/transactions",
    actionText: "View Transaction",
    metadata: { amount: 50, transactionId: "WD-20260102-045" },
    category: "payments",
    read: true,
    readAt: "2026-01-02T14:30:00Z",
    archived: false,
    archivedAt: null,
    delivered: true,
    deliveredAt: "2026-01-02T14:25:00Z",
    expiresAt: null,
    createdAt: "2026-01-02T14:25:00Z",
    updatedAt: "2026-01-02T14:30:00Z",
  },
  {
    id: "notif_002",
    userId: "user_001",
    title: "Reward Earned! 🎉",
    body: "You earned 500 points for completing the Customer Satisfaction Survey.",
    type: NotificationType.REWARD_EARNED,
    priority: NotificationPriority.MEDIUM,
    icon: "gift",
    imageUrl: null,
    actionUrl: "/rewards",
    actionText: "View Rewards",
    metadata: { points: 500, surveyId: "survey_001" },
    category: "rewards",
    read: false,
    readAt: null,
    archived: false,
    archivedAt: null,
    delivered: true,
    deliveredAt: "2026-01-03T10:30:00Z",
    expiresAt: null,
    createdAt: "2026-01-03T10:30:00Z",
    updatedAt: "2026-01-03T10:30:00Z",
  },
  {
    id: "notif_003",
    userId: "user_001",
    title: "Survey Expiring Soon",
    body: "The Product Feedback Survey is ending in 2 days. Don't miss out on $10.00!",
    type: NotificationType.SURVEY_EXPIRING,
    priority: NotificationPriority.MEDIUM,
    icon: "clock",
    imageUrl: null,
    actionUrl: "/survey/survey_002",
    actionText: "Take Survey",
    metadata: { surveyId: "survey_002", expiresIn: "2 days" },
    category: "surveys",
    read: false,
    readAt: null,
    archived: false,
    archivedAt: null,
    delivered: true,
    deliveredAt: "2026-01-04T09:00:00Z",
    expiresAt: "2026-01-12T23:59:59Z",
    createdAt: "2026-01-04T09:00:00Z",
    updatedAt: "2026-01-04T09:00:00Z",
  },
  {
    id: "notif_004",
    userId: "user_001",
    title: "Welcome to Delipucash! 👋",
    body: "Start earning by completing surveys and answering questions.",
    type: NotificationType.WELCOME,
    priority: NotificationPriority.LOW,
    icon: "star",
    imageUrl: null,
    actionUrl: "/",
    actionText: "Get Started",
    metadata: null,
    category: "system",
    read: true,
    readAt: "2025-01-01T00:05:00Z",
    archived: false,
    archivedAt: null,
    delivered: true,
    deliveredAt: "2025-01-01T00:00:00Z",
    expiresAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:05:00Z",
  },
];

// ===========================================
// Mock Login Sessions
// ===========================================
export const mockLoginSessions: LoginSession[] = [
  {
    id: "session_001",
    userId: "user_001",
    deviceInfo: { platform: "iOS", model: "iPhone 14 Pro", os: "17.2" },
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)",
    location: "Kampala, Uganda",
    isActive: true,
    lastActivity: "2026-01-04T12:00:00Z",
    loginTime: "2026-01-04T08:00:00Z",
    logoutTime: null,
    sessionToken: "jwt_token_here",
    createdAt: "2026-01-04T08:00:00Z",
    updatedAt: "2026-01-04T12:00:00Z",
  },
  {
    id: "session_002",
    userId: "user_001",
    deviceInfo: { platform: "Web", browser: "Chrome", version: "120.0" },
    ipAddress: "192.168.1.101",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    location: "Kampala, Uganda",
    isActive: false,
    lastActivity: "2026-01-03T18:00:00Z",
    loginTime: "2026-01-03T10:00:00Z",
    logoutTime: "2026-01-03T18:00:00Z",
    sessionToken: null,
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-03T18:00:00Z",
  },
];

// ===========================================
// Mock User Stats
// ===========================================
export const mockUserStats: UserStats = {
  totalQuestions: 127,
  totalAnswers: 234,
  totalSurveysCompleted: 45,
  totalVideosWatched: 89,
  totalEarnings: 24880.0,
  totalRewards: 1240,
  currentStreak: 7,
  questionsAnsweredToday: 5,
  earningsToday: 22.5,
  rewardsThisWeek: 125.0,
};

// ===========================================
// Question Categories
// ===========================================
export const questionCategories = [
  "Technology",
  "Lifestyle",
  "Business",
  "Education",
  "Health",
  "Entertainment",
  "Finance",
  "Sports",
  "Travel",
  "Food",
  "Other",
];

// ===========================================
// Video Categories
// ===========================================
export const videoCategories = [
  "Tutorial",
  "Tips",
  "Live",
  "Entertainment",
  "Education",
  "Finance",
  "Lifestyle",
  "Other",
];

// ===========================================
// Payment Methods
// ===========================================
export const paymentMethods = [
  {
    id: "AIRTEL",
    name: "Airtel Money",
    icon: "CreditCard",
    minWithdrawal: 5.0,
    maxWithdrawal: 1000.0,
    processingTime: "5-10 minutes",
  },
  {
    id: "MTN",
    name: "MTN Mobile Money",
    icon: "CreditCard",
    minWithdrawal: 5.0,
    maxWithdrawal: 1000.0,
    processingTime: "5-10 minutes",
  },
];

// ===========================================
// Helper Functions
// ===========================================

/**
 * Format currency with dollar sign
 */
export const formatCurrency = (amount: number): string => {
  return `$${Math.abs(amount).toFixed(2)}`;
};

/**
 * Format date to relative time string
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
};

/**
 * Format duration from seconds to MM:SS
 */
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "LIVE";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Get user by ID
 */
export const getUserById = (userId: string): AppUser | undefined => {
  return mockUsers.find(user => user.id === userId);
};

/**
 * Get question by ID
 */
export const getQuestionById = (questionId: string): Question | undefined => {
  return mockQuestions.find(question => question.id === questionId);
};

/**
 * Get survey by ID
 */
export const getSurveyById = (surveyId: string): Survey | undefined => {
  return mockSurveys.find(survey => survey.id === surveyId);
};

/**
 * Get video by ID
 */
export const getVideoById = (videoId: string): Video | undefined => {
  return mockVideos.find(video => video.id === videoId);
};

/**
 * Get responses for a question
 */
export const getResponsesForQuestion = (questionId: string): Response[] => {
  return mockResponses.filter(response => response.questionId === questionId);
};

/**
 * Get survey questions for a survey
 */
export const getSurveyQuestionsForSurvey = (surveyId: string): UploadSurvey[] => {
  return mockSurveyQuestions.filter(sq => sq.surveyId === surveyId);
};

/**
 * Get user notifications
 */
export const getUserNotifications = (userId: string): Notification[] => {
  return mockNotifications.filter(notif => notif.userId === userId);
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = (userId: string): number => {
  return mockNotifications.filter(notif => notif.userId === userId && !notif.read).length;
};
