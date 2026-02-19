/**
 * TypeScript types based on Prisma schema
 * These types mirror the database models for type safety
 */

// Enums
export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESSFUL = "SUCCESSFUL",
  FAILED = "FAILED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING",
}

export enum SubscriptionType {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  HALF_YEARLY = "HALF_YEARLY",
  YEARLY = "YEARLY",
}

export enum SurveySubscriptionType {
  ONCE = "ONCE",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  HALF_YEARLY = "HALF_YEARLY",
  YEARLY = "YEARLY",
  LIFETIME = "LIFETIME",
}

export enum PaymentProvider {
  MTN = "MTN",
  AIRTEL = "AIRTEL",
}

export enum NotificationType {
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  REWARD_EARNED = "REWARD_EARNED",
  REWARD_REDEEMED = "REWARD_REDEEMED",
  SURVEY_COMPLETED = "SURVEY_COMPLETED",
  SURVEY_EXPIRING = "SURVEY_EXPIRING",
  SUBSCRIPTION_ACTIVE = "SUBSCRIPTION_ACTIVE",
  SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED",
  SECURITY_ALERT = "SECURITY_ALERT",
  SYSTEM_UPDATE = "SYSTEM_UPDATE",
  PROMOTIONAL = "PROMOTIONAL",
  ACHIEVEMENT = "ACHIEVEMENT",
  REFERRAL_BONUS = "REFERRAL_BONUS",
  WELCOME = "WELCOME",
}

export enum NotificationPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

// Models
export interface AppUser {
  id: string;
  email: string;
  password?: string; // Omitted in client responses
  firstName: string;
  lastName: string;
  phone: string;
  points: number;
  avatar: string | null;
  role: UserRole;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  subscriptionStatus: SubscriptionStatus;
  surveysubscriptionStatus: SubscriptionStatus;
  currentSubscriptionId: string | null;
  privacySettings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Relations (optional, populated when needed)
  videos?: Video[];
  surveys?: Survey[];
  attempts?: QuestionAttempt[];
  rewards?: Reward[];
  payments?: Payment[];
  questions?: Question[];
  rewardQuestions?: RewardQuestion[];
  notifications?: Notification[];
  loginSessions?: LoginSession[];
}

export interface Video {
  id: string;
  title: string | null;
  description: string | null;
  videoUrl: string;
  thumbnail: string;
  userId?: string;
  user?: AppUser;
  likes: number;
  views: number;
  duration?: number; // Duration in seconds
  isLiked?: boolean;
  isBookmarked?: boolean;
  comments?: Comment[];
  commentsCount: number;
  createdAt: string;
  updatedAt?: string;
  // Livestream indicator (set by backend when associated with active livestream)
  isLive?: boolean;
  livestreamSessionId?: string;
  // Sponsored content fields (for in-feed ads)
  isSponsored?: boolean;
  sponsorName?: string;
  ctaUrl?: string;
  ctaText?: string;
}

export interface Comment {
  id: string;
  text: string;
  mediaUrls: string[];
  userId: string;
  videoId: string;
  user?: AppUser;
  video?: Video;
  createdAt: string;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  user?: AppUser;
  uploads?: UploadSurvey[];
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  responses?: SurveyResponse[];
  // Computed fields
  totalResponses?: number;
  maxResponses?: number;
  rewardAmount?: number;
  status?: "running" | "scheduled" | "completed";
}

export interface UploadSurvey {
  id: string;
  text: string;
  type: string;
  options: string;
  placeholder: string | null;
  minValue: number | null;
  maxValue: number | null;
  required: boolean;
  userId: string;
  surveyId: string;
  user?: AppUser;
  survey?: Survey;
  /** Conditional display logic — when set, question is only shown if rules evaluate to true */
  conditionalLogic?: ConditionalLogicConfig | null;
  createdAt: string;
  updatedAt: string;
}

/** Conditional logic configuration for survey branching */
export interface ConditionalLogicConfig {
  rules: ConditionalRule[];
  logicType: 'all' | 'any';
}

/** Single conditional display rule */
export interface ConditionalRule {
  sourceQuestionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value?: string;
  action?: 'show' | 'skip_to';
}

export interface Ad {
  id: string;
  title: string;
  headline: string | null;
  description: string;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  type: "regular" | "featured" | "banner" | "compact" | "video";
  placement: "home" | "feed" | "survey" | "video" | "question" | "profile" | "explore" | "interstitial" | "native" | "rewarded" | "story";
  sponsored: boolean;
  views: number;
  clicks: number;
  impressions: number;
  conversions: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: AppUser;
  priority: number;
  frequency: number | null;
  lastShown: string | null;
  targetUrl: string | null;
  // CTA & Engagement
  callToAction: "learn_more" | "shop_now" | "sign_up" | "download" | "contact_us" | "get_offer" | "book_now" | "watch_more" | "apply_now" | "subscribe" | "get_quote";
  // Budget & Bidding
  pricingModel: "cpm" | "cpc" | "cpa" | "flat";
  totalBudget: number;
  bidAmount: number;
  dailyBudgetLimit: number | null;
  amountSpent: number;
  // Targeting
  targetAgeRanges: string[] | null;
  targetGender: "all" | "male" | "female" | "other";
  targetLocations: string[] | null;
  targetInterests: string[] | null;
  enableRetargeting: boolean;
  // Status & Approval
  status: "pending" | "approved" | "rejected" | "paused" | "completed";
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface SurveyResponse {
  id: string;
  userId: string;
  surveyId: string;
  responses: string;
  user?: AppUser;
  survey?: Survey;
  createdAt: string;
  updatedAt: string;
}

export interface RewardQuestion {
  id: string;
  text: string;
  options: Record<string, unknown>;
  correctAnswer?: string;
  rewardAmount: number;
  expiryTime: string | null;
  isActive: boolean;
  userId: string;
  user?: AppUser;
  createdAt: string;
  updatedAt: string;
  isInstantReward: boolean;
  maxWinners: number;
  winnersCount: number;
  isCompleted: boolean;
  paymentProvider?: string | null;
  attempts?: RewardQuestionOnAttempt[];
  winners?: InstantRewardWinner[];
}

export interface RewardQuestionOnAttempt {
  id: string;
  rewardQuestionId: string;
  rewardQuestion?: RewardQuestion;
  questionAttemptId: string;
  questionAttempt?: QuestionAttempt;
}

export interface RewardAnswerResult {
  isCorrect: boolean;
  correctAnswer?: string;
  rewardEarned: number;
  remainingSpots: number;
  isExpired: boolean;
  isCompleted?: boolean;
  message?: string;
  // Instant reward specific fields
  isWinner?: boolean;
  position?: number | null;
  paymentStatus?: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | null;
  paymentReference?: string | null;
  pointsAwarded?: number;
}

export interface InstantRewardWinner {
  id: string;
  rewardQuestionId: string;
  rewardQuestion?: RewardQuestion;
  userEmail: string;
  user?: AppUser;
  position: number;
  amountAwarded: number;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  paymentProvider: string | null;
  phoneNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  text: string;
  userId: string | null;
  user?: AppUser;
  createdAt: string;
  updatedAt: string;
  responses?: Response[];
  attempts?: QuestionAttempt[];
  // Computed fields
  category?: string;
  rewardAmount?: number;
  isInstantReward?: boolean;
  totalAnswers?: number;
  viewCount?: number;
}

export interface Response {
  id: string;
  responseText: string;
  userId: string;
  user?: AppUser;
  questionId: string;
  question?: Question;
  createdAt: string;
  updatedAt: string;
  likes?: ResponseLike[];
  dislikes?: ResponseDislike[];
  replies?: ResponseReply[];
  // Computed fields (backend returns likeCount/dislikeCount/replyCount)
  likeCount?: number;
  dislikeCount?: number;
  replyCount?: number;
  /** @deprecated Use likeCount — kept for backwards compat */
  likesCount?: number;
  /** @deprecated Use dislikeCount — kept for backwards compat */
  dislikesCount?: number;
  /** @deprecated Use replyCount — kept for backwards compat */
  repliesCount?: number;
  isLiked?: boolean;
  isDisliked?: boolean;
}

export interface ResponseLike {
  id: string;
  userId: string;
  user?: AppUser;
  responseId: string;
  response?: Response;
  createdAt: string;
}

export interface ResponseDislike {
  id: string;
  userId: string;
  user?: AppUser;
  responseId: string;
  response?: Response;
  createdAt: string;
}

export interface ResponseReply {
  id: string;
  replyText: string;
  userId: string;
  user?: AppUser;
  responseId: string;
  response?: Response;
  createdAt: string;
  updatedAt: string;
}

export interface UploadQuestion {
  id: string;
  text: string;
  type: string;
  options: string[];
  correctAnswers: string[];
  placeholder: string | null;
  minValue: number | null;
  maxValue: number | null;
  userId: string;
  user?: AppUser;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionAttempt {
  id: string;
  userEmail: string;
  user?: AppUser;
  questionId: string;
  question?: Question;
  selectedAnswer: string;
  isCorrect: boolean;
  attemptedAt: string;
  rewardQuestions?: RewardQuestionOnAttempt[];
}

export interface Reward {
  id: string;
  userEmail: string;
  user?: AppUser;
  points: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  phoneNumber: string;
  provider: string;
  TransactionId: string;
  status: PaymentStatus;
  subscriptionType: SubscriptionType;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: AppUser;
}

export interface Notification {
  id: string;
  userId: string;
  user?: AppUser;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  icon: string | null;
  imageUrl: string | null;
  actionUrl: string | null;
  actionText: string | null;
  metadata: Record<string, unknown> | null;
  category: string | null;
  read: boolean;
  readAt: string | null;
  archived: boolean;
  archivedAt: string | null;
  delivered: boolean;
  deliveredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginSession {
  id: string;
  userId: string;
  user?: AppUser;
  deviceInfo: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  isActive: boolean;
  lastActivity: string;
  loginTime: string;
  logoutTime: string | null;
  sessionToken: string | null;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  message?: string;
}

// Transaction type for display purposes
export interface Transaction {
  id: string;
  type: "reward" | "withdrawal" | "deposit" | "payment";
  amount: number;
  status: PaymentStatus;
  description: string;
  referenceId: string;
  paymentMethod?: string;
  phoneNumber?: string;
  createdAt: string;
}

// User stats
export interface UserStats {
  totalQuestions: number;
  totalAnswers: number;
  totalSurveysCompleted: number;
  totalVideosWatched: number;
  totalEarnings: number;
  totalRewards: number;
  currentStreak: number;
  questionsAnsweredToday: number;
  earningsToday: number;
  rewardsThisWeek: number;
}

// ===========================================
// Quiz Session Types
// ===========================================

export type QuizSessionState =
  | 'LOADING'
  | 'DISPLAYING_QUESTION'
  | 'ANSWER_SELECTED'
  | 'ANSWER_VALIDATED'
  | 'SESSION_SUMMARY'
  | 'REWARDS_SELECTION'
  | 'COMPLETED';

export type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'boolean' | 'text' | 'checkbox';

export interface QuizQuestion {
  id: string;
  text: string;
  options?: Record<string, string> | string[];
  correctAnswer: string | string[];
  explanation?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  pointValue: number;
  timeLimit?: number; // seconds
  type: QuizQuestionType;
}

export interface QuizAnswerResult {
  questionId: string;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  isCorrect: boolean;
  pointsEarned: number;
  timeTaken: number;
  feedback: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  questions: QuizQuestion[];
  answers: QuizAnswerResult[];
  startedAt: string;
  completedAt?: string;
  totalPoints: number;
  correctCount: number;
  incorrectCount: number;
  maxStreak: number;
  currentStreak: number;
  averageTimePerQuestion: number;
}

export interface QuizSessionSummary {
  sessionId: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalPoints: number;
  pointsEarned: number;
  accuracy: number; // percentage
  averageTime: number;
  maxStreak: number;
  bonusPoints: number;
  totalEarned: number; // points + bonus
}

export type RewardRedemptionType = 'CASH' | 'AIRTIME';

export interface RewardRedemptionRequest {
  userId: string;
  points: number;
  redemptionType: RewardRedemptionType;
  phoneNumber: string;
  provider: 'MTN' | 'AIRTEL';
}

export interface RewardRedemptionResult {
  success: boolean;
  transactionId?: string;
  amountRedeemed: number;
  pointsDeducted: number;
  remainingPoints: number;
  message: string;
  paymentStatus: PaymentStatus;
}

export interface UserPoints {
  userId: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  pendingRedemption: number;
}
