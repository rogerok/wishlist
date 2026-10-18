import {
  Clock,
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Result,
  Schema,
} from 'effect';

import type { FailureReason } from '#infra/errors/operation-failed.js';
import type {
  LoginRequestBody,
  LoginResult,
} from '#modules/auth/schemas/login/login.schema.js';
import type { StoredPasswordHash } from '#modules/auth/schemas/password/password-hash.schema.js';
import type { AuthenticatedSession } from '#modules/auth/schemas/session/authenticated-session.schema.js';
import type {
  SignupInput,
  SignupResult,
} from '#modules/auth/schemas/signup/signup.schema.js';
import type { UserEmailAlreadyExistsError } from '#modules/users/users.errors.js';

import { DB } from '#infra/db/db.service.js';
import { sqlOperationFailed } from '#infra/db/repository-failure.js';
import { OperationFailed } from '#infra/errors/operation-failed.js';
import { PasswordCredentialsRepository } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepository } from '#modules/auth/repository/session/sesion.repository.js';
import { AuthOperation } from '#modules/auth/schemas/auth-operations.schema.js';
import { AuthTokenSchema } from '#modules/auth/schemas/auth.schema.js';
import {
  AuthInvalidCredentialsError,
  AuthUnauthenticatedError,
} from '#modules/auth/service/auth.service.errors.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';
import { PasswordHasher } from '#modules/auth/service/password/password-hasher.service.js';
import {
  digestSessionToken,
  SessionTokenGenerator,
} from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';

const invalidCredentialsError = new AuthInvalidCredentialsError();
// Строка для фиктивного хэша. Совпадение с ней ничего не даёт
const dummyHashInput = 'wishlist-dummy-password';

const unAuthenticatedError = new AuthUnauthenticatedError();

const source = 'authService';

// Отказы, смысл которых известен только AuthService
const failedIn =
  (operation: AuthOperation, reason: FailureReason) => (cause: unknown) =>
    new OperationFailed({ reason, source, operation, cause });

interface AuthServiceShape {
  authenticate: (
    credential: Redacted.Redacted,
  ) => Effect.Effect<
    AuthenticatedSession,
    AuthUnauthenticatedError | OperationFailed
  >;
  login: (
    input: LoginRequestBody,
  ) => Effect.Effect<
    LoginResult,
    AuthInvalidCredentialsError | OperationFailed
  >;
  logout: (
    credential: Redacted.Redacted,
  ) => Effect.Effect<void, OperationFailed>;
  signup: (
    input: SignupInput,
  ) => Effect.Effect<
    SignupResult,
    OperationFailed | UserEmailAlreadyExistsError
  >;
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

    const dummyPasswordHash: StoredPasswordHash = yield* hasher.hash(
      Redacted.make(dummyHashInput),
    );

    const signup: AuthServiceShape['signup'] = ({
      password,
      email,
      displayName,
    }) =>
      Effect.gen(function* () {
        const passwordHash = yield* hasher.hash(Redacted.make(password));
        const { credential, digest } = yield* tokenGenerator.generate;

        const { user, expiresAt } = yield* db.withTransaction(
          Effect.gen(function* () {
            const createdUser = yield* usersRepo.create({
              email,
              displayName,
            });

            yield* passwordRepo.create(createdUser.id, passwordHash);

            const now = yield* Clock.currentTimeMillis;
            const requestedExpiresAt = new Date(now + sessionLifetimeMs);

            const session = yield* sessionRepo.create(
              createdUser.id,
              digest,
              requestedExpiresAt,
            );

            return { user: createdUser, expiresAt: session.expiresAt };
          }),
        );

        return { user, credential, expiresAt };
      }).pipe(
        Effect.catchTags({
          PasswordHashIntegrityError: failedIn(
            AuthOperation.signup,
            'internal',
          ),
          PasswordCredentialsAlreadyExists: failedIn(
            AuthOperation.signup,
            'internal',
          ),
          SessionTokenDigestAlreadyExistsError: failedIn(
            AuthOperation.signup,
            'internal',
          ),
          SqlError: sqlOperationFailed(source, AuthOperation.signup),
        }),
      );

    const login: AuthServiceShape['login'] = (input) =>
      Effect.gen(function* () {
        const user = yield* usersRepo.getByEmail(input.email);
        const passCreds = Option.isSome(user)
          ? yield* passwordRepo.getByUserId(user.value.id)
          : Option.none();

        const verified = yield* hasher.verify(
          Redacted.make(input.password),
          passCreds.pipe(
            Option.map((creds) => creds.passwordHash),
            Option.getOrElse(() => dummyPasswordHash),
          ),
        );

        // Отказать, если User или Password Credential нет, даже когда фиктивная проверка совпала
        if (Option.isNone(user) || Option.isNone(passCreds) || !verified) {
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
      }).pipe(
        Effect.catchTags({
          PasswordHashIntegrityError: failedIn(
            AuthOperation.login,
            'dataIntegrity',
          ),
          SessionTokenDigestAlreadyExistsError: failedIn(
            AuthOperation.login,
            'internal',
          ),
        }),
      );

    const authenticate: AuthServiceShape['authenticate'] = (credential) =>
      Effect.gen(function* () {
        const decodedCred = yield* Schema.decodeEffect(AuthTokenSchema)(
          Redacted.value(credential),
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
      }).pipe(Effect.catchTag('SchemaError', () => unAuthenticatedError));

    const logout: AuthServiceShape['logout'] = (credential) =>
      Effect.gen(function* () {
        const decodedCred = Schema.decodeResult(AuthTokenSchema)(
          Redacted.value(credential),
        );

        if (Result.isFailure(decodedCred)) {
          return yield* Effect.void;
        }

        return yield* sessionRepo.deleteByTokenDigest(
          digestSessionToken(decodedCred.success),
        );
      });

    return { signup, login, authenticate, logout };
  }),
);
