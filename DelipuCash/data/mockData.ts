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
// Mock Videos
// ===========================================
export const mockVideos: Video[] = [
  {
    id: "video_001",
    title: "How to Earn $100 Daily on Delipucash",
    description: "Complete guide to maximizing your earnings on the platform",
    videoUrl: "https://example.com/videos/earn-100-daily.mp4",
    thumbnail: "https://via.placeholder.com/400x225/4F46E5/FFFFFF?text=Earn+Daily",
    userId: "user_002",
    likes: 892,
    views: 12450,
    isBookmarked: false,
    commentsCount: 45,
    createdAt: "2026-01-02T08:00:00Z",
    updatedAt: "2026-01-04T10:00:00Z",
  },
  {
    id: "video_002",
    title: "Live Q&A: Making Money Online",
    description: "Join us for tips and tricks on maximizing your online income",
    videoUrl: "https://example.com/live/qa-session.m3u8",
    thumbnail: "https://via.placeholder.com/400x225/EF4444/FFFFFF?text=LIVE",
    userId: "user_003",
    likes: 456,
    views: 3240,
    isBookmarked: true,
    commentsCount: 128,
    createdAt: "2026-01-04T14:00:00Z",
    updatedAt: "2026-01-04T14:00:00Z",
  },
  {
    id: "video_003",
    title: "Survey Tips for Maximum Rewards",
    description: "How to qualify for high-paying surveys every time",
    videoUrl: "https://example.com/videos/survey-tips.mp4",
    thumbnail: "https://via.placeholder.com/400x225/10B981/FFFFFF?text=Survey+Tips",
    userId: "user_004",
    likes: 721,
    views: 8920,
    isBookmarked: false,
    commentsCount: 32,
    createdAt: "2026-01-03T16:30:00Z",
    updatedAt: "2026-01-03T16:30:00Z",
  },
  {
    id: "video_004",
    title: "Airtel Money Withdrawal Guide",
    description: "Step-by-step tutorial for withdrawing your earnings",
    videoUrl: "https://example.com/videos/withdrawal-guide.mp4",
    thumbnail: "https://via.placeholder.com/400x225/F59E0B/FFFFFF?text=Withdrawal",
    userId: "user_002",
    likes: 1204,
    views: 15680,
    isBookmarked: true,
    commentsCount: 67,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
  },
  {
    id: "video_005",
    title: "How to Save Money in 2026",
    description: "Practical tips for saving money this year",
    videoUrl: "https://example.com/videos/save-money.mp4",
    thumbnail: "https://via.placeholder.com/400x225/8B5CF6/FFFFFF?text=Save+Money",
    userId: "user_003",
    likes: 543,
    views: 1200,
    isBookmarked: false,
    commentsCount: 21,
    createdAt: "2025-12-28T10:00:00Z",
    updatedAt: "2025-12-28T10:00:00Z",
  },
  {
    id: "video_006",
    title: "Investment Tips for Beginners",
    description: "Start your investment journey with these essential tips",
    videoUrl: "https://example.com/videos/investment-tips.mp4",
    thumbnail: "https://via.placeholder.com/400x225/06B6D4/FFFFFF?text=Investment",
    userId: "user_002",
    likes: 387,
    views: 850,
    isBookmarked: false,
    commentsCount: 15,
    createdAt: "2025-12-25T14:00:00Z",
    updatedAt: "2025-12-25T14:00:00Z",
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
export const mockRewardQuestions: RewardQuestion[] = [
  {
    id: "rq_001",
    text: "What is the capital of France?",
    options: { a: "London", b: "Berlin", c: "Paris", d: "Madrid" },
    correctAnswer: "c",
    rewardAmount: 5,
    expiryTime: "2026-01-10T23:59:59Z",
    isActive: true,
    userId: "user_002",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    isInstantReward: true,
    maxWinners: 2,
    winnersCount: 1,
    isCompleted: false,
    paymentProvider: "MTN",
    phoneNumber: "+256 700 123 456",
  },
  {
    id: "rq_002",
    text: "Which planet is known as the Red Planet?",
    options: { a: "Venus", b: "Mars", c: "Jupiter", d: "Saturn" },
    correctAnswer: "b",
    rewardAmount: 10,
    expiryTime: "2026-01-15T23:59:59Z",
    isActive: true,
    userId: "user_003",
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    isInstantReward: true,
    maxWinners: 5,
    winnersCount: 2,
    isCompleted: false,
    paymentProvider: "AIRTEL",
    phoneNumber: "+256 700 234 567",
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
