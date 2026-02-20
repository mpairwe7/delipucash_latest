/**
 * Survey Import Controller
 * Server-side file parsing, validation, and sample template serving
 * for the survey import feature.
 *
 * Endpoints:
 * - POST /api/surveys/import/preview — Parse uploaded file, return preview data
 * - GET /api/surveys/import/samples/:format — Download sample template
 */

import asyncHandler from 'express-async-handler';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_QUESTION_TYPES = [
  'text', 'paragraph', 'radio', 'checkbox', 'dropdown',
  'rating', 'boolean', 'date', 'time', 'number', 'file_upload',
];

const MAX_QUESTIONS_PER_FILE = 200;

// ============================================================================
// COLUMN AUTO-MAPPING (ported from utils/columnAutoMapper.ts)
// ============================================================================

const FIELD_ALIASES = {
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
  points: [
    'points', 'score', 'point', 'weight', 'marks', 'scoring',
    'question_points', 'questionpoints', 'mark', 'grade',
  ],
};

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function normalize(header) {
  return header
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchHeader(normalizedHeader) {
  let bestMatch = null;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalizedHeader)) {
      return { field, confidence: 1.0 };
    }

    for (const alias of aliases) {
      if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
        if (!bestMatch || bestMatch.confidence < 0.7) {
          bestMatch = { field, confidence: 0.7 };
        }
      }
    }

    if (!bestMatch || bestMatch.confidence < 0.5) {
      for (const alias of aliases) {
        const maxLen = Math.max(normalizedHeader.length, alias.length);
        if (maxLen === 0) continue;
        const distance = levenshtein(normalizedHeader, alias);
        const similarity = 1 - distance / maxLen;
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

function autoMapColumns(headers) {
  const usedFields = new Set();
  const candidates = headers.map((header, index) => ({
    headerIndex: index,
    headerText: header,
    match: matchHeader(normalize(header)),
  }));

  const sorted = [...candidates].sort((a, b) => {
    const confA = a.match?.confidence ?? 0;
    const confB = b.match?.confidence ?? 0;
    return confB - confA;
  });

  const assignments = new Map();
  for (const candidate of sorted) {
    if (candidate.match && !usedFields.has(candidate.match.field)) {
      usedFields.add(candidate.match.field);
      assignments.set(candidate.headerIndex, {
        field: candidate.match.field,
        confidence: candidate.match.confidence,
      });
    }
  }

  return candidates.map((candidate) => {
    const assignment = assignments.get(candidate.headerIndex);
    return {
      headerIndex: candidate.headerIndex,
      headerText: candidate.headerText,
      targetField: assignment?.field ?? null,
      confidence: assignment?.confidence ?? 0,
    };
  });
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) return content.slice(1);
  return content;
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseDelimitedLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function detectDelimiter(content) {
  const firstLine = content.split('\n')[0] || '';
  let tabCount = 0, commaCount = 0, semicolonCount = 0;
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (char === '\t') tabCount++;
      else if (char === ',') commaCount++;
      else if (char === ';') semicolonCount++;
    }
  }

  if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

function isValidQuestionType(type) {
  return VALID_QUESTION_TYPES.includes(type?.toLowerCase());
}

function detectFormatFromFilename(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'json': return 'json';
    case 'csv': return 'csv';
    case 'tsv': return 'tsv';
    default: return null;
  }
}

// ============================================================================
// JSON PARSER
// ============================================================================

function parseJSONFile(content) {
  const errors = [];
  const warnings = [];

  let parsed;
  try {
    const clean = stripBOM(content);
    parsed = JSON.parse(clean);
  } catch (err) {
    errors.push(`Invalid JSON syntax: ${err.message}`);
    return { questions: [], errors, warnings, invalidRows: [], columnMappings: [] };
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    errors.push('Invalid JSON format: missing "questions" array. Expected { "title": "...", "questions": [...] }');
    return { questions: [], errors, warnings, invalidRows: [], columnMappings: [] };
  }

  if (parsed.questions.length > MAX_QUESTIONS_PER_FILE) {
    errors.push(`File contains ${parsed.questions.length} questions. Maximum is ${MAX_QUESTIONS_PER_FILE}.`);
    return { questions: [], errors, warnings, invalidRows: [], columnMappings: [] };
  }

  const questions = [];
  parsed.questions.forEach((q, index) => {
    if (!q.text || !String(q.text).trim()) {
      warnings.push(`Question ${index + 1}: Missing question text, skipped`);
      return;
    }

    const rawType = String(q.type || 'text').toLowerCase();
    if (!isValidQuestionType(rawType)) {
      warnings.push(`Question ${index + 1}: Invalid type "${q.type}", defaulting to "text"`);
    }
    const type = isValidQuestionType(rawType) ? rawType : 'text';

    const options = Array.isArray(q.options) ? q.options.map(String) : [];

    // Validate options for choice types
    if (['radio', 'checkbox', 'dropdown'].includes(type) && options.length < 2) {
      warnings.push(`Question ${index + 1}: Type "${type}" has fewer than 2 options`);
    }

    // Validate rating bounds
    if (type === 'rating') {
      const min = typeof q.minValue === 'number' ? q.minValue : 1;
      const max = typeof q.maxValue === 'number' ? q.maxValue : 5;
      if (min >= max) {
        warnings.push(`Question ${index + 1}: Rating minValue (${min}) must be less than maxValue (${max})`);
      }
    }

    questions.push({
      id: `imported_${index + 1}`,
      text: String(q.text).trim(),
      type,
      options,
      required: Boolean(q.required),
      placeholder: q.placeholder ? String(q.placeholder) : undefined,
      minValue: typeof q.minValue === 'number' ? q.minValue : undefined,
      maxValue: typeof q.maxValue === 'number' ? q.maxValue : undefined,
      points: typeof q.points === 'number' ? q.points : undefined,
    });
  });

  return {
    title: parsed.title ? String(parsed.title) : undefined,
    description: parsed.description ? String(parsed.description) : undefined,
    questions,
    warnings,
    errors,
    invalidRows: [],
    columnMappings: [],
  };
}

// ============================================================================
// CSV/TSV PARSER
// ============================================================================

function parseSpreadsheetFile(content) {
  const cleanContent = normalizeLineEndings(stripBOM(content));
  const lines = cleanContent.split('\n').filter((line) => line.trim());
  const errors = [];
  const warnings = [];
  const invalidRows = [];

  if (lines.length < 2) {
    errors.push('File must have a header row and at least one data row');
    return { questions: [], errors, warnings, invalidRows, columnMappings: [] };
  }

  const delimiter = detectDelimiter(cleanContent);
  const rawHeaders = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.replace(/['"]/g, '').trim()
  );

  const columnMappings = autoMapColumns(rawHeaders);

  const fieldIndex = (field) => {
    const mapping = columnMappings.find((m) => m.targetField === field);
    return mapping ? mapping.headerIndex : -1;
  };

  const textIndex = fieldIndex('text');
  const typeIndex = fieldIndex('type');
  const optionsIndex = fieldIndex('options');
  const requiredIndex = fieldIndex('required');
  const minValueIndex = fieldIndex('minValue');
  const maxValueIndex = fieldIndex('maxValue');
  const placeholderIndex = fieldIndex('placeholder');
  const pointsIndex = fieldIndex('points');

  if (textIndex === -1) {
    errors.push('Missing required column: "text" or "question". No column could be auto-mapped to the question text field.');
    return { questions: [], errors, warnings, invalidRows, columnMappings };
  }

  // Log low-confidence mappings
  columnMappings.forEach((m) => {
    if (m.targetField && m.confidence < 0.7) {
      warnings.push(`Column "${m.headerText}" → "${m.targetField}" (possible match) — verify mapping`);
    }
  });

  if (lines.length - 1 > MAX_QUESTIONS_PER_FILE) {
    errors.push(`File contains ${lines.length - 1} data rows. Maximum is ${MAX_QUESTIONS_PER_FILE}.`);
    return { questions: [], errors, warnings, invalidRows, columnMappings };
  }

  const questions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const text = values[textIndex]?.replace(/^["']|["']$/g, '').trim();

    if (!text) {
      invalidRows.push({ rowIndex: i + 1, reason: 'Empty question text', rawValues: values });
      continue;
    }

    const rawType = typeIndex !== -1 ? values[typeIndex]?.toLowerCase().trim() : 'text';
    const type = isValidQuestionType(rawType) ? rawType : 'text';
    if (typeIndex !== -1 && !isValidQuestionType(rawType)) {
      warnings.push(`Row ${i + 1}: Invalid type "${rawType}", using "text"`);
    }

    let options = [];
    if (optionsIndex !== -1 && values[optionsIndex]) {
      const optVal = values[optionsIndex].replace(/^["']|["']$/g, '');
      if (optVal.startsWith('[')) {
        try { options = JSON.parse(optVal); } catch { options = optVal.split('|').filter(Boolean); }
      } else {
        options = optVal.split('|').map((o) => o.trim()).filter(Boolean);
      }
    }

    // Per-row validation
    if (['radio', 'checkbox', 'dropdown'].includes(type) && options.length < 2) {
      invalidRows.push({
        rowIndex: i + 1,
        reason: `Type "${type}" requires at least 2 options`,
        rawValues: values,
      });
      continue;
    }

    questions.push({
      id: `imported_${questions.length + 1}`,
      text,
      type,
      options,
      required: requiredIndex !== -1 ? values[requiredIndex]?.toLowerCase() === 'true' : false,
      minValue: minValueIndex !== -1 && values[minValueIndex] ? Number(values[minValueIndex]) : undefined,
      maxValue: maxValueIndex !== -1 && values[maxValueIndex] ? Number(values[maxValueIndex]) : undefined,
      placeholder: placeholderIndex !== -1 ? values[placeholderIndex]?.replace(/^["']|["']$/g, '') : undefined,
      points: pointsIndex !== -1 && values[pointsIndex] ? Number(values[pointsIndex]) || 0 : undefined,
    });
  }

  if (invalidRows.length > 0) {
    warnings.push(`${invalidRows.length} row(s) skipped due to validation errors`);
  }

  return { questions, warnings, errors, invalidRows, columnMappings };
}

// ============================================================================
// SAMPLE TEMPLATES
// ============================================================================

const SAMPLE_JSON = JSON.stringify({
  title: "Customer Feedback Survey",
  description: "Help us improve our services by sharing your experience",
  questions: [
    { text: "How would you rate our service?", type: "rating", required: true, minValue: 1, maxValue: 5, points: 10 },
    { text: "Which features do you use most?", type: "checkbox", options: ["Speed", "Design", "Support", "Price"], required: true, points: 5 },
    { text: "How did you hear about us?", type: "dropdown", options: ["Social Media", "Friend", "Advertisement", "Search Engine"], required: false, points: 5 },
    { text: "Would you recommend us to a friend?", type: "boolean", required: true, points: 5 },
    { text: "Your date of birth", type: "date", required: false },
    { text: "What time works best for a call?", type: "time", required: false },
    { text: "How many products do you own?", type: "number", minValue: 0, maxValue: 100, placeholder: "Enter a number", required: false },
    { text: "Any additional feedback?", type: "paragraph", placeholder: "Share your detailed thoughts...", required: false, points: 0 },
  ],
  metadata: {
    version: "1.0",
    supportedTypes: ["text", "paragraph", "radio", "checkbox", "dropdown", "rating", "boolean", "date", "time", "number"],
  },
}, null, 2);

const SAMPLE_CSV = `text,type,options,required,minValue,maxValue,placeholder,points
"How would you rate our service?",rating,,true,1,5,,10
"Which features do you use most?",checkbox,"Speed|Design|Support|Price",true,,,,5
"How did you hear about us?",dropdown,"Social Media|Friend|Advertisement|Search Engine",false,,,,5
"Would you recommend us to a friend?",boolean,,true,,,,5
"Your date of birth",date,,false,,,,
"What time works best for a call?",time,,false,,,,
"How many products do you own?",number,,false,0,100,"Enter a number",
"Any additional feedback?",paragraph,,false,,,"Share your detailed thoughts...",0`;

const SAMPLE_TSV = `text\ttype\toptions\trequired\tminValue\tmaxValue\tplaceholder\tpoints
"How would you rate our service?"\trating\t\ttrue\t1\t5\t\t10
"Which features do you use most?"\tcheckbox\tSpeed|Design|Support|Price\ttrue\t\t\t\t5
"How did you hear about us?"\tdropdown\tSocial Media|Friend|Advertisement|Search Engine\tfalse\t\t\t\t5
"Would you recommend us to a friend?"\tboolean\t\ttrue\t\t\t\t5
"Your date of birth"\tdate\t\tfalse\t\t\t\t
"What time works best for a call?"\ttime\t\tfalse\t\t\t\t
"How many products do you own?"\tnumber\t\tfalse\t0\t100\tEnter a number\t
"Any additional feedback?"\tparagraph\t\tfalse\t\t\tShare your detailed thoughts...\t0`;

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

/**
 * POST /api/surveys/import/preview
 * Parse an uploaded survey file and return structured preview data.
 */
export const previewImport = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE',
      message: 'No file provided. Please upload a JSON, CSV, or TSV file.',
    });
  }

  const { originalname, buffer, mimetype } = req.file;
  const content = buffer.toString('utf-8');

  // Detect format from filename extension (more reliable than MIME)
  const format = detectFormatFromFilename(originalname);

  let result;
  if (format === 'json' || mimetype === 'application/json') {
    result = parseJSONFile(content);
  } else {
    // CSV, TSV, or unknown — parse as delimited text
    result = parseSpreadsheetFile(content);
  }

  // If there are fatal errors and no questions, return 422
  if (result.errors.length > 0 && result.questions.length === 0) {
    return res.status(422).json({
      success: false,
      ...result,
    });
  }

  return res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * GET /api/surveys/import/samples/:format
 * Serve a downloadable sample template file.
 */
export const getSampleTemplate = asyncHandler(async (req, res) => {
  const { format } = req.params;

  switch (format) {
    case 'json':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="survey_template.json"');
      return res.send(SAMPLE_JSON);

    case 'csv':
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="survey_template.csv"');
      return res.send(SAMPLE_CSV);

    case 'tsv':
      res.setHeader('Content-Type', 'text/tab-separated-values');
      res.setHeader('Content-Disposition', 'attachment; filename="survey_template.tsv"');
      return res.send(SAMPLE_TSV);

    default:
      return res.status(400).json({
        success: false,
        error: 'INVALID_FORMAT',
        message: `Unsupported format "${format}". Use json, csv, or tsv.`,
      });
  }
});
