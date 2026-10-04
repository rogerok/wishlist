import {
  Clock,
  Context,
  Effect,
  Layer,
  Match,
  Option,
  Redacted,
  Schema,
} from 'effect';
import { isSqlError } from 'effect/unstable/sql/SqlError';

import type {
  LoginRequestBody,
  LoginResult,
} from '#modules/auth/schemas/login/login.schema.js';
import type { AuthenticatedSession } from '#modules/auth/schemas/session/authenticated-session.schema.js';
import type {
  SignupInput,
  SignupResult,
} from '#modules/auth/schemas/signup/signup.schema.js';
import type {
  AuthAuthenticateError,
  AuthenticateOperationError,
  AuthLoginError,
  AuthSignupError,
  LoginOperationError,
  SignupOperationError,
} from '#modules/auth/service/auth.service.errors.js';

import { DB } from '#infra/db/db.service.js';
import { PasswordCredentialsRepository } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepository } from '#modules/auth/repository/session/sesion.repository.js';
import { AuthTokenSchema } from '#modules/auth/schemas/auth.schema.js';
import {
  AuthEmailAlreadyExistsError,
  AuthInternalError,
  AuthInvalidCredentialsError,
  AuthUnauthenticatedError,
  AuthUnavailableError,
} from '#modules/auth/service/auth.service.errors.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';
import { PasswordHasher } from '#modules/auth/service/password/password-hasher.service.js';
import {
  digestSessionToken,
  SessionTokenGenerator,
} from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';

const invalidCredentialsError = new AuthInvalidCredentialsError({
  cause: 'Invalid credentials',
});
const unAuthenticatedError = new AuthUnauthenticatedError({
  cause: `Can't authenticate`,
});

type TechnicalOperationError = Exclude<
  AuthenticateOperationError | LoginOperationError | SignupOperationError,
  {
    readonly _tag:
      | 'AuthInvalidCredentialsError'
      | 'AuthUnauthenticatedError'
      | 'UserEmailAlreadyExists';
  }
>;

const mapTechnicalError = (
  error: TechnicalOperationError,
): AuthInternalError | AuthUnavailableError =>
  Match.value(error).pipe(
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
      'SqlError',
      'UsersRepositoryError',
      'PasswordCredentialsRepositoryError',
      'SessionRepositoryError',
      (cause) => {
        const sqlCause = isSqlError(cause) ? cause : cause.cause;

        return isSqlError(sqlCause) && sqlCause.isRetryable
          ? new AuthUnavailableError({ cause })
          : new AuthInternalError({ cause });
      },
    ),

    Match.exhaustive,
  );

const mapSignupError = (error: SignupOperationError): AuthSignupError =>
  Match.value(error).pipe(
    Match.tag(
      'UserEmailAlreadyExists',
      (cause) => new AuthEmailAlreadyExistsError({ cause }),
    ),
    Match.orElse(mapTechnicalError),
  );

const mapLoginError = (error: LoginOperationError): AuthLoginError =>
  Match.value(error).pipe(
    Match.tag('AuthInvalidCredentialsError', (error) => error),
    Match.orElse(mapTechnicalError),
  );

const mapAuthenticateError = (
  error: AuthenticateOperationError,
): AuthAuthenticateError =>
  Match.value(error).pipe(
    Match.tag('AuthUnauthenticatedError', (error) => error),
    Match.orElse(mapTechnicalError),
  );

interface AuthServiceShape {
  authenticate: (
    credential: Redacted.Redacted<string>,
  ) => Effect.Effect<AuthenticatedSession, AuthAuthenticateError>;
  login: (
    input: LoginRequestBody,
  ) => Effect.Effect<LoginResult, AuthLoginError>;
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

    const login: AuthServiceShape['login'] = (input) =>
      Effect.gen(function* () {
        const user = yield* usersRepo.getByEmail(input.email);
        if (Option.isNone(user)) {
          return yield* invalidCredentialsError;
        }

        const passCreds = yield* passwordRepo.getByUserId(user.value.id);
        if (Option.isNone(passCreds)) {
          return yield* invalidCredentialsError;
        }

        const verified = yield* hasher.verify(
          Redacted.make(input.password),
          passCreds.value.passwordHash,
        );
        if (!verified) {
          return yield* invalidCredentialsError;
        }

        const { credential, digest } = yield* tokenGenerator.generate;

        const now = yield* Clock.currentTimeMillis;
        const expiresAt = new Date(now + sessionLifetimeMs);

        const session = yield* sessionRepo.create(
          user.value.id,
          digest,
          expiresAt,
        );

        return { user: user.value, expiresAt: session.expiresAt, credential };
      }).pipe(Effect.mapError(mapLoginError));

    const authenticate: AuthServiceShape['authenticate'] = (credential) =>
      Effect.gen(function* () {
        const decodedCred = yield* Schema.decodeEffect(AuthTokenSchema)(
          Redacted.value(credential),
        ).pipe(
          Effect.mapError((cause) => new AuthUnauthenticatedError({ cause })),
        );

        const session = yield* sessionRepo.getByTokenDigest(
          digestSessionToken(decodedCred),
        );
        if (Option.isNone(session)) {
          return yield* unAuthenticatedError;
        }

        const user = yield* usersRepo.getById(session.value.userId);
        if (Option.isNone(user)) {
          return yield* unAuthenticatedError;
        }

        return {
          user: user.value,
          expiresAt: session.value.expiresAt,
          sessionId: session.value.id,
        };
      }).pipe(Effect.mapError(mapAuthenticateError));

    return { signup, login, authenticate };
  }),
);
