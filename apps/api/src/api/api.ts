import { HttpApi } from 'effect/unstable/httpapi';

import { RequestValidationMiddleware } from '#errors/request-validation.js';
import { healthGroup } from '#modules/health/api/health.api.js';
import { usersGroup } from '#modules/users/api/users.api.js';

export const AppApi = HttpApi.make('app')
  .add(healthGroup)
  .add(usersGroup)
  .middleware(RequestValidationMiddleware);
