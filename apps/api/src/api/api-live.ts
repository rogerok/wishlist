import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { AppApi } from '#api/api.js';
import { HealthApiLive } from '#modules/health/health.handlers.js';
import { UsersApiLive } from '#modules/users/users.handlers.js';

export const AppApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(Layer.mergeAll(HealthApiLive, UsersApiLive)),
);
