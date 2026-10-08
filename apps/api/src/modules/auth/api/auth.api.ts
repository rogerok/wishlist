import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi';

import { asProblemJson } from '#infra/errors/http-problem.js';
import { technicalHttpErrors } from '#infra/errors/technical-http-errors.js';
import {
  authGroupIdentifier,
  authLoginPath,
  authLogoutPath,
  authMePath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInvalidCredentialsHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { SessionAuthentication } from '#modules/auth/api/session-authentication.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import {
  LoginRequestBodySchema,
  LoginResponseSuccessSchema,
} from '#modules/auth/schemas/login/login.schema.js';
import { MeResponseBodySchema } from '#modules/auth/schemas/me/me.schema.js';
import {
  SignupRequestBodySchema,
  SignupResponseSuccessSchema,
} from '#modules/auth/schemas/signup/signup.schema.js';

export const authGroup = HttpApiGroup.make(authGroupIdentifier).add(
  HttpApiEndpoint.post(AuthOperation.signup, authSignupPath, {
    payload: SignupRequestBodySchema,
    success: SignupResponseSuccessSchema,
    error: [
      AuthEmailAlreadyExistsHttpError.pipe(asProblemJson),
      ...technicalHttpErrors,
    ],
  }),
  HttpApiEndpoint.post(AuthOperation.login, authLoginPath, {
    payload: LoginRequestBodySchema,
    success: LoginResponseSuccessSchema,
    error: [
      AuthInvalidCredentialsHttpError.pipe(asProblemJson),
      ...technicalHttpErrors,
    ],
  }),
  HttpApiEndpoint.get(AuthOperation.me, authMePath, {
    success: MeResponseBodySchema,
  }).middleware(SessionAuthentication),
  HttpApiEndpoint.post(AuthOperation.logout, authLogoutPath, {
    success: HttpApiSchema.NoContent,
    error: technicalHttpErrors,
  }),
);
