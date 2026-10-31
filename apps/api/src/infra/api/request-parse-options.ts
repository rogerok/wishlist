import type { SchemaAST } from 'effect';

export const requestParseOptions = {
  errors: 'all',
  onExcessProperty: 'error',
} as const satisfies SchemaAST.ParseOptions;
