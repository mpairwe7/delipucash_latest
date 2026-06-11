/**
 * Regression tests for survey import preview (POST /api/surveys/import/preview).
 *
 * Locks the creation-PR-2 import behaviour:
 *  - Question types are NORMALIZED through the shared vocabulary on import
 *    (multiple_choice→radio, textarea→paragraph, nps/slider→rating), matching
 *    the creation paths — previously import had its own list and coerced legacy
 *    aliases to "text".
 *  - Real .xlsx (binary) is rejected with a clear message (there is no
 *    spreadsheet parser — the client no longer offers Excel either).
 *  - CSV and JSON parse to the renderer vocabulary.
 *
 * The controller has no Prisma dependency (pure parsing), so no mocks needed.
 */
import { test, expect } from 'bun:test';
import { previewImport } from '../controllers/surveyImportController.mjs';

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
function fileReq(name, content, mimetype = 'text/csv') {
  return { file: { originalname: name, buffer: Buffer.from(content, 'utf-8'), mimetype } };
}
const next = (err) => { if (err) throw err; };

test('CSV import normalizes legacy aliases to the renderer vocabulary', async () => {
  const csv =
    'text,type,options,required\n' +
    '"Pick one",multiple_choice,"A|B|C",true\n' +
    '"Tell us more",textarea,,false\n' +
    '"Rate us",nps,,true';
  const res = makeRes();
  await previewImport(fileReq('survey.csv', csv), res, next);

  expect(res.statusCode).toBe(200);
  const types = res.body.questions.map((q) => q.type);
  expect(types).toEqual(['radio', 'paragraph', 'rating']);
});

test('JSON import normalizes aliases too', async () => {
  const json = JSON.stringify({
    title: 'T',
    questions: [
      { text: 'Pick', type: 'multiple_choice', options: ['A', 'B'] },
      { text: 'Slide', type: 'slider' },
    ],
  });
  const res = makeRes();
  await previewImport(fileReq('survey.json', json, 'application/json'), res, next);

  expect(res.statusCode).toBe(200);
  expect(res.body.questions.map((q) => q.type)).toEqual(['radio', 'rating']);
});

test('an unknown type still falls back to text with a warning', async () => {
  const csv = 'text,type\n"Hmm",hologram';
  const res = makeRes();
  await previewImport(fileReq('survey.csv', csv), res, next);

  expect(res.statusCode).toBe(200);
  expect(res.body.questions[0].type).toBe('text');
  expect(res.body.warnings.join(' ')).toMatch(/hologram/i);
});

test('a binary (.xlsx) upload is rejected with a clear message — no Excel parser', async () => {
  // Real .xlsx is a zip; the null byte trips the binary guard.
  const res = makeRes();
  await previewImport(
    { file: { originalname: 'survey.xlsx', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01]), mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } },
    res, next,
  );

  expect(res.statusCode).toBe(400);
  expect(res.body.message).toMatch(/binary|unsupported encoding/i);
});

test('a quoted CSV cell spanning multiple lines stays one field', async () => {
  // The OLD hand-rolled client parser split on \n first and would have broken
  // this; the server parser handles it. (Client parity is papaparse.)
  const csv = 'text,type\n"Line one\nLine two",paragraph';
  const res = makeRes();
  await previewImport(fileReq('survey.csv', csv), res, next);

  expect(res.statusCode).toBe(200);
  expect(res.body.questions).toHaveLength(1);
  expect(res.body.questions[0].text).toContain('Line one');
  expect(res.body.questions[0].text).toContain('Line two');
});
