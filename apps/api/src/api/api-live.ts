import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import { RequestValidationMiddlewareLive } from '#errors/request-validation.js';
import { HealthApiLive } from '#modules/health/handlers/health.handlers.js';
import { UsersHandlersLive } from '#modules/users/handlers/users.handlers.js';

const groupsLive = Layer.mergeAll(HealthApiLive, UsersHandlersLive);
const groupsLiveWithMiddleware = groupsLive.pipe(
  Layer.provide(RequestValidationMiddlewareLive),
);

export const AppApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(groupsLiveWithMiddleware),
);
