/**
 * Quiz Session API and Hooks
 * Handles quiz question fetching, answer submission, points management, and reward redemption
 * REST API integration - No mock data fallbacks
 */

import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { 
  QuizQuestion, 
  QuizSession, 
  UserPoints,
  RewardRedemptionRequest,
  RewardRedemptionResult,
  PaymentStatus,
} from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

// Validate that API URL is configured
if (!API_BASE_URL) {
  console.warn('[QuizAPI] EXPO_PUBLIC_API_URL is not configured. API calls will fail.');
}

// ===========================================
// API Functions
// ===========================================

/**
 * Fetch uploaded questions for quiz session
 */
async function fetchQuizQuestions(limit: number = 10, category?: string): Promise<QuizQuestion[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category) params.append('category', category);

  const response = await fetch(`${API_BASE_URL}/api/quiz/questions?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch quiz questions');
  }

  const data = await response.json();

  // Check if we got valid data
  const questions = data.questions || data;
  if (!Array.isArray(questions)) {
    return [];
  }

  // Transform to QuizQuestion format
  return questions.map((q: Record<string, unknown>): QuizQuestion => ({
    id: String(q.id || ''),
    text: String(q.text || q.question || ''),
    options: q.options as Record<string, string> | string[] | undefined,
    correctAnswer: (q.correctAnswer || q.answer) as string | string[],
    explanation: q.explanation as string | undefined,
    category: q.category as string | undefined,
    difficulty: (q.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
    pointValue: Number(q.pointValue || q.rewardAmount || 10),
    timeLimit: Number(q.timeLimit || 90),
    type: determineQuestionType(q.options),
  }));
}

/**
 * Determine question type from options
 */
function determineQuestionType(options: unknown): QuizQuestion['type'] {
  if (!options) return 'text';
  
  const optionArray = Array.isArray(options) ? options : Object.values(options as object);
  
  if (optionArray.length === 2) {
    const normalized = optionArray.map(o => String(o).toLowerCase());
    if (
      (normalized.includes('true') && normalized.includes('false')) ||
      (normalized.includes('yes') && normalized.includes('no'))
    ) {
      return 'boolean';
    }
  }
  
  return 'single_choice';
}

/**
 * Get user's current points
 */
async function fetchUserPoints(userId: string): Promise<UserPoints> {
  const response = await fetch(`${API_BASE_URL}/api/quiz/points/${userId}`);
  
  if (!response.ok) {
    // Return default if endpoint not available
    return {
      userId,
      totalPoints: 0,
      availablePoints: 0,
      redeemedPoints: 0,
      pendingRedemption: 0,
    };
  }
  
  return response.json();
}

/**
 * Update user's points after quiz session
 */
async function updateUserPoints(userId: string, pointsToAdd: number, sessionId: string): Promise<UserPoints> {
  const response = await fetch(`${API_BASE_URL}/api/quiz/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      points: pointsToAdd,
      sessionId,
      source: 'quiz_session',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update points');
  }
  
  return response.json();
}

/**
 * Save quiz session to database
 */
async function saveQuizSession(session: Partial<QuizSession>): Promise<QuizSession> {
  const response = await fetch(`${API_BASE_URL}/api/quiz/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
  
  if (!response.ok) {
    throw new Error('Failed to save quiz session');
  }
  
  return response.json();
}

/**
 * Redeem points for cash or airtime
 */
async function redeemReward(request: RewardRedemptionRequest): Promise<RewardRedemptionResult> {
  const response = await fetch(`${API_BASE_URL}/api/quiz/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to redeem reward');
  }
  
  return response.json();
}

/**
 * Initiate cash disbursement via Mobile Money
 */
async function initiateDisbursement(
  userId: string,
  amount: number,
  phoneNumber: string,
  provider: 'MTN' | 'AIRTEL'
): Promise<{ success: boolean; reference: string; status: PaymentStatus }> {
  const response = await fetch(`${API_BASE_URL}/api/quiz/disburse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      amount,
      phoneNumber,
      provider,
      reason: 'Quiz rewards redemption',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to initiate disbursement');
  }
  
  return response.json();
}

// ===========================================
// Query Keys
// ===========================================

export const quizQueryKeys = {
  questions: (limit?: number, category?: string) => ['quiz', 'questions', limit, category] as const,
  userPoints: (userId: string) => ['user', 'points', userId] as const,
  session: (sessionId: string) => ['quiz', 'session', sessionId] as const,
  sessions: (userId: string) => ['quiz', 'sessions', userId] as const,
};

// ===========================================
// React Query Hooks
// ===========================================

/**
 * Hook to fetch quiz questions
 */
export function useQuizQuestions(
  limit: number = 10, 
  category?: string,
  enabled: boolean = true
): UseQueryResult<QuizQuestion[], Error> {
  return useQuery({
    queryKey: quizQueryKeys.questions(limit, category),
    queryFn: () => fetchQuizQuestions(limit, category),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch user's points
 */
export function useUserPoints(userId: string): UseQueryResult<UserPoints, Error> {
  return useQuery({
    queryKey: quizQueryKeys.userPoints(userId),
    queryFn: () => fetchUserPoints(userId),
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to update user's points
 */
export function useUpdatePoints(): UseMutationResult<
  UserPoints, 
  Error, 
  { userId: string; pointsToAdd: number; sessionId: string }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, pointsToAdd, sessionId }) => 
      updateUserPoints(userId, pointsToAdd, sessionId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(quizQueryKeys.userPoints(variables.userId), data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

/**
 * Hook to save quiz session
 */
export function useSaveQuizSession(): UseMutationResult<QuizSession, Error, Partial<QuizSession>> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveQuizSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.sessions(data.userId) });
    },
  });
}

/**
 * Hook to redeem rewards
 */
export function useRedeemReward(): UseMutationResult<RewardRedemptionResult, Error, RewardRedemptionRequest> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: redeemReward,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.userPoints(variables.userId) });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook to initiate cash disbursement
 */
export function useInitiateDisbursement(): UseMutationResult<
  { success: boolean; reference: string; status: PaymentStatus },
  Error,
  { userId: string; amount: number; phoneNumber: string; provider: 'MTN' | 'AIRTEL' }
> {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, amount, phoneNumber, provider }) => 
      initiateDisbursement(userId, amount, phoneNumber, provider),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.userPoints(variables.userId) });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// ===========================================
// Points Conversion Utilities
// ===========================================

/**
 * Minimum points required for redemption
 */
export const MIN_REDEMPTION_POINTS = 50;

/**
 * Points to UGX conversion rate
 */
export const POINTS_TO_UGX_RATE = 100; // 1 point = 100 UGX

/**
 * Convert points to cash value (UGX)
 */
export function pointsToCash(points: number): number {
  return points * POINTS_TO_UGX_RATE;
}

/**
 * Convert cash (UGX) to points
 */
export function cashToPoints(ugx: number): number {
  return Math.floor(ugx / POINTS_TO_UGX_RATE);
}

/**
 * Check if user can redeem
 */
export function canRedeem(availablePoints: number): boolean {
  return availablePoints >= MIN_REDEMPTION_POINTS;
}

/**
 * Get redemption options based on available points
 */
export function getRedemptionOptions(availablePoints: number): {
  points: number;
  cashValue: number;
  label: string;
}[] {
  const options = [50, 100, 200, 500, 1000];
  
  return options
    .filter(pts => pts <= availablePoints)
    .map(pts => ({
      points: pts,
      cashValue: pointsToCash(pts),
      label: `${pts} points = UGX ${pointsToCash(pts).toLocaleString()}`,
    }));
}
