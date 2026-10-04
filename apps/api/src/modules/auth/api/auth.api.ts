import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { asProblemJson } from '#infra/errors/http-problem.js';
import {
  authGroupIdentifier,
  authLoginPath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import {
  AuthEmailAlreadyExistsHttpError,
  AuthInternalHttpError,
  AuthInvalidCredentialsHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import {
  LoginRequestBodySchema,
  LoginResponseSuccessSchema,
} from '#modules/auth/schemas/login/login.schema.js';
import {
  SignupRequestBodySchema,
  SignupResponseSuccessSchema,
} from '#modules/auth/schemas/signup/signup.schema.js';

const authCommonErrors = [
  AuthInternalHttpError.pipe(asProblemJson),
  AuthUnavailableHttpError.pipe(asProblemJson),
];

export const authGroup = HttpApiGroup.make(authGroupIdentifier).add(
  HttpApiEndpoint.post(AuthOperation.signup, authSignupPath, {
    payload: SignupRequestBodySchema,
    success: SignupResponseSuccessSchema,
    error: [
      AuthEmailAlreadyExistsHttpError.pipe(asProblemJson),
      ...authCommonErrors,
    ],
  }),
  HttpApiEndpoint.post(AuthOperation.login, authLoginPath, {
    payload: LoginRequestBodySchema,
    success: LoginResponseSuccessSchema,
    error: [
      AuthInvalidCredentialsHttpError.pipe(asProblemJson),
      ...authCommonErrors,
    ],
  }),
  // HttpApiEndpoint.get(AuthOperation.me, authMePath, {
  //   success: MeResponseBodySchema,
  //   error: [
  //     AuthUnauthenticatedHttpError.pipe(asProblemJson),
  //     AuthInternalHttpError.pipe(asProblemJson),
  //     AuthUnavailableHttpError.pipe(asProblemJson),
  //   ],
  // }),
  // HttpApiEndpoint.post(AuthOperation.logout, authLogoutPath, {
  //   success: HttpApiSchema.NoContent,
  //   error: [AuthUnavailableHttpError.pipe(asProblemJson)],
  // }),
);
