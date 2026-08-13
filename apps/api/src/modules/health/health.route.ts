import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { HealthResponseSchema } from '#modules/health/schemas/health.schema.js';

export const healthGroup = HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('get', '/health', {
    success: HealthResponseSchema,
  }),
);
