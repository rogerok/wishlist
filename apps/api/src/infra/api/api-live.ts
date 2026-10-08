import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#infra/api/api.js';
import { DefectBoundaryMiddlewareLive } from '#infra/errors/defect-boundary.js';
import { RequestValidationMiddlewareLive } from '#infra/errors/request-validation.js';
import {
  AuthHandlersLive,
  SessionAuthenticationLive,
} from '#modules/auth/handlers/auth.handlers.js';
import { HealthApiLive } from '#modules/health/handlers/health.handlers.js';
import { UsersHandlersLive } from '#modules/users/handlers/users.handlers.js';

const groupsLive = Layer.mergeAll(
  HealthApiLive,
  UsersHandlersLive,
  AuthHandlersLive,
);
const groupsLiveWithMiddleware = groupsLive.pipe(
  Layer.provide([
    DefectBoundaryMiddlewareLive,
    RequestValidationMiddlewareLive,
    SessionAuthenticationLive,
  ]),
);

export const AppApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(groupsLiveWithMiddleware),
);
