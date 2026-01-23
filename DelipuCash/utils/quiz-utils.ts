/**
 * Quiz Utilities
 * - Levenshtein distance for fuzzy matching
 * - Haptic feedback
 * - Timer utilities
 * - Accessibility helpers
 */

import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

// ===========================================
// Levenshtein Distance - Fuzzy Answer Matching
// ===========================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of text answers (tolerates typos)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100 where 100 is exact match
 */
export function stringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Check if answer is correct with fuzzy matching
 * @param userAnswer - User's submitted answer
 * @param correctAnswer - The correct answer
 * @param threshold - Minimum similarity percentage (default 80%)
 */
export function isFuzzyMatch(
  userAnswer: string, 
  correctAnswer: string, 
  threshold: number = 80
): { isCorrect: boolean; similarity: number } {
  const similarity = stringSimilarity(userAnswer, correctAnswer);
  return {
    isCorrect: similarity >= threshold,
    similarity,
  };
}

/**
 * Check multiple correct answers with fuzzy matching
 */
export function checkMultipleAnswers(
  userAnswer: string,
  correctAnswers: string[],
  threshold: number = 80
): { isCorrect: boolean; bestMatch: string | null; similarity: number } {
  let bestSimilarity = 0;
  let bestMatch: string | null = null;

  for (const correct of correctAnswers) {
    const similarity = stringSimilarity(userAnswer, correct);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = correct;
    }
  }

  return {
    isCorrect: bestSimilarity >= threshold,
    bestMatch,
    similarity: bestSimilarity,
  };
}

// ===========================================
// Haptic Feedback
// ===========================================

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

/**
 * Trigger haptic feedback
 * Works on iOS and Android
 */
export async function triggerHaptic(type: HapticType = 'light'): Promise<void> {
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
    }
  } catch (error) {
    // Haptics may not be available on all devices
    console.debug('Haptics not available:', error);
  }
}

// ===========================================
// Timer Utilities
// ===========================================

/**
 * Format seconds to MM:SS display
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate timer color based on remaining time
 */
export function getTimerColor(
  remainingSeconds: number, 
  totalSeconds: number,
  colors: { success: string; warning: string; error: string }
): string {
  const percentage = (remainingSeconds / totalSeconds) * 100;
  
  if (percentage > 50) return colors.success;
  if (percentage > 25) return colors.warning;
  return colors.error;
}

// ===========================================
// Accessibility Helpers
// ===========================================

/**
 * Announce message for screen readers
 */
export function announceForAccessibility(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Get accessible label for question
 */
export function getQuestionAccessibilityLabel(
  questionNumber: number,
  totalQuestions: number,
  questionText: string
): string {
  return `Question ${questionNumber} of ${totalQuestions}. ${questionText}`;
}

/**
 * Get accessible label for answer result
 */
export function getResultAccessibilityLabel(
  isCorrect: boolean,
  pointsEarned: number,
  streak: number
): string {
  if (isCorrect) {
    return `Correct! You earned ${pointsEarned} points. Current streak: ${streak}`;
  }
  return `Incorrect. The streak has been reset.`;
}

// ===========================================
// Points Calculation
// ===========================================

/**
 * Calculate points earned for correct answer
 * @param basePoints - Base points per question
 * @param streak - Current streak count
 * @param timeBonus - Time remaining as percentage (0-100)
 */
export function calculatePoints(
  basePoints: number,
  streak: number,
  timeBonus: number = 100
): number {
  // Streak multiplier: 1x, 1.5x, 2x, 2.5x, 3x (max)
  const streakMultiplier = Math.min(1 + (streak * 0.5), 3);
  
  // Time bonus: 0-50% extra points
  const timeBonusMultiplier = 1 + (timeBonus / 200);
  
  return Math.round(basePoints * streakMultiplier * timeBonusMultiplier);
}

/**
 * Calculate streak bonus points
 */
export function getStreakBonus(streak: number): number {
  if (streak < 3) return 0;
  if (streak < 5) return 5;
  if (streak < 10) return 10;
  if (streak < 20) return 25;
  return 50;
}

// ===========================================
// Question Type Helpers
// ===========================================

export type QuestionType = 'multiple_choice' | 'single_choice' | 'boolean' | 'text' | 'checkbox' | 'numeric';

/**
 * Boolean answer mappings for flexible validation
 */
const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y', '1', 'correct', 'right', 'si', 'oui', 'ja'];
const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n', '0', 'incorrect', 'wrong', 'non', 'nein'];

/**
 * Normalize text for comparison
 * Industry-standard text normalization:
 * - Lowercase
 * - Remove accents/diacritics
 * - Remove special characters (keep alphanumeric and spaces)
 * - Trim whitespace
 * - Remove extra spaces
 * - Handle common typos and abbreviations
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .trim()
    // Remove accents/diacritics (é → e, ñ → n, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special characters except spaces
    .replace(/[^\w\s]/g, '')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize numeric text for comparison
 * Handles various number formats:
 * - "1,000" → 1000
 * - "1 000" → 1000
 * - "3.14" → 3.14
 * - "$100" → 100
 * - "100%" → 100
 */
export function normalizeNumeric(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  
  // Remove currency symbols, percentage signs, and common prefixes/suffixes
  const cleaned = text
    .replace(/[$€£¥₹%]/g, '')
    .replace(/\s/g, '') // Remove all whitespace
    .replace(/,/g, '') // Remove commas (thousand separators)
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Check if a string represents a number
 */
export function isNumericString(text: string): boolean {
  return normalizeNumeric(text) !== null;
}

/**
 * Compare two numbers with tolerance
 * @param num1 - First number
 * @param num2 - Second number  
 * @param tolerance - Allowed difference (default 0.01 for 1% tolerance)
 */
export function compareNumbers(num1: number, num2: number, tolerance: number = 0.01): boolean {
  if (num1 === num2) return true;
  
  // Handle zero case
  if (num1 === 0 || num2 === 0) {
    return Math.abs(num1 - num2) <= tolerance;
  }
  
  // Relative tolerance check
  const diff = Math.abs(num1 - num2);
  const avg = (Math.abs(num1) + Math.abs(num2)) / 2;
  return diff / avg <= tolerance;
}

/**
 * Determine question type from question data
 * Analyzes options to identify:
 * - boolean (true/false, yes/no)
 * - numeric (all options are numbers)
 * - single_choice (default for options)
 * - text (no options provided)
 */
export function getQuestionType(
  options: Record<string, unknown> | string[] | null | undefined,
  correctAnswer?: string | string[]
): QuestionType {
  if (!options) {
    // If no options, check if correct answer is numeric
    if (correctAnswer && isNumericString(String(correctAnswer))) {
      return 'numeric';
    }
    return 'text';
  }
  
  const optionArray = Array.isArray(options) ? options : Object.values(options);
  
  // Check for boolean type (2 options: true/false, yes/no)
  if (optionArray.length === 2) {
    const normalized = optionArray.map(o => normalizeText(String(o)));
    const isBooleanType = 
      BOOLEAN_TRUE_VALUES.some(v => normalized.includes(v)) &&
      BOOLEAN_FALSE_VALUES.some(v => normalized.includes(v));
    
    if (isBooleanType) {
      return 'boolean';
    }
  }
  
  // Check if all options are numeric
  const allNumeric = optionArray.every(o => isNumericString(String(o)));
  if (allNumeric) {
    return 'numeric';
  }
  
  return 'single_choice';
}

/**
 * Normalize boolean answer to standard true/false
 */
export function normalizeBooleanAnswer(answer: string): 'true' | 'false' | null {
  const normalized = normalizeText(answer);
  
  if (BOOLEAN_TRUE_VALUES.includes(normalized)) return 'true';
  if (BOOLEAN_FALSE_VALUES.includes(normalized)) return 'false';
  
  return null;
}

/**
 * Validate answer result interface
 */
export interface AnswerValidationResult {
  isCorrect: boolean;
  feedback: string;
  similarity?: number;
  matchedAnswer?: string;
  partialCredit?: number; // For checkbox with some correct
}

/**
 * Validate answer based on question type
 * Comprehensive validation supporting all answer formats
 */
export function validateAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[],
  questionType: QuestionType,
  fuzzyThreshold: number = 80
): AnswerValidationResult {
  // Handle empty answers
  if (userAnswer === null || userAnswer === undefined || 
      (typeof userAnswer === 'string' && !userAnswer.trim()) ||
      (Array.isArray(userAnswer) && userAnswer.length === 0)) {
    return {
      isCorrect: false,
      feedback: 'No answer provided.',
    };
  }

  switch (questionType) {
    case 'text':
      return validateTextAnswer(userAnswer, correctAnswer, fuzzyThreshold);
    
    case 'numeric':
      return validateNumericAnswer(userAnswer, correctAnswer);
    
    case 'boolean':
      return validateBooleanAnswer(userAnswer, correctAnswer);
    
    case 'single_choice':
      return validateSingleChoiceAnswer(userAnswer, correctAnswer, fuzzyThreshold);
    
    case 'checkbox':
    case 'multiple_choice':
      return validateMultipleChoiceAnswer(userAnswer, correctAnswer, fuzzyThreshold);
    
    default:
      return { isCorrect: false, feedback: 'Unknown question type' };
  }
}

/**
 * Validate numeric answers with tolerance
 * Handles various number formats and allows small differences
 */
function validateNumericAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[],
  tolerance: number = 0.01
): AnswerValidationResult {
  const userNum = normalizeNumeric(String(userAnswer));
  
  if (userNum === null) {
    return {
      isCorrect: false,
      feedback: 'Please enter a valid number.',
    };
  }

  // Handle multiple correct answers (ranges)
  const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  
  for (const correct of correctAnswers) {
    const correctNum = normalizeNumeric(String(correct));
    if (correctNum !== null && compareNumbers(userNum, correctNum, tolerance)) {
      return {
        isCorrect: true,
        feedback: userNum === correctNum ? 'Exactly right!' : 'Close enough!',
        similarity: 100,
      };
    }
  }

  const firstCorrect = normalizeNumeric(String(correctAnswers[0]));
  return {
    isCorrect: false,
    feedback: `The correct answer was: ${firstCorrect ?? correctAnswers[0]}`,
    similarity: 0,
  };
}

/**
 * Validate text/input answers with fuzzy matching
 * Industry-standard features:
 * - Case insensitive
 * - Ignores punctuation
 * - Tolerates typos via Levenshtein distance
 * - Auto-detects numeric answers
 */
function validateTextAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[],
  threshold: number
): AnswerValidationResult {
  const userText = String(userAnswer);
  const userNormalized = normalizeText(userText);
  
  // Auto-detect numeric answers
  const correctAnswers = Array.isArray(correctAnswer) 
    ? correctAnswer.map(a => String(a))
    : [String(correctAnswer)];
  
  // Check if this might be a numeric question
  const isUserNumeric = isNumericString(userText);
  const isCorrectNumeric = correctAnswers.every(a => isNumericString(a));
  
  if (isUserNumeric && isCorrectNumeric) {
    return validateNumericAnswer(userAnswer, correctAnswer);
  }
  
  // Normalize correct answers for comparison
  const normalizedCorrectAnswers = correctAnswers.map(a => normalizeText(a));

  // Check for exact match first (most efficient)
  if (normalizedCorrectAnswers.includes(userNormalized)) {
    return {
      isCorrect: true,
      feedback: 'Perfect!',
      similarity: 100,
      matchedAnswer: userNormalized,
    };
  }

  // Find best fuzzy match
  let bestSimilarity = 0;
  let bestMatch = '';
  
  for (const correct of normalizedCorrectAnswers) {
    const similarity = stringSimilarity(userText, correct);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = correct;
    }
  }

  const isCorrect = bestSimilarity >= threshold;

  return {
    isCorrect,
    similarity: bestSimilarity,
    matchedAnswer: bestMatch,
    feedback: isCorrect
      ? bestSimilarity === 100
        ? 'Perfect match!'
        : `Close enough! (${bestSimilarity}% match)`
      : `Not quite. The answer was: ${correctAnswers[0]}`,
  };
}

/**
 * Validate boolean (true/false, yes/no) answers
 */
function validateBooleanAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[]
): AnswerValidationResult {
  const userNormalized = normalizeBooleanAnswer(String(userAnswer));
  const correctNormalized = normalizeBooleanAnswer(String(correctAnswer));

  if (userNormalized === null) {
    return {
      isCorrect: false,
      feedback: 'Invalid boolean answer. Please answer True or False.',
    };
  }

  const isCorrect = userNormalized === correctNormalized;

  return {
    isCorrect,
    feedback: isCorrect
      ? 'Correct!'
      : `The correct answer was: ${correctNormalized === 'true' ? 'True' : 'False'}`,
  };
}

/**
 * Validate single choice (radio) answers
 * Industry-standard features:
 * - Supports option IDs (a, b, c, d) or full text
 * - Case insensitive matching
 * - Handles option index (0, 1, 2, 3)
 */
function validateSingleChoiceAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[],
  threshold: number
): AnswerValidationResult {
  const userText = normalizeText(String(userAnswer));
  
  // Handle multiple possible correct answers
  const correctAnswers = Array.isArray(correctAnswer)
    ? correctAnswer.map(a => normalizeText(String(a)))
    : [normalizeText(String(correctAnswer))];

  // Check for exact match first (most common case)
  if (correctAnswers.includes(userText)) {
    return {
      isCorrect: true,
      feedback: 'Correct!',
      similarity: 100,
    };
  }

  // Check if user answer is an option ID (a, b, c, d) or index (0, 1, 2, 3)
  // This handles cases where correctAnswer is 'a' and userAnswer is 'A' or '0'
  const optionIdMap: Record<string, string[]> = {
    'a': ['a', '0', 'option a', 'answer a'],
    'b': ['b', '1', 'option b', 'answer b'],
    'c': ['c', '2', 'option c', 'answer c'],
    'd': ['d', '3', 'option d', 'answer d'],
    'e': ['e', '4', 'option e', 'answer e'],
  };

  // Check option ID equivalence
  for (const correct of correctAnswers) {
    const correctLower = correct.toLowerCase();
    if (optionIdMap[correctLower]) {
      if (optionIdMap[correctLower].includes(userText)) {
        return {
          isCorrect: true,
          feedback: 'Correct!',
          similarity: 100,
        };
      }
    }
  }

  // Try fuzzy matching for text-based options (typo tolerance)
  let bestSimilarity = 0;
  let bestMatch = '';

  for (const correct of correctAnswers) {
    const similarity = stringSimilarity(userText, correct);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = correct;
    }
  }

  // Higher threshold for single choice (90%+) to prevent false positives
  const isCorrect = bestSimilarity >= Math.max(threshold, 90);

  return {
    isCorrect,
    similarity: bestSimilarity,
    matchedAnswer: bestMatch,
    feedback: isCorrect
      ? 'Correct!'
      : `The correct answer was: ${correctAnswers[0]}`,
  };
}

/**
 * Validate multiple choice (checkbox) answers
 * Supports partial credit calculation
 */
function validateMultipleChoiceAnswer(
  userAnswer: string | string[],
  correctAnswer: string | string[],
  threshold: number
): AnswerValidationResult {
  // Normalize to arrays
  const userAnswers = (Array.isArray(userAnswer) ? userAnswer : [userAnswer])
    .map(a => normalizeText(String(a)))
    .filter(a => a.length > 0);
  
  const correctAnswers = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
    .map(a => normalizeText(String(a)))
    .filter(a => a.length > 0);

  // Track matches with fuzzy matching
  const matchedCorrect = new Set<string>();
  const incorrectSelections: string[] = [];

  for (const userAns of userAnswers) {
    let foundMatch = false;

    for (const correctAns of correctAnswers) {
      // Check exact match or fuzzy match
      const similarity = stringSimilarity(userAns, correctAns);
      if (similarity >= threshold) {
        matchedCorrect.add(correctAns);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      incorrectSelections.push(userAns);
    }
  }

  // Calculate results
  const correctCount = matchedCorrect.size;
  const totalCorrect = correctAnswers.length;
  const incorrectCount = incorrectSelections.length;

  // All correct answers must be selected, and no incorrect selections
  const isFullyCorrect = correctCount === totalCorrect && incorrectCount === 0;

  // Calculate partial credit (optional)
  const partialCredit = totalCorrect > 0
    ? Math.max(0, (correctCount - incorrectCount) / totalCorrect)
    : 0;

  // Generate feedback
  let feedback: string;
  if (isFullyCorrect) {
    feedback = 'All correct!';
  } else if (correctCount > 0 && incorrectCount === 0) {
    feedback = `Partially correct! You got ${correctCount}/${totalCorrect}. Missing: ${
      correctAnswers.filter(a => !matchedCorrect.has(a)).join(', ')
    }`;
  } else if (incorrectCount > 0) {
    feedback = `Incorrect selections. The correct answers were: ${correctAnswers.join(', ')}`;
  } else {
    feedback = `The correct answers were: ${correctAnswers.join(', ')}`;
  }

  return {
    isCorrect: isFullyCorrect,
    feedback,
    partialCredit: isFullyCorrect ? 1 : partialCredit,
  };
}

// ===========================================
// Enhanced UX Feedback Helpers
// ===========================================

/**
 * Generate encouraging feedback based on similarity score
 * Industry-standard gamification feedback (Duolingo, Kahoot style)
 */
export function getEncouragingFeedback(similarity: number, isCorrect: boolean): string {
  if (isCorrect) {
    if (similarity === 100) return 'Perfect! 🎯';
    if (similarity >= 95) return 'Excellent! 🌟';
    if (similarity >= 90) return 'Great job! ✨';
    if (similarity >= 85) return 'Good answer! 👍';
    return 'Close enough! 👌';
  }
  
  // Encouraging messages for incorrect but close answers
  if (similarity >= 70) return 'So close! Try again next time 💪';
  if (similarity >= 50) return 'Good effort! Keep learning 📚';
  if (similarity >= 30) return 'Not quite, but keep trying! 🎓';
  return 'Keep practicing! You\'ll get it 🚀';
}

/**
 * Format the correct answer for display
 * Handles different data types gracefully
 */
export function formatAnswerForDisplay(answer: string | string[] | number | boolean): string {
  if (Array.isArray(answer)) {
    return answer.map(a => formatAnswerForDisplay(a)).join(', ');
  }
  
  if (typeof answer === 'boolean') {
    return answer ? 'True' : 'False';
  }
  
  if (typeof answer === 'number') {
    // Format numbers with appropriate precision
    if (Number.isInteger(answer)) {
      return answer.toLocaleString();
    }
    return answer.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  
  // Capitalize first letter for display
  const str = String(answer).trim();
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Detect answer type for auto-formatting
 */
export type DetectedAnswerType = 'text' | 'number' | 'boolean' | 'option_id' | 'list';

export function detectAnswerType(answer: string): DetectedAnswerType {
  const trimmed = answer.trim().toLowerCase();
  
  // Check for boolean
  if (BOOLEAN_TRUE_VALUES.includes(trimmed) || BOOLEAN_FALSE_VALUES.includes(trimmed)) {
    return 'boolean';
  }
  
  // Check for option ID (single letter or number)
  if (/^[a-e]$/.test(trimmed) || /^[0-4]$/.test(trimmed)) {
    return 'option_id';
  }
  
  // Check for numeric
  if (isNumericString(answer)) {
    return 'number';
  }
  
  // Check for list (comma or semicolon separated)
  if (answer.includes(',') || answer.includes(';')) {
    return 'list';
  }
  
  return 'text';
}

/**
 * Smart answer normalization based on detected type
 * Auto-formats user input for better matching
 */
export function smartNormalizeAnswer(answer: string): string | string[] {
  const type = detectAnswerType(answer);
  
  switch (type) {
    case 'boolean':
      return normalizeBooleanAnswer(answer) || answer;
    
    case 'number':
      const num = normalizeNumeric(answer);
      return num !== null ? String(num) : answer;
    
    case 'option_id':
      return normalizeText(answer);
    
    case 'list':
      // Split by comma or semicolon and normalize each
      return answer
        .split(/[,;]/)
        .map(s => normalizeText(s))
        .filter(s => s.length > 0);
    
    default:
      return normalizeText(answer);
  }
}

// ===========================================
// Animation Helpers
// ===========================================

/**
 * Get slide animation direction
 */
export function getSlideDirection(
  currentIndex: number,
  previousIndex: number
): 'left' | 'right' {
  return currentIndex > previousIndex ? 'left' : 'right';
}

/**
 * Animation timing configurations
 */
export const ANIMATION_CONFIG = {
  slide: {
    duration: 300,
    easing: 'ease-out',
  },
  fade: {
    duration: 200,
    easing: 'ease-in-out',
  },
  bounce: {
    duration: 400,
    easing: 'ease-out',
  },
} as const;
