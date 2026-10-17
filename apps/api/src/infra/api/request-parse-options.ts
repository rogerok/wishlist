import type { SchemaAST } from 'effect';

// Тело запроса разбирается строго (ADR-0007): все ошибки сразу, лишнее поле — отказ 400.
// С effect 4.0.4 настройки разбора задаются на HttpApi через HttpApi.PayloadParseOptions;
// аннотация parseOptions на самой схеме больше не действует.
export const requestParseOptions = {
  errors: 'all',
  onExcessProperty: 'error',
} as const satisfies SchemaAST.ParseOptions;
