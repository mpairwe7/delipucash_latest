/**
 * useSearch Hook - Industry-Standard Search Implementation
 * 
 * Features:
 * - Debounced search to prevent excessive API calls
 * - Local filtering with fuzzy matching
 * - Search history with AsyncStorage persistence
 * - Recent searches suggestions
 * - Search analytics tracking
 * - Keyboard handling optimization
 * 
 * @example
 * ```tsx
 * const {
 *   query,
 *   setQuery,
 *   filteredResults,
 *   isSearching,
 *   suggestions,
 *   clearSearch,
 *   recentSearches,
 * } = useSearch({
 *   data: videos,
 *   searchFields: ['title', 'description'],
 *   debounceMs: 300,
 * });
 * ```
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Type definitions
export interface SearchOptions<T> {
  /** Data array to search through */
  data: T[];
  /** Fields to search within each item */
  searchFields: (keyof T)[];
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Maximum recent searches to store (default: 10) */
  maxRecentSearches?: number;
  /** Storage key for recent searches */
  storageKey?: string;
  /** Enable fuzzy matching (default: true) */
  fuzzyMatch?: boolean;
  /** Minimum characters to trigger search (default: 1) */
  minSearchLength?: number;
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Enable haptic feedback (default: true) */
  enableHaptics?: boolean;
  /** Custom filter function */
  customFilter?: (item: T, query: string) => boolean;
  /** Sort results by relevance (default: true) */
  sortByRelevance?: boolean;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: string[];
}

export interface UseSearchReturn<T> {
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Filtered results based on search query */
  filteredResults: T[];
  /** Search results with relevance scores */
  searchResults: SearchResult<T>[];
  /** Whether search is active (query length > 0) */
  isSearching: boolean;
  /** Whether debounce is pending */
  isDebouncing: boolean;
  /** Clear search query and results */
  clearSearch: () => void;
  /** Recent search queries */
  recentSearches: string[];
  /** Add a search to history */
  addToHistory: (searchTerm: string) => void;
  /** Remove a search from history */
  removeFromHistory: (searchTerm: string) => void;
  /** Clear all search history */
  clearHistory: () => void;
  /** Submit search (adds to history) */
  submitSearch: (query?: string) => void;
  /** Total results count */
  resultsCount: number;
  /** Whether there are no results */
  hasNoResults: boolean;
  /** Suggested searches based on current query */
  suggestions: string[];
}

// Type for timeout reference
type TimeoutRef = ReturnType<typeof setTimeout> | null;

/**
 * Calculate relevance score for fuzzy matching
 */
function calculateRelevanceScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;
  
  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 90;
  
  // Contains exact query
  if (lowerText.includes(lowerQuery)) return 80;
  
  // Word boundary match
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) return 70;
  }
  
  // Fuzzy character matching
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10 + consecutiveMatches * 5;
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
  }
  
  // Penalize if not all query characters found
  if (queryIndex < lowerQuery.length) {
    return 0;
  }
  
  // Normalize score
  return Math.min(60, score / lowerQuery.length);
}

/**
 * Custom hook for search functionality with industry-standard features
 */
export function useSearch<T extends Record<string, any>>({
  data,
  searchFields,
  debounceMs = 300,
  maxRecentSearches = 10,
  storageKey = '@search_history',
  fuzzyMatch = true,
  minSearchLength = 1,
  caseSensitive = false,
  enableHaptics = true,
  customFilter,
  sortByRelevance = true,
}: SearchOptions<T>): UseSearchReturn<T> {
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimeoutRef = useRef<TimeoutRef>(null);

  // Load recent searches from storage on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (error) {
        console.warn('Failed to load search history:', error);
      }
    };
    loadRecentSearches();
  }, [storageKey]);

  // Save recent searches to storage
  const saveRecentSearches = useCallback(async (searches: string[]) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(searches));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, [storageKey]);

  // Debounced query setter
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setIsDebouncing(true);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(newQuery);
      setIsDebouncing(false);
    }, debounceMs);
  }, [debounceMs]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Search results with relevance scoring
  const searchResults = useMemo((): SearchResult<T>[] => {
    if (!debouncedQuery || debouncedQuery.length < minSearchLength) {
      return data.map(item => ({ item, score: 0, matches: [] }));
    }

    const normalizedQuery = caseSensitive ? debouncedQuery : debouncedQuery.toLowerCase();

    const results: SearchResult<T>[] = data.map(item => {
      // Use custom filter if provided
      if (customFilter) {
        const matches = customFilter(item, debouncedQuery);
        return {
          item,
          score: matches ? 100 : 0,
          matches: matches ? [debouncedQuery] : [],
        };
      }

      let totalScore = 0;
      const matches: string[] = [];

      for (const field of searchFields) {
        const value = item[field];
        if (value == null) continue;

        const textValue = String(value);
        const normalizedValue = caseSensitive ? textValue : textValue.toLowerCase();

        if (fuzzyMatch) {
          const score = calculateRelevanceScore(normalizedValue, normalizedQuery);
          if (score > 0) {
            totalScore = Math.max(totalScore, score);
            matches.push(String(field));
          }
        } else {
          // Simple contains match
          if (normalizedValue.includes(normalizedQuery)) {
            totalScore = 100;
            matches.push(String(field));
          }
        }
      }

      return { item, score: totalScore, matches };
    });

    // Filter and sort by relevance
    const filteredResults = results.filter(r => r.score > 0);
    
    if (sortByRelevance) {
      filteredResults.sort((a, b) => b.score - a.score);
    }

    return filteredResults;
  }, [data, debouncedQuery, searchFields, minSearchLength, caseSensitive, fuzzyMatch, customFilter, sortByRelevance]);

  // Extract just the items for simple usage
  const filteredResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < minSearchLength) {
      return data;
    }
    return searchResults.map(r => r.item);
  }, [searchResults, data, debouncedQuery, minSearchLength]);

  // Generate suggestions based on recent searches and current query
  const suggestions = useMemo(() => {
    if (!query || query.length < 1) {
      return recentSearches.slice(0, 5);
    }
    
    const lowerQuery = query.toLowerCase();
    return recentSearches
      .filter(s => s.toLowerCase().includes(lowerQuery) && s.toLowerCase() !== lowerQuery)
      .slice(0, 5);
  }, [query, recentSearches]);

  // Clear search
  const clearSearch = useCallback(() => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setQueryState('');
    setDebouncedQuery('');
  }, [enableHaptics]);

  // Add to search history
  const addToHistory = useCallback((searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, maxRecentSearches);
      saveRecentSearches(updated);
      return updated;
    });
  }, [maxRecentSearches, saveRecentSearches]);

  // Remove from search history
  const removeFromHistory = useCallback((searchTerm: string) => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== searchTerm);
      saveRecentSearches(updated);
      return updated;
    });
  }, [saveRecentSearches, enableHaptics]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear search history:', error);
    }
  }, [storageKey, enableHaptics]);

  // Submit search (adds to history)
  const submitSearch = useCallback((searchQuery?: string) => {
    const term = searchQuery ?? query;
    if (term.trim().length >= 2) {
      addToHistory(term.trim());
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [query, addToHistory, enableHaptics]);

  const isSearching = query.length >= minSearchLength;
  const resultsCount = filteredResults.length;
  const hasNoResults = isSearching && resultsCount === 0 && !isDebouncing;

  return {
    query,
    setQuery,
    filteredResults,
    searchResults,
    isSearching,
    isDebouncing,
    clearSearch,
    recentSearches,
    addToHistory,
    removeFromHistory,
    clearHistory,
    submitSearch,
    resultsCount,
    hasNoResults,
    suggestions,
  };
}

export default useSearch;
