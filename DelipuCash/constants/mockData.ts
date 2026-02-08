/**
 * Mock Data for Delipucash App
 * Used for frontend development and testing
 */

// Mock interfaces for UI components
export interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string | null;
  walletBalance: number;
  totalEarnings: number;
  totalRewards: number;
  role: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface MockQuestion {
  id: string;
  userId: string;
  questionText: string;
  category: string;
  rewardAmount: number;
  isInstantReward: boolean;
  status: string;
  totalAnswers: number;
  createdAt: string;
}

export interface MockSurvey {
  id: string;
  userId: string;
  title: string;
  description: string;
  rewardAmount: number;
  status: string;
  totalResponses: number;
  maxResponses: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface MockVideo {
  id: string;
  userId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: number;
  isLive: boolean;
  liveStreamUrl?: string;
  category: string;
  views: number;
  likes: number;
  status: string;
  isSponsored: boolean;
  createdAt: string;
}

// User Profile Mock Data
export const mockUserProfile: MockUser = {
  id: "1",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "+256 700 123 456",
  avatar: null,
  walletBalance: 12404.44,
  totalEarnings: 24880.0,
  totalRewards: 1240.0,
  role: "user",
  twoFactorEnabled: false,
  createdAt: "2025-01-01T00:00:00Z",
};

// Questions Mock Data
export const mockQuestions: MockQuestion[] = [
  {
    id: "1",
    userId: "2",
    questionText: "What is your favorite programming language and why?",
    category: "Technology",
    rewardAmount: 5.0,
    isInstantReward: true,
    status: "active",
    totalAnswers: 234,
    createdAt: "2026-01-03T10:00:00Z",
  },
  {
    id: "2",
    userId: "3",
    questionText: "How do you stay productive while working remotely?",
    category: "Lifestyle",
    rewardAmount: 3.5,
    isInstantReward: true,
    status: "active",
    totalAnswers: 156,
    createdAt: "2026-01-03T11:30:00Z",
  },
  {
    id: "3",
    userId: "4",
    questionText: "What are the best practices for mobile app development?",
    category: "Technology",
    rewardAmount: 7.5,
    isInstantReward: false,
    status: "active",
    totalAnswers: 89,
    createdAt: "2026-01-03T14:20:00Z",
  },
  {
    id: "4",
    userId: "2",
    questionText: "Share your top 3 productivity apps",
    category: "Productivity",
    rewardAmount: 4.0,
    isInstantReward: true,
    status: "active",
    totalAnswers: 312,
    createdAt: "2026-01-02T09:00:00Z",
  },
];

// Answers Mock Data
export interface MockAnswer {
  id: number;
  questionId: number;
  userId: number;
  answerText: string;
  isAccepted: boolean;
  likes: number;
  createdAt: string;
}

export const mockAnswers: MockAnswer[] = [
  {
    id: 1,
    questionId: 1,
    userId: 1,
    answerText:
      "TypeScript is my favorite because of its strong typing system and excellent IDE support.",
    isAccepted: false,
    likes: 45,
    createdAt: "2026-01-03T10:15:00Z",
  },
  {
    id: 2,
    questionId: 1,
    userId: 5,
    answerText: "Python for its simplicity and vast ecosystem of libraries.",
    isAccepted: true,
    likes: 78,
    createdAt: "2026-01-03T10:30:00Z",
  },
];

// Surveys Mock Data
export const mockSurveys: MockSurvey[] = [
  {
    id: "1",
    userId: "2",
    title: "Customer Satisfaction Survey",
    description: "Help us improve our services by sharing your feedback",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 234,
    maxResponses: 500,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2025-12-28T00:00:00Z",
  },
  {
    id: "2",
    userId: "3",
    title: "Product Feedback Survey",
    description: "Share your thoughts on our new features and help us build better products",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 89,
    maxResponses: 200,
    startDate: "2026-01-02T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2025-12-30T00:00:00Z",
  },
  {
    id: "3",
    userId: "2",
    title: "User Experience Study",
    description: "Tell us about your app experience and how we can improve it",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 45,
    maxResponses: 300,
    startDate: "2026-01-10T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "4",
    userId: "4",
    title: "Mobile App Usability Survey",
    description: "Help us improve the mobile experience with your valuable feedback",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 67,
    maxResponses: 150,
    startDate: "2026-02-01T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "5",
    userId: "3",
    title: "Digital Payment Habits Survey",
    description: "Share your mobile money and digital payment preferences",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 112,
    maxResponses: 400,
    startDate: "2026-01-20T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2026-01-18T00:00:00Z",
  },
];

// Survey Questions Mock Data
export interface SurveyQuestionOption {
  min?: number;
  max?: number;
  labels?: string[];
  choices?: string[];
  maxLength?: number;
}

export interface MockSurveyQuestion {
  id: number;
  surveyId: number;
  questionText: string;
  questionType: "rating" | "checkbox" | "text" | "radio";
  options: SurveyQuestionOption;
  required: boolean;
  displayOrder: number;
}

export const mockSurveyQuestions: MockSurveyQuestion[] = [
  {
    id: 1,
    surveyId: 1,
    questionText: "How satisfied are you with our service?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: [
        "Very Unsatisfied",
        "Unsatisfied",
        "Neutral",
        "Satisfied",
        "Very Satisfied",
      ],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 2,
    surveyId: 1,
    questionText: "Which features do you use most?",
    questionType: "checkbox",
    options: { choices: ["Questions", "Videos", "Surveys", "Wallet"] },
    required: false,
    displayOrder: 2,
  },
  {
    id: 3,
    surveyId: 1,
    questionText: "What can we improve?",
    questionType: "text",
    options: { maxLength: 500 },
    required: true,
    displayOrder: 3,
  },
  // Survey 2 questions
  {
    id: 4,
    surveyId: 2,
    questionText: "How would you rate the overall quality of our products?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 5,
    surveyId: 2,
    questionText: "Which product features are most important to you?",
    questionType: "checkbox",
    options: { choices: ["Ease of use", "Speed & Performance", "Security", "Customer Support", "Pricing"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 6,
    surveyId: 2,
    questionText: "What new features would you like us to add?",
    questionType: "text",
    options: { maxLength: 500 },
    required: false,
    displayOrder: 3,
  },
  // Survey 3 questions
  {
    id: 7,
    surveyId: 3,
    questionText: "How easy is it to navigate the app?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Difficult", "Difficult", "Neutral", "Easy", "Very Easy"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 8,
    surveyId: 3,
    questionText: "Which sections of the app do you visit most?",
    questionType: "checkbox",
    options: { choices: ["Home", "Surveys", "Questions", "Videos", "Wallet", "Profile"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 9,
    surveyId: 3,
    questionText: "What aspect of the user experience needs the most improvement?",
    questionType: "text",
    options: { maxLength: 500 },
    required: true,
    displayOrder: 3,
  },
  // Survey 4 questions
  {
    id: 10,
    surveyId: 4,
    questionText: "How often do you use our mobile app?",
    questionType: "radio",
    options: { choices: ["Daily", "Several times a week", "Once a week", "A few times a month", "Rarely"] },
    required: true,
    displayOrder: 1,
  },
  {
    id: 11,
    surveyId: 4,
    questionText: "Rate your overall satisfaction with the mobile app",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"],
    },
    required: true,
    displayOrder: 2,
  },
  {
    id: 12,
    surveyId: 4,
    questionText: "Any additional feedback about the mobile experience?",
    questionType: "text",
    options: { maxLength: 500 },
    required: false,
    displayOrder: 3,
  },
  // Survey 5 questions
  {
    id: 13,
    surveyId: 5,
    questionText: "Which mobile money service do you use most?",
    questionType: "radio",
    options: { choices: ["MTN Mobile Money", "Airtel Money", "Both equally", "Neither", "Other"] },
    required: true,
    displayOrder: 1,
  },
  {
    id: 14,
    surveyId: 5,
    questionText: "What do you mostly use mobile money for?",
    questionType: "checkbox",
    options: { choices: ["Sending money", "Receiving money", "Paying bills", "Shopping online", "Savings", "Withdrawals"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 15,
    surveyId: 5,
    questionText: "How secure do you feel using digital payments?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Not Secure", "Slightly Secure", "Neutral", "Secure", "Very Secure"],
    },
    required: true,
    displayOrder: 3,
  },
  {
    id: 16,
    surveyId: 5,
    questionText: "What would make you use digital payments more?",
    questionType: "text",
    options: { maxLength: 500 },
    required: false,
    displayOrder: 4,
  },
];

// Videos Mock Data
export const mockVideos: MockVideo[] = [
  {
    id: "1",
    userId: "2",
    title: "How to Earn $100 Daily on Delipucash",
    description: "Complete guide to maximizing your earnings",
    videoUrl: "https://example.com/video1.mp4",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    duration: 420,
    isLive: false,
    category: "Tutorial",
    views: 12450,
    likes: 892,
    status: "active",
    isSponsored: true,
    createdAt: "2026-01-02T08:00:00Z",
  },
  {
    id: "2",
    userId: "3",
    title: "Live Q&A: Making Money Online",
    description: "Join us for tips and tricks",
    videoUrl: "https://example.com/live1.m3u8",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    duration: undefined,
    isLive: true,
    liveStreamUrl: "https://example.com/live1.m3u8",
    category: "Live",
    views: 3240,
    likes: 456,
    status: "active",
    isSponsored: false,
    createdAt: "2026-01-04T14:00:00Z",
  },
  {
    id: "3",
    userId: "4",
    title: "Survey Tips for Maximum Rewards",
    description: "How to qualify for high-paying surveys",
    videoUrl: "https://example.com/video2.mp4",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    duration: 315,
    isLive: false,
    category: "Tips",
    views: 8920,
    likes: 721,
    status: "active",
    isSponsored: false,
    createdAt: "2026-01-03T16:30:00Z",
  },
  {
    id: "4",
    userId: "2",
    title: "Airtel Money Withdrawal Guide",
    description: "Step-by-step withdrawal tutorial",
    videoUrl: "https://example.com/video3.mp4",
    thumbnailUrl: "https://via.placeholder.com/300x200",
    duration: 180,
    isLive: false,
    category: "Tutorial",
    views: 15680,
    likes: 1204,
    status: "active",
    isSponsored: true,
    createdAt: "2026-01-01T12:00:00Z",
  },
];

// Transactions Mock Data
export interface MockTransaction {
  id: number;
  userId: number;
  transactionType: "reward" | "withdrawal";
  amount: number;
  paymentMethod: string | null;
  phoneNumber: string | null;
  status: "completed" | "pending" | "failed";
  referenceId: string;
  description: string;
  createdAt: string;
}

export const mockTransactions: MockTransaction[] = [
  {
    id: 1,
    userId: 1,
    transactionType: "reward",
    amount: 2000,
    paymentMethod: null,
    phoneNumber: null,
    status: "completed",
    referenceId: "REW-20260103-001",
    description: "Survey completion reward",
    createdAt: "2026-01-03T10:30:00Z",
  },
  {
    id: 2,
    userId: 1,
    transactionType: "withdrawal",
    amount: -50.0,
    paymentMethod: "airtel_money",
    phoneNumber: "+256 700 123 456",
    status: "completed",
    referenceId: "WD-20260102-045",
    description: "Airtel Money withdrawal",
    createdAt: "2026-01-02T14:20:00Z",
  },
  {
    id: 3,
    userId: 1,
    transactionType: "reward",
    amount: 5.0,
    paymentMethod: null,
    phoneNumber: null,
    status: "completed",
    referenceId: "REW-20260102-034",
    description: "Question answer reward",
    createdAt: "2026-01-02T09:15:00Z",
  },
  {
    id: 4,
    userId: 1,
    transactionType: "withdrawal",
    amount: -100.0,
    paymentMethod: "mtn_mobile_money",
    phoneNumber: "+256 700 123 456",
    status: "pending",
    referenceId: "WD-20260104-012",
    description: "MTN Mobile Money withdrawal",
    createdAt: "2026-01-04T11:00:00Z",
  },
];

// Rewards Mock Data
export interface MockReward {
  id: number;
  userId: number;
  rewardType: "question_answer" | "survey_complete" | "video_view" | "daily_login";
  amount: number;
  referenceId: number | null;
  description: string;
  claimed: boolean;
  createdAt: string;
}

export const mockRewards: MockReward[] = [
  {
    id: 1,
    userId: 1,
    rewardType: "question_answer",
    amount: 5.0,
    referenceId: 1,
    description: "Answer accepted for question #1",
    claimed: true,
    createdAt: "2026-01-03T10:15:00Z",
  },
  {
    id: 2,
    userId: 1,
    rewardType: "survey_complete",
    amount: 2000,
    referenceId: 1,
    description: "Completed Customer Satisfaction Survey",
    claimed: true,
    createdAt: "2026-01-03T10:30:00Z",
  },
  {
    id: 3,
    userId: 1,
    rewardType: "video_view",
    amount: 0.5,
    referenceId: 1,
    description: "Watched: How to Earn $100 Daily",
    claimed: true,
    createdAt: "2026-01-02T16:45:00Z",
  },
  {
    id: 4,
    userId: 1,
    rewardType: "daily_login",
    amount: 2.0,
    referenceId: null,
    description: "Daily login bonus",
    claimed: true,
    createdAt: "2026-01-04T08:00:00Z",
  },
];

// Posts Mock Data
export interface MockPost {
  id: number;
  userId: number;
  content: string;
  mediaUrl: string | null;
  mediaType: "none" | "image" | "video";
  likes: number;
  commentsCount: number;
  isPromoted: boolean;
  createdAt: string;
}

export const mockPosts: MockPost[] = [
  {
    id: 1,
    userId: 2,
    content: "Just earned $50 today by completing surveys! 💰 #Delipucash",
    mediaUrl: null,
    mediaType: "none",
    likes: 245,
    commentsCount: 18,
    isPromoted: false,
    createdAt: "2026-01-03T15:00:00Z",
  },
  {
    id: 2,
    userId: 3,
    content: "Check out my new video tutorial!",
    mediaUrl: "https://via.placeholder.com/400x300",
    mediaType: "image",
    likes: 189,
    commentsCount: 23,
    isPromoted: true,
    createdAt: "2026-01-03T12:30:00Z",
  },
];

// Statistics Mock Data
export interface MockStatistics {
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

export const mockStatistics: MockStatistics = {
  totalQuestions: 127,
  totalAnswers: 234,
  totalSurveysCompleted: 45,
  totalVideosWatched: 89,
  totalEarnings: 24880.0,
  totalRewards: 1240.0,
  currentStreak: 7,
  questionsAnsweredToday: 5,
  earningsToday: 22.5,
  rewardsThisWeek: 125.0,
};

// Question Categories
export const questionCategories: string[] = [
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

// Video Categories
export const videoCategories: string[] = [
  "Tutorial",
  "Tips",
  "Live",
  "Entertainment",
  "Education",
  "Finance",
  "Lifestyle",
  "Other",
];

// Mock Question Details (for answer screen)
export interface MockQuestionDetailAnswer {
  id: number;
  user: { name: string; avatar: string };
  answerText: string;
  likes: number;
  isAccepted: boolean;
  createdAt: string;
}

export interface MockQuestionDetail {
  id: number;
  questionText: string;
  category: string;
  rewardAmount: number;
  isInstantReward: boolean;
  user: { name: string; avatar: string };
  createdAt: string;
  totalAnswers: number;
  answers: MockQuestionDetailAnswer[];
}

export const mockQuestionDetails: Record<number, MockQuestionDetail> = {
  1: {
    id: 1,
    questionText: "What is your favorite programming language and why?",
    category: "Technology",
    rewardAmount: 5.0,
    isInstantReward: true,
    user: {
      name: "Sarah Johnson",
      avatar: "SJ",
    },
    createdAt: "2026-01-03T10:00:00Z",
    totalAnswers: 234,
    answers: [
      {
        id: 1,
        user: { name: "John Doe", avatar: "JD" },
        answerText:
          "TypeScript is my favorite because of its strong typing system and excellent IDE support.",
        likes: 45,
        isAccepted: true,
        createdAt: "2026-01-03T10:15:00Z",
      },
      {
        id: 2,
        user: { name: "Alice Smith", avatar: "AS" },
        answerText:
          "Python for its simplicity and vast ecosystem of libraries.",
        likes: 78,
        isAccepted: false,
        createdAt: "2026-01-03T10:30:00Z",
      },
    ],
  },
  2: {
    id: 2,
    questionText: "How do you stay productive while working remotely?",
    category: "Lifestyle",
    rewardAmount: 3.5,
    isInstantReward: true,
    user: {
      name: "Mike Chen",
      avatar: "MC",
    },
    createdAt: "2026-01-03T11:30:00Z",
    totalAnswers: 156,
    answers: [],
  },
};

// Mock Survey Details (for attempt screen)
export interface MockSurveyDetailQuestion {
  id: number;
  questionText: string;
  questionType: "rating" | "checkbox" | "radio" | "text";
  required: boolean;
  displayOrder: number;
  options: string[] | { min?: number; max?: number; labels?: string[]; multiline?: boolean; placeholder?: string };
}

export interface MockSurveyDetail {
  id: number;
  title: string;
  description: string;
  rewardAmount: number;
  estimatedTime: number;
  questions: MockSurveyDetailQuestion[];
}

export const mockSurveyDetails: Record<number, MockSurveyDetail> = {
  1: {
    id: 1,
    title: "Customer Satisfaction Survey",
    description: "Help us improve our services by sharing your feedback",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 1,
        questionText: "How satisfied are you with our platform?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: [
            "Very Unsatisfied",
            "Unsatisfied",
            "Neutral",
            "Satisfied",
            "Very Satisfied",
          ],
        },
      },
      {
        id: 2,
        questionText: "Which features do you use most? (Select all that apply)",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Questions & Answers",
          "Surveys",
          "Videos",
          "Live Streaming",
          "Rewards",
        ],
      },
      {
        id: 3,
        questionText: "How did you hear about us?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: [
          "Social Media",
          "Friend Referral",
          "Search Engine",
          "Advertisement",
          "Other",
        ],
      },
      {
        id: 4,
        questionText: "What improvements would you like to see?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Share your suggestions..." },
      },
    ],
  },
  2: {
    id: 2,
    title: "Product Feedback Survey",
    description: "Share your thoughts on our new features and help us build better products",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 5,
        questionText: "How would you rate the overall quality of our products?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
        },
      },
      {
        id: 6,
        questionText: "Which product features are most important to you?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Ease of use",
          "Speed & Performance",
          "Security",
          "Customer Support",
          "Pricing",
        ],
      },
      {
        id: 7,
        questionText: "How likely are you to recommend our product to a friend?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Very Likely", "Likely", "Neutral", "Unlikely", "Very Unlikely"],
      },
      {
        id: 8,
        questionText: "What new features would you like us to add?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Tell us what you'd like..." },
      },
    ],
  },
  3: {
    id: 3,
    title: "User Experience Study",
    description: "Tell us about your app experience and how we can improve it",
    rewardAmount: 2000,
    estimatedTime: 6,
    questions: [
      {
        id: 9,
        questionText: "How easy is it to navigate the app?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Difficult", "Difficult", "Neutral", "Easy", "Very Easy"],
        },
      },
      {
        id: 10,
        questionText: "Which sections of the app do you visit most?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Home",
          "Surveys",
          "Questions",
          "Videos",
          "Wallet",
          "Profile",
        ],
      },
      {
        id: 11,
        questionText: "How would you describe the app's loading speed?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Very Fast", "Fast", "Average", "Slow", "Very Slow"],
      },
      {
        id: 12,
        questionText: "What aspect of the user experience needs the most improvement?",
        questionType: "text",
        required: true,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Share your experience..." },
      },
    ],
  },
  4: {
    id: 4,
    title: "Mobile App Usability Survey",
    description: "Help us improve the mobile experience with your valuable feedback",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 13,
        questionText: "How often do you use our mobile app?",
        questionType: "radio",
        required: true,
        displayOrder: 1,
        options: ["Daily", "Several times a week", "Once a week", "A few times a month", "Rarely"],
      },
      {
        id: 14,
        questionText: "Which device do you primarily use?",
        questionType: "radio",
        required: true,
        displayOrder: 2,
        options: ["Android Phone", "iPhone", "Android Tablet", "iPad", "Other"],
      },
      {
        id: 15,
        questionText: "Rate your overall satisfaction with the mobile app",
        questionType: "rating",
        required: true,
        displayOrder: 3,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"],
        },
      },
      {
        id: 16,
        questionText: "Any additional feedback about the mobile experience?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Your feedback..." },
      },
    ],
  },
  5: {
    id: 5,
    title: "Digital Payment Habits Survey",
    description: "Share your mobile money and digital payment preferences",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 17,
        questionText: "Which mobile money service do you use most?",
        questionType: "radio",
        required: true,
        displayOrder: 1,
        options: ["MTN Mobile Money", "Airtel Money", "Both equally", "Neither", "Other"],
      },
      {
        id: 18,
        questionText: "What do you mostly use mobile money for?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Sending money",
          "Receiving money",
          "Paying bills",
          "Shopping online",
          "Savings",
          "Withdrawals",
        ],
      },
      {
        id: 19,
        questionText: "How secure do you feel using digital payments?",
        questionType: "rating",
        required: true,
        displayOrder: 3,
        options: {
          min: 1,
          max: 5,
          labels: ["Not Secure", "Slightly Secure", "Neutral", "Secure", "Very Secure"],
        },
      },
      {
        id: 20,
        questionText: "What would make you use digital payments more?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Share your thoughts..." },
      },
    ],
  },
};

// Payment Methods
export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  minWithdrawal: number;
  maxWithdrawal: number;
  processingTime: string;
}

export const paymentMethods: PaymentMethod[] = [
  {
    id: "airtel_money",
    name: "Airtel Money",
    icon: "CreditCard",
    minWithdrawal: 5.0,
    maxWithdrawal: 1000.0,
    processingTime: "5-10 minutes",
  },
  {
    id: "mtn_mobile_money",
    name: "MTN Mobile Money",
    icon: "CreditCard",
    minWithdrawal: 5.0,
    maxWithdrawal: 1000.0,
    processingTime: "5-10 minutes",
  },
];

// Helper function to format currency (UGX)
export const formatCurrency = (amount: number): string => {
  return `UGX ${Math.abs(amount).toLocaleString()}`;
};

// Helper function to format date
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

// Helper function to format duration (seconds to MM:SS)
export const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return "LIVE";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
