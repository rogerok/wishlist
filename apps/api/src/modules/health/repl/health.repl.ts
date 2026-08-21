import { Effect } from 'effect';

import type { HealthResponseBody } from '#modules/health/schemas/health.schema.js';
import type { RunPromise } from '#repl/repl.types.js';

import { HealthService } from '#modules/health/service/health.service.js';

export interface HealthReplFacade {
  readonly get: () => Promise<HealthResponseBody>;
}

export const makeHealthRepl = (
  runPromise: RunPromise,
): Effect.Effect<HealthReplFacade, never, HealthService> =>
  Effect.gen(function* () {
    const service = yield* HealthService;

    return { get: () => runPromise(service.get) };
  });
