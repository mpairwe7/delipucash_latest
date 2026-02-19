/**
 * Column Auto-Mapper — Intelligent CSV/TSV column name matching
 *
 * Automatically maps imported file headers to expected question fields.
 * Uses normalized string matching + fuzzy (Levenshtein) distance for
 * high-confidence auto-mapping.
 *
 * No React dependencies — fully testable.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TargetField =
  | 'text'
  | 'type'
  | 'options'
  | 'required'
  | 'minValue'
  | 'maxValue'
  | 'placeholder';

export interface ColumnMapping {
  /** Index in the CSV/TSV headers array */
  headerIndex: number;
  /** Original header text from the file */
  headerText: string;
  /** Mapped target field (null if unmapped) */
  targetField: TargetField | null;
  /** Confidence: 1.0 = exact, 0.7 = contains, 0.5 = fuzzy, 0 = unmapped */
  confidence: number;
}

// ============================================================================
// KNOWN ALIASES
// ============================================================================

/** Map of target field → known aliases (lowercase, trimmed) */
const FIELD_ALIASES: Record<TargetField, string[]> = {
  text: [
    'text', 'question', 'question_text', 'questiontext', 'label', 'prompt',
    'title', 'question text', 'survey question', 'q', 'item',
  ],
  type: [
    'type', 'question_type', 'questiontype', 'format', 'input_type',
    'inputtype', 'field_type', 'fieldtype', 'answer_type', 'answertype',
  ],
  options: [
    'options', 'choices', 'answers', 'answer_options', 'answeroptions',
    'values', 'items', 'selections', 'option_list', 'optionlist',
  ],
  required: [
    'required', 'mandatory', 'is_required', 'isrequired', 'must_answer',
    'mustanswer', 'compulsory', 'obligatory',
  ],
  minValue: [
    'minvalue', 'min_value', 'min', 'minimum', 'lower_bound', 'lowerbound',
    'min_rating', 'minrating', 'range_min', 'rangemin',
  ],
  maxValue: [
    'maxvalue', 'max_value', 'max', 'maximum', 'upper_bound', 'upperbound',
    'max_rating', 'maxrating', 'range_max', 'rangemax',
  ],
  placeholder: [
    'placeholder', 'hint', 'helper_text', 'helpertext', 'description',
    'help_text', 'helptext', 'input_hint', 'inputhint',
  ],
};

// ============================================================================
// LEVENSHTEIN DISTANCE
// ============================================================================

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for fuzzy matching when exact and contains checks fail.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Short-circuit
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ============================================================================
// NORMALIZE
// ============================================================================

/**
 * Normalize a header string for matching: lowercase, trim, collapse whitespace,
 * strip quotes and special chars.
 */
function normalize(header: string): string {
  return header
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// MATCHING
// ============================================================================

interface MatchResult {
  field: TargetField;
  confidence: number;
}

/**
 * Try to match a normalized header to a target field.
 * Returns the best match with confidence score, or null if no match.
 */
function matchHeader(normalizedHeader: string): MatchResult | null {
  let bestMatch: MatchResult | null = null;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [TargetField, string[]][]) {
    // 1. Exact match → confidence 1.0
    if (aliases.includes(normalizedHeader)) {
      return { field, confidence: 1.0 };
    }

    // 2. Contains match → confidence 0.7
    for (const alias of aliases) {
      if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
        if (!bestMatch || bestMatch.confidence < 0.7) {
          bestMatch = { field, confidence: 0.7 };
        }
      }
    }

    // 3. Fuzzy match (Levenshtein) → confidence 0.5
    // Only if no exact or contains match found yet
    if (!bestMatch || bestMatch.confidence < 0.5) {
      for (const alias of aliases) {
        const maxLen = Math.max(normalizedHeader.length, alias.length);
        if (maxLen === 0) continue;
        const distance = levenshtein(normalizedHeader, alias);
        const similarity = 1 - distance / maxLen;
        // Require at least 70% character similarity for fuzzy match
        if (similarity >= 0.7) {
          if (!bestMatch || bestMatch.confidence < 0.5) {
            bestMatch = { field, confidence: 0.5 };
          }
        }
      }
    }
  }

  return bestMatch;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Auto-map CSV/TSV column headers to expected question fields.
 *
 * @param headers - Raw header strings from the file
 * @returns Array of ColumnMapping objects, one per header
 *
 * @example
 * ```ts
 * const mappings = autoMapColumns(['Question Text', 'Type', 'Options', 'Is Required']);
 * // → [
 * //   { headerIndex: 0, headerText: 'Question Text', targetField: 'text', confidence: 0.7 },
 * //   { headerIndex: 1, headerText: 'Type',          targetField: 'type', confidence: 1.0 },
 * //   { headerIndex: 2, headerText: 'Options',       targetField: 'options', confidence: 1.0 },
 * //   { headerIndex: 3, headerText: 'Is Required',   targetField: 'required', confidence: 0.7 },
 * // ]
 * ```
 */
export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const usedFields = new Set<TargetField>();
  const results: ColumnMapping[] = [];

  // First pass: collect all matches with scores
  const candidates: { headerIndex: number; headerText: string; match: MatchResult | null }[] =
    headers.map((header, index) => ({
      headerIndex: index,
      headerText: header,
      match: matchHeader(normalize(header)),
    }));

  // Sort by confidence descending to assign highest-confidence matches first
  const sorted = [...candidates].sort((a, b) => {
    const confA = a.match?.confidence ?? 0;
    const confB = b.match?.confidence ?? 0;
    return confB - confA;
  });

  // Assign fields greedily: highest confidence first, no duplicates
  const assignments = new Map<number, { field: TargetField; confidence: number }>();
  for (const candidate of sorted) {
    if (candidate.match && !usedFields.has(candidate.match.field)) {
      usedFields.add(candidate.match.field);
      assignments.set(candidate.headerIndex, {
        field: candidate.match.field,
        confidence: candidate.match.confidence,
      });
    }
  }

  // Build final result in original order
  for (const candidate of candidates) {
    const assignment = assignments.get(candidate.headerIndex);
    results.push({
      headerIndex: candidate.headerIndex,
      headerText: candidate.headerText,
      targetField: assignment?.field ?? null,
      confidence: assignment?.confidence ?? 0,
    });
  }

  return results;
}

/**
 * Get the confidence level label for display.
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 1.0) return 'Exact match';
  if (confidence >= 0.7) return 'Likely match';
  if (confidence >= 0.5) return 'Possible match';
  return 'Not mapped';
}

/**
 * Check if a mapping is high-confidence (no user review needed).
 */
export function isHighConfidence(confidence: number): boolean {
  return confidence >= 0.7;
}

/**
 * Check if any required field ('text') is missing from mappings.
 */
export function hasMissingRequiredField(mappings: ColumnMapping[]): boolean {
  return !mappings.some(m => m.targetField === 'text');
}

/**
 * Get all unmapped (or low-confidence) columns that need user review.
 */
export function getColumnsNeedingReview(mappings: ColumnMapping[]): ColumnMapping[] {
  return mappings.filter(m => m.confidence > 0 && m.confidence < 0.7);
}
