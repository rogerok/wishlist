import { Schema } from 'effect';

import { asProblemJson, domainProblem } from '#infra/errors/http-problem.js';
import {
  authLoginPath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import { AuthInvalidCredentialsError } from '#modules/auth/service/auth.service.errors.js';
import { makeEmailAlreadyExistsBody } from '#modules/users/api/users.api.errors.js';
import { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

const SignupEmailAlreadyExistsBody = makeEmailAlreadyExistsBody(authSignupPath);

export const SignupEmailAlreadyExistsProblem = domainProblem({
  body: SignupEmailAlreadyExistsBody,
  error: UserEmailAlreadyExistsError,
  status: 409,
  decode: () => new UserEmailAlreadyExistsError(),
  encode: () => SignupEmailAlreadyExistsBody.make({}),
});

const AuthInvalidCredentialsBody = Schema.Struct({
  code: Schema.tag('AUTH_INVALID_CREDENTIALS'),
  detail: Schema.tag('Invalid email or password'),
  status: Schema.tag(401),
  title: Schema.tag('Invalid credentials'),
  type: Schema.tag('/errors/auth-invalid-credentials'),
  instance: Schema.tag(authLoginPath),
});

export const AuthInvalidCredentialsProblem = domainProblem({
  body: AuthInvalidCredentialsBody,
  error: AuthInvalidCredentialsError,
  status: 401,
  decode: () => new AuthInvalidCredentialsError(),
  encode: () => AuthInvalidCredentialsBody.make({}),
});

// 401 любого маршрута под SessionAuthentication. Доменная AuthUnauthenticatedError не знает
// адреса запроса, поэтому instance подставляет middleware на границе HTTP.
export class AuthUnauthenticatedHttpError extends Schema.Error<
  AuthUnauthenticatedHttpError,
  { readonly brand: unique symbol }
>('AuthUnauthenticatedHttpError')(
  {
    code: Schema.tag('AUTH_INVALID_SESSION'),
    detail: Schema.tag('Session is invalid'),
    status: Schema.tag(401),
    title: Schema.tag('Invalid session'),
    type: Schema.tag('/errors/auth-invalid-session'),
    instance: Schema.String,
  },
  {
    httpApiStatus: 401,
  },
) {}

export const AuthUnauthenticatedProblem =
  AuthUnauthenticatedHttpError.pipe(asProblemJson);
