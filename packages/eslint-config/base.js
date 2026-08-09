import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import sonarjs from 'eslint-plugin-sonarjs';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import noComplexInlineType from './no-complex-inline-type.mjs';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    plugins: {
      onlyWarn,
      local: {
        rules: {
          'no-complex-inline-type': noComplexInlineType,
        },
      },
    },
  },
  {
    ignores: ['**/coverage/**', '**/dist/**', 'no-complex-inline-type.mjs'],
  },
  {
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-enums': 'warn',
      'perfectionist/sort-exports': 'warn',
      'perfectionist/sort-imports': 'warn',
      'perfectionist/sort-interfaces': [
        'warn',
        {
          groups: ['required-property', 'optional-property'],
          order: 'asc',
        },
      ],
      'perfectionist/sort-intersection-types': 'warn',
      'perfectionist/sort-named-imports': 'warn',
      'perfectionist/sort-object-types': [
        'warn',
        {
          groups: ['required-property', 'optional-property'],
          order: 'asc',
        },
      ],
      'perfectionist/sort-union-types': [
        'warn',
        {
          groups: [
            'conditional',
            'function',
            'import',
            'intersection',
            'named',
            'object',
            'operator',
            'literal',
            'keyword',
            'tuple',
            'union',
            'nullish',
          ],
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-commented-code': 'warn',
      'sonarjs/no-dead-store': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-empty-test-file': 'off',
    },
  },
];
