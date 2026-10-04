import { Context } from 'effect';
import { HttpApiMiddleware, HttpApiSecurity } from 'effect/unstable/httpapi';

import type { AuthenticatedSession } from '#modules/auth/schemas/session/authenticated-session.schema.js';

import { asProblemJson } from '#infra/errors/http-problem.js';
import {
  AuthInternalHttpError,
  AuthUnauthenticatedHttpError,
  AuthUnavailableHttpError,
} from '#modules/auth/api/auth.api.errors.js';
import { cookieSessionKey } from '#modules/auth/handlers/constants.js';

export const sessionCookieSecurity = HttpApiSecurity.apiKey({
  key: cookieSessionKey,
  in: 'cookie',
});

export class CurrentSession extends Context.Service<
  CurrentSession,
  AuthenticatedSession
>()('app/CurrentSession') {}

export class SessionAuthentication extends HttpApiMiddleware.Service<
  SessionAuthentication,
  { provides: CurrentSession }
>()('app/SessionAuthentication', {
  security: { cookie: sessionCookieSecurity },
  error: [
    AuthUnauthenticatedHttpError.pipe(asProblemJson),
    AuthInternalHttpError.pipe(asProblemJson),
    AuthUnavailableHttpError.pipe(asProblemJson),
  ],
}) {}
