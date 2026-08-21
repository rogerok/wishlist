import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import {
  healthCollectionPath,
  healthGroupIdentifier,
} from '#modules/health/api/health.constants.js';
import { HealthOperation } from '#modules/health/schemas/health-operation.schema.js';
import { HealthResponseBodySchema } from '#modules/health/schemas/health.schema.js';

export const healthGroup = HttpApiGroup.make(healthGroupIdentifier).add(
  HttpApiEndpoint.get(HealthOperation.get, healthCollectionPath, {
    success: HealthResponseBodySchema,
  }),
);
