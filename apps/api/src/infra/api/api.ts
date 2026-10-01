import { HttpApi } from 'effect/unstable/httpapi';

import { RequestValidationMiddleware } from '#infra/errors/request-validation.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import { healthGroup } from '#modules/health/api/health.api.js';
import { usersGroup } from '#modules/users/api/users.api.js';

export const AppApi = HttpApi.make('app')
  .add(healthGroup)
  .add(usersGroup)
  .add(authGroup)
  .middleware(RequestValidationMiddleware);
