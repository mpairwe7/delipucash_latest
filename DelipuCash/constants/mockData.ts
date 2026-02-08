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
  // ── Active / Running Surveys ──────────────────────────────────────────
  {
    id: "1",
    userId: "2",
    title: "Customer Satisfaction Survey",
    description: "Help us improve our services by sharing your feedback on what we're doing well and where we can improve",
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
    description: "Share your thoughts on our new features and help us build better products for you",
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
    description: "Tell us about your app experience and how we can improve navigation, speed, and design",
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
    description: "Help us improve the mobile experience with your valuable feedback on usability and performance",
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
    description: "Share your mobile money and digital payment preferences to help us serve you better",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 112,
    maxResponses: 400,
    startDate: "2026-01-20T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2026-01-18T00:00:00Z",
  },
  {
    id: "6",
    userId: "2",
    title: "Content Quality Assessment",
    description: "Rate the quality of videos, questions, and educational content available on our platform",
    rewardAmount: 2000,
    status: "running",
    totalResponses: 156,
    maxResponses: 350,
    startDate: "2026-01-25T00:00:00Z",
    endDate: "2026-04-30T23:59:59Z",
    createdAt: "2026-01-22T00:00:00Z",
  },

  // ── Upcoming / Scheduled Surveys ──────────────────────────────────────
  {
    id: "7",
    userId: "3",
    title: "Financial Literacy Survey",
    description: "Help us understand financial education needs in your community to create better learning content",
    rewardAmount: 2000,
    status: "scheduled",
    totalResponses: 0,
    maxResponses: 600,
    startDate: "2026-03-01T00:00:00Z",
    endDate: "2026-05-30T23:59:59Z",
    createdAt: "2026-02-05T00:00:00Z",
  },
  {
    id: "8",
    userId: "4",
    title: "Community Engagement Survey",
    description: "Share your ideas on how we can build a stronger, more connected user community",
    rewardAmount: 2000,
    status: "scheduled",
    totalResponses: 0,
    maxResponses: 400,
    startDate: "2026-03-15T00:00:00Z",
    endDate: "2026-06-15T23:59:59Z",
    createdAt: "2026-02-06T00:00:00Z",
  },
  {
    id: "9",
    userId: "2",
    title: "Platform Feature Wishlist",
    description: "Vote on and suggest new features you'd like to see in our next major update",
    rewardAmount: 2000,
    status: "scheduled",
    totalResponses: 0,
    maxResponses: 500,
    startDate: "2026-04-01T00:00:00Z",
    endDate: "2026-06-30T23:59:59Z",
    createdAt: "2026-02-07T00:00:00Z",
  },
  {
    id: "10",
    userId: "3",
    title: "Advertising Preferences Survey",
    description: "Tell us about your ad preferences so we can show you more relevant and less intrusive ads",
    rewardAmount: 2000,
    status: "scheduled",
    totalResponses: 0,
    maxResponses: 350,
    startDate: "2026-03-20T00:00:00Z",
    endDate: "2026-05-20T23:59:59Z",
    createdAt: "2026-02-08T00:00:00Z",
  },

  // ── Completed Surveys ─────────────────────────────────────────────────
  {
    id: "11",
    userId: "2",
    title: "Beta Launch Feedback Survey",
    description: "Thank you for providing feedback during our beta launch phase! Your input shaped our product",
    rewardAmount: 2000,
    status: "completed",
    totalResponses: 500,
    maxResponses: 500,
    startDate: "2025-10-01T00:00:00Z",
    endDate: "2025-12-31T23:59:59Z",
    createdAt: "2025-09-28T00:00:00Z",
  },
  {
    id: "12",
    userId: "3",
    title: "Holiday Season Shopping Survey",
    description: "This survey helped us understand holiday spending habits and shopping preferences",
    rewardAmount: 2000,
    status: "completed",
    totalResponses: 378,
    maxResponses: 400,
    startDate: "2025-11-15T00:00:00Z",
    endDate: "2026-01-15T23:59:59Z",
    createdAt: "2025-11-10T00:00:00Z",
  },
  {
    id: "13",
    userId: "4",
    title: "New Year Resolutions Survey",
    description: "We gathered insights about user goals and resolutions to improve our services in 2026",
    rewardAmount: 2000,
    status: "completed",
    totalResponses: 289,
    maxResponses: 300,
    startDate: "2025-12-20T00:00:00Z",
    endDate: "2026-01-31T23:59:59Z",
    createdAt: "2025-12-18T00:00:00Z",
  },
  {
    id: "14",
    userId: "2",
    title: "App Onboarding Experience Survey",
    description: "User feedback on the sign-up and onboarding flow helped us simplify the process",
    rewardAmount: 2000,
    status: "completed",
    totalResponses: 450,
    maxResponses: 450,
    startDate: "2025-11-01T00:00:00Z",
    endDate: "2026-01-20T23:59:59Z",
    createdAt: "2025-10-28T00:00:00Z",
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
  // Survey 6 questions (Running — Content Quality)
  {
    id: 17,
    surveyId: 6,
    questionText: "How would you rate the overall quality of our content?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 18,
    surveyId: 6,
    questionText: "Which content types do you enjoy most?",
    questionType: "checkbox",
    options: { choices: ["Short Videos", "Educational Quizzes", "Polls & Surveys", "Live Streams", "Written Articles"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 19,
    surveyId: 6,
    questionText: "What topics would you like to see more content about?",
    questionType: "text",
    options: { maxLength: 500 },
    required: false,
    displayOrder: 3,
  },
  // Survey 7 questions (Upcoming — Financial Literacy)
  {
    id: 20,
    surveyId: 7,
    questionText: "How would you rate your understanding of personal finance?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Low", "Low", "Average", "Good", "Expert"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 21,
    surveyId: 7,
    questionText: "Which financial topics interest you?",
    questionType: "checkbox",
    options: { choices: ["Budgeting", "Saving & Investing", "Mobile Money Tips", "Loans & Credit", "Insurance", "Taxes"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 22,
    surveyId: 7,
    questionText: "How do you prefer to learn about finances?",
    questionType: "radio",
    options: { choices: ["Short Videos", "Written Guides", "Interactive Quizzes", "Webinars", "One-on-one Coaching"] },
    required: true,
    displayOrder: 3,
  },
  {
    id: 23,
    surveyId: 7,
    questionText: "What is your biggest financial challenge right now?",
    questionType: "text",
    options: { maxLength: 500 },
    required: false,
    displayOrder: 4,
  },
  // Survey 8 questions (Upcoming — Community Engagement)
  {
    id: 24,
    surveyId: 8,
    questionText: "How connected do you feel to the DelipuCash community?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Not at All", "Slightly", "Moderately", "Very", "Extremely"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 25,
    surveyId: 8,
    questionText: "Which community features would you like to see?",
    questionType: "checkbox",
    options: { choices: ["Discussion Forums", "User Groups", "Community Challenges", "Leaderboards", "Mentorship Programs"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 26,
    surveyId: 8,
    questionText: "How often would you participate in community events?",
    questionType: "radio",
    options: { choices: ["Daily", "Weekly", "Monthly", "Occasionally", "Never"] },
    required: true,
    displayOrder: 3,
  },
  // Survey 9 questions (Upcoming — Feature Wishlist)
  {
    id: 27,
    surveyId: 9,
    questionText: "How would you rate the current set of app features?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Lacking", "Lacking", "Adequate", "Good", "Excellent"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 28,
    surveyId: 9,
    questionText: "Which upcoming features excite you most?",
    questionType: "checkbox",
    options: { choices: ["Dark Mode", "Offline Mode", "Voice Surveys", "Group Challenges", "Referral Bonuses", "In-app Messaging"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 29,
    surveyId: 9,
    questionText: "Describe a feature you wish we had.",
    questionType: "text",
    options: { maxLength: 500 },
    required: true,
    displayOrder: 3,
  },
  // Survey 10 questions (Upcoming — Advertising Preferences)
  {
    id: 30,
    surveyId: 10,
    questionText: "How do you feel about seeing ads in the app?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Strongly Dislike", "Dislike", "Neutral", "Accept", "Don't Mind"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 31,
    surveyId: 10,
    questionText: "Which ad formats are least disruptive to you?",
    questionType: "checkbox",
    options: { choices: ["Banner Ads", "Rewarded Video Ads", "Native Ads in Feed", "Interstitial Ads", "Sponsored Content"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 32,
    surveyId: 10,
    questionText: "Would you watch a video ad in exchange for extra rewards?",
    questionType: "radio",
    options: { choices: ["Yes, always", "Sometimes", "Rarely", "Never"] },
    required: true,
    displayOrder: 3,
  },
  // Survey 11 questions (Completed — Beta Launch Feedback)
  {
    id: 33,
    surveyId: 11,
    questionText: "Overall, how was your beta experience?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Terrible", "Poor", "Okay", "Good", "Amazing"],
    },
    required: true,
    displayOrder: 1,
  },
  {
    id: 34,
    surveyId: 11,
    questionText: "Which beta features worked well?",
    questionType: "checkbox",
    options: { choices: ["Account Creation", "Survey Completion", "Reward Withdrawal", "Video Watching", "Push Notifications"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 35,
    surveyId: 11,
    questionText: "Did you encounter any major bugs?",
    questionType: "radio",
    options: { choices: ["No bugs at all", "Minor bugs only", "Some significant bugs", "Many bugs", "App was unusable"] },
    required: true,
    displayOrder: 3,
  },
  // Survey 12 questions (Completed — Holiday Shopping)
  {
    id: 36,
    surveyId: 12,
    questionText: "How much did you spend during the holiday season?",
    questionType: "radio",
    options: { choices: ["Less than UGX 50,000", "UGX 50,000 – 200,000", "UGX 200,000 – 500,000", "UGX 500,000 – 1,000,000", "Over UGX 1,000,000"] },
    required: true,
    displayOrder: 1,
  },
  {
    id: 37,
    surveyId: 12,
    questionText: "What did you shop for?",
    questionType: "checkbox",
    options: { choices: ["Clothing & Fashion", "Electronics", "Food & Groceries", "Gifts for Others", "Travel & Entertainment", "Home & Decor"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 38,
    surveyId: 12,
    questionText: "Rate your holiday shopping experience overall.",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Very Stressful", "Stressful", "Neutral", "Enjoyable", "Very Enjoyable"],
    },
    required: true,
    displayOrder: 3,
  },
  // Survey 13 questions (Completed — New Year Resolutions)
  {
    id: 39,
    surveyId: 13,
    questionText: "Did you set financial goals for 2026?",
    questionType: "radio",
    options: { choices: ["Yes, detailed goals", "Yes, general goals", "Thinking about it", "No"] },
    required: true,
    displayOrder: 1,
  },
  {
    id: 40,
    surveyId: 13,
    questionText: "Which areas are you focusing on in 2026?",
    questionType: "checkbox",
    options: { choices: ["Saving More Money", "Reducing Debt", "Investing", "Starting a Business", "Learning New Skills", "Health & Fitness"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 41,
    surveyId: 13,
    questionText: "How confident are you about achieving your goals?",
    questionType: "rating",
    options: {
      min: 1,
      max: 5,
      labels: ["Not Confident", "Slightly", "Moderately", "Confident", "Very Confident"],
    },
    required: true,
    displayOrder: 3,
  },
  // Survey 14 questions (Completed — Onboarding Experience)
  {
    id: 42,
    surveyId: 14,
    questionText: "How easy was the sign-up process?",
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
    id: 43,
    surveyId: 14,
    questionText: "Which sign-up method did you use?",
    questionType: "radio",
    options: { choices: ["Email", "Phone Number", "Google Account", "Apple ID", "Facebook"] },
    required: true,
    displayOrder: 2,
  },
  {
    id: 44,
    surveyId: 14,
    questionText: "What parts of onboarding were most helpful?",
    questionType: "checkbox",
    options: { choices: ["Welcome Tutorial", "Feature Walkthrough", "First Reward Bonus", "Profile Setup Guide", "FAQ Section"] },
    required: true,
    displayOrder: 3,
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
  // ── Running Survey #6 ────────────────────────────────────────────────
  6: {
    id: 6,
    title: "Content Quality Assessment",
    description: "Rate the quality of videos, questions, and educational content available on our platform",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 21,
        questionText: "How would you rate the overall quality of our content?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
        },
      },
      {
        id: 22,
        questionText: "Which content types do you enjoy most?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Short Videos",
          "Educational Quizzes",
          "Polls & Surveys",
          "Live Streams",
          "Written Articles",
        ],
      },
      {
        id: 23,
        questionText: "How often do you watch video content on the platform?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Daily", "A few times a week", "Weekly", "Rarely", "Never"],
      },
      {
        id: 24,
        questionText: "What topics would you like to see more content about?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Suggest new content topics..." },
      },
    ],
  },

  // ── Upcoming / Scheduled Surveys ──────────────────────────────────────
  7: {
    id: 7,
    title: "Financial Literacy Survey",
    description: "Help us understand financial education needs in your community to create better learning content",
    rewardAmount: 2000,
    estimatedTime: 7,
    questions: [
      {
        id: 25,
        questionText: "How would you rate your understanding of personal finance?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Low", "Low", "Average", "Good", "Expert"],
        },
      },
      {
        id: 26,
        questionText: "Which financial topics interest you? (Select all that apply)",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Budgeting",
          "Saving & Investing",
          "Mobile Money Tips",
          "Loans & Credit",
          "Insurance",
          "Taxes",
        ],
      },
      {
        id: 27,
        questionText: "How do you prefer to learn about finances?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Short Videos", "Written Guides", "Interactive Quizzes", "Webinars", "One-on-one Coaching"],
      },
      {
        id: 28,
        questionText: "What is your biggest financial challenge right now?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Tell us about your challenge..." },
      },
    ],
  },
  8: {
    id: 8,
    title: "Community Engagement Survey",
    description: "Share your ideas on how we can build a stronger, more connected user community",
    rewardAmount: 2000,
    estimatedTime: 6,
    questions: [
      {
        id: 29,
        questionText: "How connected do you feel to the DelipuCash community?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Not at All", "Slightly", "Moderately", "Very", "Extremely"],
        },
      },
      {
        id: 30,
        questionText: "Which community features would you like to see?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Discussion Forums",
          "User Groups",
          "Community Challenges",
          "Leaderboards",
          "Mentorship Programs",
        ],
      },
      {
        id: 31,
        questionText: "How often would you participate in community events?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Daily", "Weekly", "Monthly", "Occasionally", "Never"],
      },
      {
        id: 32,
        questionText: "Describe your ideal community experience on our platform.",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Share your vision..." },
      },
    ],
  },
  9: {
    id: 9,
    title: "Platform Feature Wishlist",
    description: "Vote on and suggest new features you'd like to see in our next major update",
    rewardAmount: 2000,
    estimatedTime: 6,
    questions: [
      {
        id: 33,
        questionText: "How would you rate the current set of app features?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Lacking", "Lacking", "Adequate", "Good", "Excellent"],
        },
      },
      {
        id: 34,
        questionText: "Which upcoming features excite you most?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Dark Mode",
          "Offline Mode",
          "Voice Surveys",
          "Group Challenges",
          "Referral Bonuses",
          "In-app Messaging",
        ],
      },
      {
        id: 35,
        questionText: "What would make you use the app more frequently?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Higher Rewards", "Better Content", "Faster Performance", "More Social Features", "Fewer Ads"],
      },
      {
        id: 36,
        questionText: "Describe a feature you wish we had.",
        questionType: "text",
        required: true,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Your feature idea..." },
      },
    ],
  },
  10: {
    id: 10,
    title: "Advertising Preferences Survey",
    description: "Tell us about your ad preferences so we can show you more relevant and less intrusive ads",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 37,
        questionText: "How do you feel about seeing ads in the app?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Strongly Dislike", "Dislike", "Neutral", "Accept", "Don't Mind"],
        },
      },
      {
        id: 38,
        questionText: "Which ad formats are least disruptive to you?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Banner Ads",
          "Rewarded Video Ads",
          "Native Ads in Feed",
          "Interstitial Ads",
          "Sponsored Content",
        ],
      },
      {
        id: 39,
        questionText: "Would you watch a video ad in exchange for extra rewards?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["Yes, always", "Sometimes", "Rarely", "Never"],
      },
      {
        id: 40,
        questionText: "What types of ads would you find most useful or interesting?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "E.g., local businesses, tech products..." },
      },
    ],
  },

  // ── Completed Surveys ─────────────────────────────────────────────────
  11: {
    id: 11,
    title: "Beta Launch Feedback Survey",
    description: "Thank you for providing feedback during our beta launch phase! Your input shaped our product",
    rewardAmount: 2000,
    estimatedTime: 8,
    questions: [
      {
        id: 41,
        questionText: "Overall, how was your beta experience?",
        questionType: "rating",
        required: true,
        displayOrder: 1,
        options: {
          min: 1,
          max: 5,
          labels: ["Terrible", "Poor", "Okay", "Good", "Amazing"],
        },
      },
      {
        id: 42,
        questionText: "Which beta features worked well?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Account Creation",
          "Survey Completion",
          "Reward Withdrawal",
          "Video Watching",
          "Push Notifications",
        ],
      },
      {
        id: 43,
        questionText: "Did you encounter any major bugs?",
        questionType: "radio",
        required: true,
        displayOrder: 3,
        options: ["No bugs at all", "Minor bugs only", "Some significant bugs", "Many bugs", "App was unusable"],
      },
      {
        id: 44,
        questionText: "Any final thoughts on the beta experience?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Thank you for your beta feedback..." },
      },
    ],
  },
  12: {
    id: 12,
    title: "Holiday Season Shopping Survey",
    description: "This survey helped us understand holiday spending habits and shopping preferences",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 45,
        questionText: "How much did you spend during the holiday season?",
        questionType: "radio",
        required: true,
        displayOrder: 1,
        options: ["Less than UGX 50,000", "UGX 50,000 – 200,000", "UGX 200,000 – 500,000", "UGX 500,000 – 1,000,000", "Over UGX 1,000,000"],
      },
      {
        id: 46,
        questionText: "What did you shop for? (Select all that apply)",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Clothing & Fashion",
          "Electronics",
          "Food & Groceries",
          "Gifts for Others",
          "Travel & Entertainment",
          "Home & Decor",
        ],
      },
      {
        id: 47,
        questionText: "Rate your holiday shopping experience overall.",
        questionType: "rating",
        required: true,
        displayOrder: 3,
        options: {
          min: 1,
          max: 5,
          labels: ["Very Stressful", "Stressful", "Neutral", "Enjoyable", "Very Enjoyable"],
        },
      },
      {
        id: 48,
        questionText: "How could retailers improve your holiday shopping experience?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Share improvement ideas..." },
      },
    ],
  },
  13: {
    id: 13,
    title: "New Year Resolutions Survey",
    description: "We gathered insights about user goals and resolutions to improve our services in 2026",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 49,
        questionText: "Did you set financial goals for 2026?",
        questionType: "radio",
        required: true,
        displayOrder: 1,
        options: ["Yes, detailed goals", "Yes, general goals", "Thinking about it", "No"],
      },
      {
        id: 50,
        questionText: "Which areas are you focusing on in 2026?",
        questionType: "checkbox",
        required: true,
        displayOrder: 2,
        options: [
          "Saving More Money",
          "Reducing Debt",
          "Investing",
          "Starting a Business",
          "Learning New Skills",
          "Health & Fitness",
        ],
      },
      {
        id: 51,
        questionText: "How confident are you about achieving your goals?",
        questionType: "rating",
        required: true,
        displayOrder: 3,
        options: {
          min: 1,
          max: 5,
          labels: ["Not Confident", "Slightly", "Moderately", "Confident", "Very Confident"],
        },
      },
      {
        id: 52,
        questionText: "How can our app help you achieve your 2026 goals?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Tell us how we can help..." },
      },
    ],
  },
  14: {
    id: 14,
    title: "App Onboarding Experience Survey",
    description: "User feedback on the sign-up and onboarding flow helped us simplify the process",
    rewardAmount: 2000,
    estimatedTime: 5,
    questions: [
      {
        id: 53,
        questionText: "How easy was the sign-up process?",
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
        id: 54,
        questionText: "Which sign-up method did you use?",
        questionType: "radio",
        required: true,
        displayOrder: 2,
        options: ["Email", "Phone Number", "Google Account", "Apple ID", "Facebook"],
      },
      {
        id: 55,
        questionText: "What parts of onboarding were most helpful?",
        questionType: "checkbox",
        required: true,
        displayOrder: 3,
        options: [
          "Welcome Tutorial",
          "Feature Walkthrough",
          "First Reward Bonus",
          "Profile Setup Guide",
          "FAQ Section",
        ],
      },
      {
        id: 56,
        questionText: "How could we improve the first-time user experience?",
        questionType: "text",
        required: false,
        displayOrder: 4,
        options: { multiline: true, placeholder: "Your suggestions..." },
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
