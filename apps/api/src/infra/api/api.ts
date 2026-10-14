import { HttpApi } from 'effect/http-api';

import { requestParseOptions } from '#infra/api/request-parse-options.js';
import { DefectBoundaryMiddleware } from '#infra/errors/defect-boundary.js';
import { RequestValidationMiddleware } from '#infra/errors/request-validation.js';
import { authGroup } from '#modules/auth/api/auth.api.js';
import { healthGroup } from '#modules/health/api/health.api.js';
import { usersGroup } from '#modules/users/api/users.api.js';

export const AppApi = HttpApi.make('app')
  .annotate(HttpApi.PayloadParseOptions, requestParseOptions)
  .add(healthGroup)
  .add(usersGroup)
  .add(authGroup)
  .middleware(RequestValidationMiddleware)
  .middleware(DefectBoundaryMiddleware);
