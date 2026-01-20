// Mobile App API Configuration
export const MOBILE_API_CONFIG = {
  // Base URL for your deployed backend
  BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-app.vercel.app' 
    : 'http://localhost:3000',
  
  // API endpoints
  ENDPOINTS: {
    // Authentication
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
    },
    
    // User management
    USERS: {
      PROFILE: '/api/users/profile',
      UPDATE: '/api/users/update',
      DELETE: '/api/users/delete',
    },
    
    // Rewards
    REWARDS: {
      LIST: '/api/rewards',
      CLAIM: '/api/rewards/claim',
      HISTORY: '/api/rewards/history',
    },
    
    // Questions
    QUESTIONS: {
      LIST: '/api/questions',
      ANSWER: '/api/questions/answer',
      ATTEMPTS: '/api/attempts',
    },
    
    // Surveys
    SURVEYS: {
      LIST: '/api/surveys',
      SUBMIT: '/api/surveys/submit',
      RESULTS: '/api/surveys/results',
    },
    
    // Payments
    PAYMENTS: {
      PROCESS: '/api/payments/process',
      HISTORY: '/api/payments/history',
      METHODS: '/api/payments/methods',
    },
    
    // Videos
    VIDEOS: {
      LIST: '/api/videos',
      WATCH: '/api/videos/watch',
      UPLOAD: '/api/videos/upload',
    },
    
    // Ads
    ADS: {
      LIST: '/api/ads',
      VIEW: '/api/ads/view',
      CLICK: '/api/ads/click',
    },
    
    // Explore
    EXPLORE: {
      CONTENT: '/api/explore',
      TRENDING: '/api/explore/trending',
    },
    
    // Notifications
    NOTIFICATIONS: {
      LIST: '/api/notifications',
      MARK_READ: '/api/notifications/read',
      SETTINGS: '/api/notifications/settings',
    },
    
    // Health
    HEALTH: '/health',
    PING: '/ping',
  },
  
  // Request configuration
  REQUEST_CONFIG: {
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
  
  // Error codes
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',
  },
};

// Helper function to build full URL
export const buildApiUrl = (endpoint) => {
  return `${MOBILE_API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function for mobile app requests
export const createApiRequest = (endpoint, options = {}) => {
  return {
    url: buildApiUrl(endpoint),
    ...MOBILE_API_CONFIG.REQUEST_CONFIG,
    ...options,
  };
};

export default MOBILE_API_CONFIG;
