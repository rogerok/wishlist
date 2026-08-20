import globals from 'globals';

import { config as baseConfig } from './base.js';

/** @type {import("eslint").Linter.Config[]} */
export const nodeConfig = [
  ...baseConfig,
  {
    files: ['**/*.{ts,cts,mts,js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.{ts,cts,mts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
    },
  },
];
