import { Clock, Context, Effect, Layer, Match, Redacted } from 'effect';
import { isSqlError } from 'effect/unstable/sql/SqlError';

import type {
  SignupInput,
  SignupResult,
} from '#modules/auth/schemas/signup/signup.schema.js';
import type {
  AuthSignupError,
  SignupOperationError,
} from '#modules/auth/service/auth.service.errors.js';

import { DB } from '#infra/db/db.service.js';
import { PasswordCredentialsRepository } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepository } from '#modules/auth/repository/session/sesion.repository.js';
import {
  AuthEmailAlreadyExistsError,
  AuthInternalError,
  AuthUnavailableError,
} from '#modules/auth/service/auth.service.errors.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';
import { PasswordHasher } from '#modules/auth/service/password/password-hasher.service.js';
import { SessionTokenGenerator } from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';

const mapSignupSqlError = (
  sqlCause: unknown,
  originalError: SignupOperationError,
): AuthInternalError | AuthUnavailableError =>
  isSqlError(sqlCause) && sqlCause.isRetryable
    ? new AuthUnavailableError({ cause: originalError })
    : new AuthInternalError({ cause: originalError });

const mapSignupError = (error: SignupOperationError): AuthSignupError =>
  Match.value(error).pipe(
    Match.tag(
      'UserEmailAlreadyExists',
      (cause) => new AuthEmailAlreadyExistsError({ cause }),
    ),

    Match.tag(
      'PasswordHashOverloadedError',
      'SecurePrimitiveUnavailableError',
      (cause) => new AuthUnavailableError({ cause }),
    ),

    Match.tag(
      'InvalidUserRecord',
      'PasswordCredentialsInvalidRecord',
      'SessionInvalidRecordError',
      'PasswordHashIntegrityError',
      'PasswordCredentialsAlreadyExists',
      'SessionTokenDigestAlreadyExistsError',
      (cause) => new AuthInternalError({ cause }),
    ),

    Match.tag(
      'UsersRepositoryError',
      'PasswordCredentialsRepositoryError',
      'SessionRepositoryError',
      (cause) => mapSignupSqlError(cause.cause, cause),
    ),

    Match.tag('SqlError', (cause) => mapSignupSqlError(cause, cause)),

    Match.exhaustive,
  );

interface AuthServiceShape {
  signup: (input: SignupInput) => Effect.Effect<SignupResult, AuthSignupError>;
}

export class AuthService extends Context.Service<
  AuthService,
  AuthServiceShape
>()('app/AuthService') {}

export const AuthServiceLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const db = yield* DB;
    const usersRepo = yield* UsersRepository;
    const passwordRepo = yield* PasswordCredentialsRepository;
    const sessionRepo = yield* SessionRepository;
    const hasher = yield* PasswordHasher;
    const tokenGenerator = yield* SessionTokenGenerator;

    const signup: AuthServiceShape['signup'] = ({
      password,
      email,
      lastName,
      firstName,
      middleName,
    }) =>
      Effect.gen(function* () {
        const passwordHash = yield* hasher.hash(Redacted.make(password));
        const { credential, digest } = yield* tokenGenerator.generate;

        const { user, expiresAt } = yield* db.withTransaction(
          Effect.gen(function* () {
            const user = yield* usersRepo.create({
              email,
              firstName,
              middleName,
              lastName,
            });

            yield* passwordRepo.create(user.id, passwordHash);

            const now = yield* Clock.currentTimeMillis;
            const expiresAt = new Date(now + sessionLifetimeMs);

            const session = yield* sessionRepo.create(
              user.id,
              digest,
              expiresAt,
            );

            return { user, expiresAt: session.expiresAt };
          }),
        );

        return { user, credential, expiresAt };
      }).pipe(Effect.mapError(mapSignupError));

    return { signup };
  }),
);
