import { nodeConfig } from '@repo/eslint-config/node';

export default [
  ...nodeConfig,
  {
    files: ['src/patch.types.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
