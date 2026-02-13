/**
 * Survey Response UI Store - Client State Management
 * Zustand store for UI-only state in survey responses
 * 
 * Following industry best practices:
 * - This store handles ONLY client-side state (UI preferences, filters, view mode)
 * - Server state (responses, survey data) is managed by TanStack Query
 * - Analytics computation is derived from TanStack Query data
 * 
 * Use with: services/surveyResponseHooks.ts for server state
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SurveyResponse, Survey, UploadSurvey } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ResponseFilters {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  respondentId?: string;
  completionStatus?: 'completed' | 'partial' | 'all';
  searchQuery?: string;
}

export interface QuestionAggregate {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  answerDistribution: Record<string, number>;
  averageRating?: number;
  ratingDistribution?: number[];
  topResponses?: string[];
  wordFrequency?: Record<string, number>;
  yesCount?: number;
  noCount?: number;
  min?: number;
  max?: number;
  average?: number;
}

export interface SurveyAnalytics {
  surveyId: string;
  totalResponses: number;
  completionRate: number;
  averageCompletionTime: number;
  responsesByDay: { date: string; count: number }[];
  questionAggregates: QuestionAggregate[];
  lastResponseAt: string | null;
}

export interface ParsedResponse {
  userId: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
  responses: Record<string, unknown>;
  isComplete: boolean;
}

// Client-only UI state
export interface SurveyResponseUIState {
  // View preferences (persisted)
  viewMode: 'summary' | 'questions' | 'individual';
  pageSize: number;
  
  // Filters (session)
  filters: ResponseFilters;
  
  // UI state (session)
  currentResponseIndex: number;
  expandedQuestionId: string | null;
  searchQuery: string;
  
  // Sync tracking
  lastSyncedAt: string | null;
}

export interface SurveyResponseUIActions {
  // View management
  setViewMode: (mode: 'summary' | 'questions' | 'individual') => void;
  setPageSize: (size: number) => void;
  
  // Response navigation
  setCurrentResponseIndex: (index: number) => void;
  nextResponse: (total: number) => void;
  previousResponse: () => void;
  
  // Question expansion
  setExpandedQuestion: (questionId: string | null) => void;
  toggleExpandedQuestion: (questionId: string) => void;
  
  // Filtering
  setFilters: (filters: Partial<ResponseFilters>) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  
  // Sync tracking
  updateLastSync: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SurveyResponseUIState = {
  viewMode: 'summary',
  pageSize: 20,
  filters: {},
  currentResponseIndex: 0,
  expandedQuestionId: null,
  searchQuery: '',
  lastSyncedAt: null,
};

// ============================================================================
// HELPER FUNCTIONS (exported for use with TanStack Query data)
// ============================================================================

/**
 * Parse raw SurveyResponse into ParsedResponse
 */
export const parseResponseData = (response: SurveyResponse): ParsedResponse => {
  let parsedResponses: Record<string, unknown> = {};
  
  try {
    if (typeof response.responses === 'string') {
      parsedResponses = JSON.parse(response.responses);
    } else if (typeof response.responses === 'object') {
      parsedResponses = response.responses as Record<string, unknown>;
    }
  } catch {
    parsedResponses = {};
  }
  
  return {
    userId: response.userId,
    userEmail: response.user?.email,
    userName: response.user ? `${response.user.firstName} ${response.user.lastName}` : undefined,
    createdAt: response.createdAt,
    responses: parsedResponses,
    isComplete: Object.keys(parsedResponses).length > 0,
  };
};

/**
 * Parse multiple responses
 */
export const parseResponses = (responses: SurveyResponse[]): ParsedResponse[] => {
  return responses.map(parseResponseData);
};

/**
 * Filter parsed responses based on filters
 */
export const filterResponses = (
  responses: ParsedResponse[],
  filters: ResponseFilters
): ParsedResponse[] => {
  let filtered = [...responses];
  
  // Date range filter
  if (filters.dateRange) {
    const start = new Date(filters.dateRange.startDate);
    const end = new Date(filters.dateRange.endDate);
    filtered = filtered.filter((r) => {
      const date = new Date(r.createdAt);
      return date >= start && date <= end;
    });
  }
  
  // Respondent filter
  if (filters.respondentId) {
    filtered = filtered.filter((r) => r.userId === filters.respondentId);
  }
  
  // Completion status filter
  if (filters.completionStatus && filters.completionStatus !== 'all') {
    filtered = filtered.filter((r) =>
      filters.completionStatus === 'completed' ? r.isComplete : !r.isComplete
    );
  }
  
  // Search query filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter((r) => {
      const responseText = JSON.stringify(r.responses).toLowerCase();
      const userName = (r.userName || '').toLowerCase();
      const userEmail = (r.userEmail || '').toLowerCase();
      return responseText.includes(query) || userName.includes(query) || userEmail.includes(query);
    });
  }
  
  return filtered;
};

/**
 * Compute question aggregate from responses
 */
export const computeQuestionAggregate = (
  question: UploadSurvey,
  responses: ParsedResponse[]
): QuestionAggregate => {
  const questionId = question.id;
  const answers = responses
    .map((r) => r.responses[questionId])
    .filter((a) => a !== undefined && a !== null);
  
  const aggregate: QuestionAggregate = {
    questionId,
    questionText: question.text,
    questionType: question.type,
    totalResponses: answers.length,
    answerDistribution: {},
  };
  
  switch (question.type.toLowerCase()) {
    case 'radio':
    case 'dropdown':
    case 'checkbox': {
      answers.forEach((answer) => {
        if (Array.isArray(answer)) {
          answer.forEach((a) => {
            const key = String(a);
            aggregate.answerDistribution[key] = (aggregate.answerDistribution[key] || 0) + 1;
          });
        } else {
          const key = String(answer);
          aggregate.answerDistribution[key] = (aggregate.answerDistribution[key] || 0) + 1;
        }
      });
      break;
    }
    
    case 'rating': {
      const ratings = answers.filter((a) => typeof a === 'number') as number[];
      if (ratings.length > 0) {
        aggregate.averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        const maxRating = question.maxValue || 5;
        aggregate.ratingDistribution = Array(maxRating).fill(0);
        ratings.forEach((r) => {
          if (r > 0 && r <= maxRating) {
            aggregate.ratingDistribution![r - 1]++;
          }
        });
        ratings.forEach((r) => {
          aggregate.answerDistribution[String(r)] = (aggregate.answerDistribution[String(r)] || 0) + 1;
        });
      }
      break;
    }
    
    case 'boolean': {
      let yesCount = 0;
      let noCount = 0;
      answers.forEach((answer) => {
        const answerStr = String(answer).toLowerCase();
        if (answerStr === 'true' || answerStr === 'yes' || answerStr === '1') {
          yesCount++;
        } else {
          noCount++;
        }
      });
      aggregate.yesCount = yesCount;
      aggregate.noCount = noCount;
      aggregate.answerDistribution = { Yes: yesCount, No: noCount };
      break;
    }
    
    case 'number': {
      const numbers = answers.filter((a) => typeof a === 'number') as number[];
      if (numbers.length > 0) {
        aggregate.min = Math.min(...numbers);
        aggregate.max = Math.max(...numbers);
        aggregate.average = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
      }
      break;
    }
    
    case 'text':
    case 'paragraph': {
      const textAnswers = answers
        .filter((a) => typeof a === 'string' && a.trim())
        .map((a) => String(a).trim());
      aggregate.topResponses = textAnswers.slice(0, 10);
      
      const wordFreq: Record<string, number> = {};
      textAnswers.forEach((text) => {
        text.toLowerCase().split(/\s+/).forEach((word) => {
          if (word.length > 3) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          }
        });
      });
      aggregate.wordFrequency = Object.fromEntries(
        Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20)
      );
      break;
    }
    
    default: {
      answers.forEach((answer) => {
        const key = String(answer);
        aggregate.answerDistribution[key] = (aggregate.answerDistribution[key] || 0) + 1;
      });
    }
  }
  
  return aggregate;
};

/**
 * Compute full analytics from responses and questions
 */
export const computeAnalytics = (
  survey: Survey,
  questions: UploadSurvey[],
  parsedResponses: ParsedResponse[]
): SurveyAnalytics => {
  const questionAggregates = questions.map((q) =>
    computeQuestionAggregate(q, parsedResponses)
  );
  
  // Compute responses by day
  const responsesByDayMap: Record<string, number> = {};
  parsedResponses.forEach((r) => {
    const day = r.createdAt.split('T')[0];
    responsesByDayMap[day] = (responsesByDayMap[day] || 0) + 1;
  });
  
  const responsesByDay = Object.entries(responsesByDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  
  const completedResponses = parsedResponses.filter((r) => r.isComplete);
  const maxResponses = survey.maxResponses || 500;
  
  return {
    surveyId: survey.id,
    totalResponses: parsedResponses.length,
    completionRate: (completedResponses.length / maxResponses) * 100,
    averageCompletionTime: 120, // Placeholder
    responsesByDay,
    questionAggregates,
    lastResponseAt: parsedResponses.length > 0
      ? parsedResponses.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0].createdAt
      : null,
  };
};

/**
 * Export responses to CSV
 */
export const exportToCSV = (
  survey: Survey | null,
  questions: UploadSurvey[],
  parsedResponses: ParsedResponse[]
): string => {
  if (!survey || parsedResponses.length === 0) return '';
  
  const headers = [
    'Timestamp',
    'Respondent',
    ...questions.map((q) => q.text),
  ];
  
  const rows = parsedResponses.map((r) => [
    r.createdAt,
    r.userEmail || r.userId,
    ...questions.map((q) => {
      const answer = r.responses[q.id];
      if (Array.isArray(answer)) return answer.join('; ');
      return String(answer || '');
    }),
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  
  return csvContent;
};

/**
 * Export responses to JSON
 */
export const exportToJSON = (
  survey: Survey | null,
  questions: UploadSurvey[],
  parsedResponses: ParsedResponse[]
): string => {
  const exportData = {
    survey: {
      id: survey?.id,
      title: survey?.title,
      description: survey?.description,
    },
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
    })),
    responses: parsedResponses.map((r) => ({
      timestamp: r.createdAt,
      respondent: r.userEmail || r.userId,
      answers: r.responses,
    })),
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(exportData, null, 2);
};

/**
 * Export responses to PDF HTML
 */
export const exportToPDFHtml = (
  survey: Survey | null,
  questions: UploadSurvey[],
  parsedResponses: ParsedResponse[],
  analytics: SurveyAnalytics | null
): string => {
  if (!survey || parsedResponses.length === 0) return '';
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatAnswer = (answer: unknown, type: string): string => {
    if (answer === null || answer === undefined) return '-';
    if (Array.isArray(answer)) return answer.join(', ');
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    if (type === 'rating') return `${answer} / 5 ★`;
    return String(answer);
  };
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${survey.title} - Survey Responses</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
    .header { border-bottom: 2px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #666; }
    .meta { display: flex; gap: 24px; margin-top: 12px; }
    .meta-item { font-size: 13px; color: #444; }
    .meta-item strong { color: #1a1a1a; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 600; color: #4F46E5; margin-bottom: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
    .stats-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .stat-card { background: #f8f9fa; border-radius: 8px; padding: 16px; min-width: 140px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #4F46E5; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8f9fa; text-align: left; padding: 12px; font-weight: 600; border-bottom: 2px solid #e5e5e5; }
    td { padding: 12px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    tr:nth-child(even) { background: #fafafa; }
    .question-summary { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .question-text { font-weight: 600; margin-bottom: 8px; }
    .question-type { font-size: 12px; color: #666; text-transform: capitalize; }
    .answer-dist { margin-top: 12px; }
    .answer-row { display: flex; align-items: center; margin-bottom: 6px; }
    .answer-label { flex: 1; font-size: 13px; }
    .answer-bar { width: 120px; height: 8px; background: #e5e5e5; border-radius: 4px; margin: 0 12px; }
    .answer-fill { height: 100%; background: #4F46E5; border-radius: 4px; }
    .answer-count { font-size: 13px; color: #666; min-width: 40px; text-align: right; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888; text-align: center; }
    @media print { body { padding: 20px; } .header { page-break-after: avoid; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${survey.title}</h1>
    <p class="subtitle">${survey.description || 'Survey Responses Report'}</p>
    <div class="meta">
      <span class="meta-item"><strong>Exported:</strong> ${formatDate(new Date().toISOString())}</span>
      <span class="meta-item"><strong>Total Responses:</strong> ${parsedResponses.length}</span>
      <span class="meta-item"><strong>Status:</strong> ${survey.status || 'Active'}</span>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${parsedResponses.length}</div>
        <div class="stat-label">Total Responses</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analytics?.completionRate?.toFixed(1) || 0}%</div>
        <div class="stat-label">Completion Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${questions.length}</div>
        <div class="stat-label">Questions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analytics?.lastResponseAt ? formatDate(analytics.lastResponseAt).split(',')[0] : '-'}</div>
        <div class="stat-label">Last Response</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Question Analysis</h2>
    ${analytics?.questionAggregates?.map((agg, idx) => {
      const entries = Object.entries(agg.answerDistribution).slice(0, 6);
      const maxCount = Math.max(...entries.map(([, c]) => c), 1);
      return `
      <div class="question-summary">
        <div class="question-text">${idx + 1}. ${agg.questionText}</div>
        <div class="question-type">${agg.questionType} • ${agg.totalResponses} responses${agg.averageRating ? ` • Avg: ${agg.averageRating.toFixed(1)}★` : ''}</div>
        ${entries.length > 0 ? `
        <div class="answer-dist">
          ${entries.map(([label, count]) => `
          <div class="answer-row">
            <span class="answer-label">${label}</span>
            <div class="answer-bar"><div class="answer-fill" style="width: ${(count / maxCount * 100)}%"></div></div>
            <span class="answer-count">${count}</span>
          </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      `;
    }).join('') || ''}
  </div>

  <div class="section">
    <h2 class="section-title">Individual Responses</h2>
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Respondent</th>
          ${questions.map((q) => `<th>${q.text.substring(0, 30)}${q.text.length > 30 ? '...' : ''}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${parsedResponses.slice(0, 50).map((r) => `
        <tr>
          <td>${formatDate(r.createdAt)}</td>
          <td>${r.userName || r.userEmail || r.userId}</td>
          ${questions.map((q) => `<td>${formatAnswer(r.responses[q.id], q.type)}</td>`).join('')}
        </tr>
        `).join('')}
        ${parsedResponses.length > 50 ? `<tr><td colspan="${questions.length + 2}" style="text-align: center; color: #666; font-style: italic;">... and ${parsedResponses.length - 50} more responses</td></tr>` : ''}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Generated by DelipuCash Survey Analytics • ${formatDate(new Date().toISOString())}</p>
  </div>
</body>
</html>
  `.trim();
  
  return html;
};

// ============================================================================
// STORE (UI State Only)
// ============================================================================

export const useSurveyResponseUIStore = create<SurveyResponseUIState & SurveyResponseUIActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      // View management
      setViewMode: (viewMode) => set({ viewMode }),
      setPageSize: (pageSize) => set({ pageSize }),
      
      // Response navigation
      setCurrentResponseIndex: (index) => {
        if (index >= 0) {
          set({ currentResponseIndex: index });
        }
      },
      
      nextResponse: (total) => {
        const { currentResponseIndex } = get();
        if (currentResponseIndex < total - 1) {
          set({ currentResponseIndex: currentResponseIndex + 1 });
        }
      },
      
      previousResponse: () => {
        const { currentResponseIndex } = get();
        if (currentResponseIndex > 0) {
          set({ currentResponseIndex: currentResponseIndex - 1 });
        }
      },
      
      // Question expansion
      setExpandedQuestion: (questionId) => set({ expandedQuestionId: questionId }),
      
      toggleExpandedQuestion: (questionId) => {
        const { expandedQuestionId } = get();
        set({ 
          expandedQuestionId: expandedQuestionId === questionId ? null : questionId 
        });
      },
      
      // Filtering
      setFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
          currentResponseIndex: 0, // Reset to first response when filtering
        }));
      },
      
      clearFilters: () => {
        set({ filters: {}, currentResponseIndex: 0 });
      },
      
      setSearchQuery: (searchQuery) => {
        set((state) => ({
          searchQuery,
          filters: { ...state.filters, searchQuery: searchQuery || undefined },
          currentResponseIndex: 0,
        }));
      },
      
      // Sync tracking
      updateLastSync: () => set({ lastSyncedAt: new Date().toISOString() }),
      
      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'survey-response-ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist view preferences
        viewMode: state.viewMode,
        pageSize: state.pageSize,
      }),
    }
  ),
  { name: 'SurveyResponseUIStore', enabled: __DEV__ },
  )
);

// ============================================================================
// Atomic Selectors (stable — no new objects)
// ============================================================================

export const selectViewMode = (state: SurveyResponseUIState) => state.viewMode;
export const selectFilters = (state: SurveyResponseUIState) => state.filters;
export const selectSearchQuery = (state: SurveyResponseUIState) => state.searchQuery;
export const selectCurrentResponseIndex = (state: SurveyResponseUIState) => state.currentResponseIndex;
export const selectExpandedQuestionId = (state: SurveyResponseUIState) => state.expandedQuestionId;
export const selectHasFilters = (state: SurveyResponseUIState) =>
  Object.keys(state.filters).length > 0;
export const selectPageSize = (state: SurveyResponseUIState) => state.pageSize;
export const selectLastSyncedAt = (state: SurveyResponseUIState) => state.lastSyncedAt;

// ============================================================================
// Object Selectors — use with useShallow to prevent re-renders
// ============================================================================

export const selectResponseNavigation = (state: SurveyResponseUIState) => ({
  currentIndex: state.currentResponseIndex,
  viewMode: state.viewMode,
  expandedQuestionId: state.expandedQuestionId,
});

export const selectFilterState = (state: SurveyResponseUIState) => ({
  filters: state.filters,
  searchQuery: state.searchQuery,
  hasFilters: Object.keys(state.filters).length > 0,
});

// ============================================================================
// Convenience Hooks — pre-wrapped with useShallow (re-render safe)
// ============================================================================

/** Response navigation state — shallow-compared */
export const useResponseNavigation = () => useSurveyResponseUIStore(useShallow(selectResponseNavigation));

/** Filter state — shallow-compared */
export const useFilterState = () => useSurveyResponseUIStore(useShallow(selectFilterState));

export default useSurveyResponseUIStore;
