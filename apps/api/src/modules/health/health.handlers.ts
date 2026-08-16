import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import { HealthResponseSchema } from '#modules/health/schemas/health.schema.js';

const get = () =>
  Effect.succeed(
    HealthResponseSchema.make({
      status: 'OK',
    }),
  );

export const HealthApiLive = HttpApiBuilder.group(
  AppApi,
  'health',
  (handlers) => handlers.handle('get', get),
);
