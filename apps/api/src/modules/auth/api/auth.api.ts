import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi';

import { asProblemJson } from '#errors/http-problem.js';
import {
  authGroupIdentifier,
  authLoginPath,
  authLogoutPath,
  authMePath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthInvalidCredentialsHttpError,
  AuthUnauthenticatedHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import {
  LoginRequestBodySchema,
  LoginResponseBodySchema,
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
      AuthInternalHttpError.pipe(asProblemJson),
      AuthUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.post(AuthOperation.login, authLoginPath, {
    payload: LoginRequestBodySchema,
    success: LoginResponseBodySchema,
    error: [
      AuthInvalidCredentialsHttpError.pipe(asProblemJson),
      AuthInternalHttpError.pipe(asProblemJson),
      AuthUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.get(AuthOperation.me, authMePath, {
    success: MeResponseBodySchema,
    error: [
      AuthUnauthenticatedHttpError.pipe(asProblemJson),
      AuthInternalHttpError.pipe(asProblemJson),
      AuthUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.post(AuthOperation.logout, authLogoutPath, {
    success: HttpApiSchema.NoContent,
    error: [AuthUnavailableHttpError.pipe(asProblemJson)],
  }),
);
