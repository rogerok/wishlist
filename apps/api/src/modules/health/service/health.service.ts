import { Effect } from 'effect';
import { Layer } from 'effect';
import { Context } from 'effect';

import type { HealthResponseBody } from '#modules/health/schemas/health.schema.js';

export interface HealthServiceShape {
  readonly get: Effect.Effect<HealthResponseBody>;
}

export class HealthService extends Context.Service<
  HealthService,
  HealthServiceShape
>()('app/HealthService') {}

export const HealthServiceLive = Layer.succeed(HealthService, {
  get: Effect.succeed({
    status: 'OK' as const,
  }),
});
