import { Effect } from 'effect';
import { inspect } from 'node:util';

const consoleMethods = [
  'debug',
  'error',
  'info',
  'log',
  'trace',
  'warn',
] as const;

// Для тестов: стандартный HTTP-лог Effect пишет в console, а не в logger теста.
// Возвращает собранный вывод; после закрытия scope console восстанавливается.
export const captureConsole = Effect.acquireRelease(
  Effect.sync(() => {
    const output: Array<string> = [];
    const originals = consoleMethods.map(
      (method) => [method, console[method]] as const,
    );

    for (const method of consoleMethods) {
      console[method] = (...args: Array<unknown>) => {
        output.push(args.map((arg) => inspect(arg, { depth: 10 })).join(' '));
      };
    }

    return { output, originals };
  }),
  ({ originals }) =>
    Effect.sync(() => {
      for (const [method, original] of originals) {
        console[method] = original;
      }
    }),
).pipe(Effect.map(({ output }) => output));
