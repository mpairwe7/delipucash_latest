// ESLint 9 flat config for the server (ESM Node/Express on Bun).
// Correctness-focused baseline: @eslint/js recommended with pragmatic tuning for
// an existing codebase — unused vars are errors (underscore-prefix to opt out),
// stylistic churn is avoided. Run with `bun run lint`.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'public/**',
      'lib/generated/**', // prisma client output, if generated in-tree
      '.vercel/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        Bun: 'readonly',
      },
    },
    rules: {
      // Underscore-prefix to intentionally keep an unused binding (e.g. `_next`
      // in Express error middleware, destructure-and-drop patterns).
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Empty catch is an established pattern here for best-effort cleanup.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // bun test files use Bun's jest-compatible globals.
    files: ['test/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        mock: 'readonly',
      },
    },
  },
];
