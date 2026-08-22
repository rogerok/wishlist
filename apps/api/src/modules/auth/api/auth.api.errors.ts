import { Schema } from 'effect';

import {
  authLoginPath,
  authLogoutPath,
  authMePath,
  authSignupPath,
} from '#modules/auth/api/auth.api.constants.js';
import { makeLiteralUnionSchema } from '#schemas/utils.js';

export const AuthInstanceErrors = makeLiteralUnionSchema([
  authSignupPath,
  authLoginPath,
  authLogoutPath,
  authMePath,
]);

export class AuthEmailAlreadyExistsHttpError extends Schema.Error<AuthEmailAlreadyExistsHttpError>(
  'AuthEmailAlreadyExistsHttpError',
)(
  {
    code: Schema.tag('USER_EMAIL_ALREADY_EXISTS'),
    detail: Schema.tag('A user with this email already exists'),
    status: Schema.tag(409),
    title: Schema.tag('User email already exists'),
    type: Schema.tag('/errors/user-email-already-exists'),
    instance: Schema.tag(authSignupPath),
  },
  {
    httpApiStatus: 409,
  },
) {}

export class AuthUnavailableHttpError extends Schema.Error<AuthUnavailableHttpError>(
  'AuthUnavailableHttpError',
)(
  {
    code: Schema.tag('AUTH_UNAVAILABLE'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(503),
    title: Schema.tag('Auth service is unavailable'),
    type: Schema.tag('/errors/auth-unavailable'),
    instance: AuthInstanceErrors,
  },
  {
    httpApiStatus: 503,
  },
) {}

export class AuthInternalHttpError extends Schema.Error<AuthInternalHttpError>(
  'AuthInternalHttpError',
)(
  {
    code: Schema.tag('AUTH_INTERNAL_ERROR'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(500),
    title: Schema.tag('Internal auth service error'),
    type: Schema.tag('/errors/auth-internal-error'),
    instance: AuthInstanceErrors,
  },
  {
    httpApiStatus: 500,
  },
) {}

export class AuthInvalidCredentialsHttpError extends Schema.Error<AuthInvalidCredentialsHttpError>(
  'AuthInvalidCredentialsHttpError',
)(
  {
    code: Schema.tag('AUTH_INVALID_CREDENTIALS'),
    detail: Schema.tag('Invalid email or password'),
    status: Schema.tag(401),
    title: Schema.tag('Invalid credentials'),
    type: Schema.tag('/errors/auth-invalid-credentials'),
    instance: Schema.tag(authLoginPath),
  },
  {
    httpApiStatus: 401,
  },
) {}

export class AuthUnauthenticatedHttpError extends Schema.Error<AuthUnauthenticatedHttpError>(
  'AuthUnauthenticatedHttpError',
)(
  {
    code: Schema.tag('AUTH_INVALID_SESSION'),
    detail: Schema.tag('Session is invalid'),
    status: Schema.tag(401),
    title: Schema.tag('Invalid session'),
    type: Schema.tag('/errors/auth-invalid-session'),
    instance: Schema.tag(authMePath),
  },
  {
    httpApiStatus: 401,
  },
) {}
