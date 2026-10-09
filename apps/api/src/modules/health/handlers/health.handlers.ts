import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#infra/api/api.js';
import { healthGroupIdentifier } from '#modules/health/api/health.constants.js';
import { HealthOperation } from '#modules/health/schemas/health-operation.schema.js';
import { HealthService } from '#modules/health/service/health.service.js';

export const HealthApiLive = HttpApiBuilder.group(
  AppApi,
  healthGroupIdentifier,
  (handlers) =>
    handlers.handle(HealthOperation.get, () =>
      Effect.gen(function* () {
        const service = yield* HealthService;

        return yield* service.get;
      }),
    ),
);
