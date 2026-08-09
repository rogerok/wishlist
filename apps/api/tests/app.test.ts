import { expect, it } from '@effect/vitest';
import { Effect, Exit } from 'effect';

import { program } from '../src/app.js';

it.effect('starts successfully', () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(program);

    expect(result).toStrictEqual(Exit.succeed(undefined));
  }),
);
