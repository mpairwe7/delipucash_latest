/**
 * Support API Service
 * Mock REST API for help & support functionality
 * Design System Compliant - Consistent patterns and error handling
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
}

export type FAQCategory = 
  | 'payments' 
  | 'rewards' 
  | 'surveys' 
  | 'account' 
  | 'technical' 
  | 'general';

export interface ContactMethod {
  id: string;
  type: 'email' | 'phone' | 'whatsapp' | 'chat';
  label: string;
  value: string;
  available: boolean;
  workingHours?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: FAQCategory;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  responses: TicketResponse[];
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  message: string;
  isStaff: boolean;
  createdAt: string;
  attachments?: string[];
}

export interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  gradient: [string, string];
  action: string;
  enabled: boolean;
}

export interface FeedbackSubmission {
  rating: number;
  comment: string;
  category: 'app' | 'support' | 'feature' | 'bug';
  userId?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: string;
  category: string;
  thumbnail?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_FAQ_DATA: FAQItem[] = [
  {
    id: 'faq_1',
    question: 'How do I receive payments?',
    answer: 'To receive payments, go to your Profile > Payments section and set up your preferred mobile money account (MTN or Airtel). Once set up, all your earnings will be automatically transferred to your mobile money account within 24-48 hours after processing.',
    category: 'payments',
    helpful: 245,
    notHelpful: 12,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'faq_2',
    question: 'How long does it take to receive rewards?',
    answer: 'Rewards are typically processed within 24-48 hours. Mobile money transfers are usually instant once processed. You\'ll receive a push notification when your payment is sent. If you haven\'t received payment after 48 hours, please contact support.',
    category: 'rewards',
    helpful: 189,
    notHelpful: 8,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'faq_3',
    question: 'How do I complete surveys?',
    answer: 'Navigate to the Surveys tab, select an available survey, and answer all questions honestly. Make sure to complete the entire survey to receive your reward. Incomplete surveys won\'t be rewarded. Each survey has a time limit, so please complete them in one session.',
    category: 'surveys',
    helpful: 312,
    notHelpful: 15,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-12T00:00:00Z',
  },
  {
    id: 'faq_4',
    question: 'Can I change my payment method?',
    answer: 'Yes, you can change your payment method anytime from the Profile > Payments section. You can switch between MTN Mobile Money and Airtel Money as needed. Changes take effect immediately for future payments.',
    category: 'payments',
    helpful: 156,
    notHelpful: 5,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-14T00:00:00Z',
  },
  {
    id: 'faq_5',
    question: 'How do I reset my password?',
    answer: 'Go to Profile > Security > Change Password. Enter your current password, then your new password (minimum 8 characters with at least one uppercase, one number, and one special character). You\'ll receive a confirmation email once changed.',
    category: 'account',
    helpful: 203,
    notHelpful: 18,
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-11T00:00:00Z',
  },
  {
    id: 'faq_6',
    question: 'What if I don\'t receive my payment?',
    answer: 'If you don\'t receive your payment within 48 hours: 1) Check your mobile money account is active, 2) Verify your phone number is correct in settings, 3) Contact support with your transaction ID. Our team will investigate and resolve within 24 hours.',
    category: 'payments',
    helpful: 278,
    notHelpful: 22,
    createdAt: '2025-01-04T00:00:00Z',
    updatedAt: '2025-01-16T00:00:00Z',
  },
  {
    id: 'faq_7',
    question: 'How do I enable two-factor authentication?',
    answer: 'Go to Profile > Security > Two-Factor Authentication and toggle it on. You can choose between SMS verification or authenticator app (Google Authenticator/Authy). We recommend using an authenticator app for better security.',
    category: 'account',
    helpful: 167,
    notHelpful: 9,
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-13T00:00:00Z',
  },
  {
    id: 'faq_8',
    question: 'Why was my survey rejected?',
    answer: 'Surveys may be rejected if: 1) Answers are inconsistent or contradictory, 2) Survey was completed too quickly (speeders), 3) You didn\'t meet the target demographic, 4) Duplicate responses detected. Take your time and provide honest, thoughtful responses.',
    category: 'surveys',
    helpful: 234,
    notHelpful: 31,
    createdAt: '2025-01-06T00:00:00Z',
    updatedAt: '2025-01-17T00:00:00Z',
  },
  {
    id: 'faq_9',
    question: 'How do I contact customer support?',
    answer: 'You can reach our support team via: 1) In-app chat (24/7), 2) Email at support@delipucash.com, 3) WhatsApp at +256773336896, 4) Phone at +256773336896 (9am-6pm EAT). Average response time is under 2 hours.',
    category: 'general',
    helpful: 145,
    notHelpful: 6,
    createdAt: '2025-01-07T00:00:00Z',
    updatedAt: '2025-01-18T00:00:00Z',
  },
  {
    id: 'faq_10',
    question: 'The app is crashing, what should I do?',
    answer: 'Try these steps: 1) Force close and restart the app, 2) Clear app cache (Settings > Apps > DelipuCash > Clear Cache), 3) Update to the latest version, 4) Restart your device. If the issue persists, contact support with your device model and OS version.',
    category: 'technical',
    helpful: 189,
    notHelpful: 14,
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-19T00:00:00Z',
  },
];

const MOCK_CONTACT_METHODS: ContactMethod[] = [
  {
    id: 'contact_1',
    type: 'email',
    label: 'Email Support',
    value: 'mpairwelauben75@gmail.com',
    available: true,
    workingHours: '24/7 - Response within 2 hours',
  },
  {
    id: 'contact_2',
    type: 'whatsapp',
    label: 'WhatsApp Chat',
    value: '+256773336896',
    available: true,
    workingHours: '24/7 - Instant responses',
  },
  {
    id: 'contact_3',
    type: 'phone',
    label: 'Phone Support',
    value: '+256773336896',
    available: true,
    workingHours: '9:00 AM - 6:00 PM EAT',
  },
  {
    id: 'contact_4',
    type: 'chat',
    label: 'Live Chat',
    value: 'in-app',
    available: true,
    workingHours: '24/7 - AI + Human agents',
  },
];

const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'action_1',
    title: 'Payment Setup',
    subtitle: 'Configure your payment methods',
    icon: 'credit-card',
    color: '#FFC107',
    gradient: ['#FFC107', '#FF8F00'],
    action: 'payment_setup',
    enabled: true,
  },
  {
    id: 'action_2',
    title: 'Video Tutorials',
    subtitle: 'Learn how to use the app',
    icon: 'play-circle',
    color: '#2196F3',
    gradient: ['#2196F3', '#1976D2'],
    action: 'tutorials',
    enabled: true,
  },
  {
    id: 'action_3',
    title: 'Send Feedback',
    subtitle: 'Help us improve the app',
    icon: 'message-text',
    color: '#4CAF50',
    gradient: ['#4CAF50', '#388E3C'],
    action: 'feedback',
    enabled: true,
  },
  {
    id: 'action_4',
    title: 'Report Bug',
    subtitle: 'Found an issue? Let us know',
    icon: 'bug',
    color: '#FF5722',
    gradient: ['#FF5722', '#E64A19'],
    action: 'report_bug',
    enabled: true,
  },
];

const MOCK_TUTORIALS: Tutorial[] = [
  {
    id: 'tutorial_1',
    title: 'Getting Started',
    description: 'Learn the basics of using DelipuCash',
    duration: '3:45',
    category: 'basics',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
  },
  {
    id: 'tutorial_2',
    title: 'Completing Surveys',
    description: 'Tips for successful survey completion',
    duration: '5:20',
    category: 'surveys',
    thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400',
  },
  {
    id: 'tutorial_3',
    title: 'Setting Up Payments',
    description: 'Link your mobile money account',
    duration: '4:15',
    category: 'payments',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
  },
  {
    id: 'tutorial_4',
    title: 'Security Features',
    description: 'Keep your account safe',
    duration: '6:00',
    category: 'security',
    thumbnail: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400',
  },
];

// ============================================================================
// API SIMULATION HELPERS
// ============================================================================

const simulateNetworkDelay = (ms: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const simulateApiResponse = <T>(data: T, delay: number = 500): Promise<T> => {
  return simulateNetworkDelay(delay).then(() => data);
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch all FAQ items
 */
export const fetchFAQs = async (category?: FAQCategory): Promise<FAQItem[]> => {
  console.log('[SupportAPI] Fetching FAQs', category ? `for category: ${category}` : '');
  
  await simulateNetworkDelay(300);
  
  if (category) {
    return MOCK_FAQ_DATA.filter(faq => faq.category === category);
  }
  
  return MOCK_FAQ_DATA;
};

/**
 * Search FAQs by query
 */
export const searchFAQs = async (query: string): Promise<FAQItem[]> => {
  console.log('[SupportAPI] Searching FAQs for:', query);
  
  await simulateNetworkDelay(200);
  
  const lowerQuery = query.toLowerCase();
  return MOCK_FAQ_DATA.filter(
    faq => 
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Mark FAQ as helpful or not helpful
 */
export const rateFAQ = async (
  faqId: string, 
  helpful: boolean
): Promise<{ success: boolean; message: string }> => {
  console.log('[SupportAPI] Rating FAQ:', faqId, helpful ? 'helpful' : 'not helpful');
  
  await simulateNetworkDelay(200);
  
  return {
    success: true,
    message: helpful ? 'Thank you for your feedback!' : 'We\'ll work on improving this answer.',
  };
};

/**
 * Fetch contact methods
 */
export const fetchContactMethods = async (): Promise<ContactMethod[]> => {
  console.log('[SupportAPI] Fetching contact methods');
  return simulateApiResponse(MOCK_CONTACT_METHODS, 200);
};

/**
 * Fetch quick actions
 */
export const fetchQuickActions = async (): Promise<QuickAction[]> => {
  console.log('[SupportAPI] Fetching quick actions');
  return simulateApiResponse(MOCK_QUICK_ACTIONS, 200);
};

/**
 * Fetch tutorials
 */
export const fetchTutorials = async (category?: string): Promise<Tutorial[]> => {
  console.log('[SupportAPI] Fetching tutorials', category ? `for category: ${category}` : '');
  
  await simulateNetworkDelay(300);
  
  if (category) {
    return MOCK_TUTORIALS.filter(t => t.category === category);
  }
  
  return MOCK_TUTORIALS;
};

/**
 * Submit support ticket
 */
export const submitSupportTicket = async (
  data: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'responses'>
): Promise<SupportTicket> => {
  console.log('[SupportAPI] Submitting support ticket:', data.subject);
  
  await simulateNetworkDelay(800);
  
  const ticket: SupportTicket = {
    ...data,
    id: `ticket_${Date.now()}`,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    responses: [],
  };
  
  return ticket;
};

/**
 * Submit feedback
 */
export const submitFeedback = async (
  feedback: FeedbackSubmission
): Promise<{ success: boolean; message: string; ticketId?: string }> => {
  console.log('[SupportAPI] Submitting feedback:', feedback.category, feedback.rating);
  
  await simulateNetworkDelay(600);
  
  return {
    success: true,
    message: 'Thank you for your feedback! We appreciate you helping us improve.',
    ticketId: `feedback_${Date.now()}`,
  };
};

/**
 * Get FAQ categories with counts
 */
export const getFAQCategories = async (): Promise<{ category: FAQCategory; count: number }[]> => {
  console.log('[SupportAPI] Fetching FAQ categories');
  
  await simulateNetworkDelay(200);
  
  const categories: FAQCategory[] = ['payments', 'rewards', 'surveys', 'account', 'technical', 'general'];
  
  return categories.map(category => ({
    category,
    count: MOCK_FAQ_DATA.filter(faq => faq.category === category).length,
  }));
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  fetchFAQs,
  searchFAQs,
  rateFAQ,
  fetchContactMethods,
  fetchQuickActions,
  fetchTutorials,
  submitSupportTicket,
  submitFeedback,
  getFAQCategories,
};
