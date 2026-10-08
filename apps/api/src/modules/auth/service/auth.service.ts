import {
  Clock,
  Context,
  Effect,
  Layer,
  Match,
  Option,
  Redacted,
  Result,
  Schema,
} from 'effect';

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
import type {
  AuthAuthenticateError,
  AuthenticateOperationError,
  AuthLoginError,
  AuthSignupError,
  AuthTechnicalError,
  LoginOperationError,
  LogoutOperationError,
  SignupOperationError,
} from '#modules/auth/service/auth.service.errors.js';

import { DB } from '#infra/db/db.service.js';
import { isRetryableSqlFailure } from '#infra/db/sql-failure.js';
import { PasswordCredentialsRepository } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepository } from '#modules/auth/repository/session/sesion.repository.js';
import { AuthTokenSchema } from '#modules/auth/schemas/auth.schema.js';
import {
  AuthDataIntegrityError,
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
// Строка для фиктивного хэша. Совпадение с ней ничего не даёт
const dummyHashInput = 'wishlist-dummy-password';

const unAuthenticatedError = new AuthUnauthenticatedError({
  cause: `Can't authenticate`,
});

// PasswordHashIntegrityError означает разное в разных операциях, поэтому его
// сопоставляют mapSignupError и mapLoginError
type TechnicalOperationError = Exclude<
  | AuthenticateOperationError
  | LoginOperationError
  | LogoutOperationError
  | SignupOperationError,
  {
    readonly _tag:
      | 'AuthInvalidCredentialsError'
      | 'AuthUnauthenticatedError'
      | 'PasswordHashIntegrityError'
      | 'SchemaError'
      | 'UserEmailAlreadyExists';
  }
>;

const mapTechnicalError = (
  error: TechnicalOperationError,
): AuthTechnicalError =>
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
      (cause) => new AuthDataIntegrityError({ cause }),
    ),

    Match.tag(
      'PasswordCredentialsAlreadyExists',
      'SessionTokenDigestAlreadyExistsError',
      (cause) => new AuthInternalError({ cause }),
    ),

    Match.tag(
      'SqlError',
      'UsersRepositoryError',
      'PasswordCredentialsRepositoryError',
      'SessionRepositoryError',
      (cause) =>
        isRetryableSqlFailure(cause)
          ? new AuthUnavailableError({ cause })
          : new AuthInternalError({ cause }),
    ),

    Match.exhaustive,
  );

const mapSignupError = (error: SignupOperationError): AuthSignupError =>
  Match.value(error).pipe(
    Match.tag(
      'UserEmailAlreadyExists',
      (cause) => new AuthEmailAlreadyExistsError({ cause }),
    ),
    // При signup хэш только что посчитан: неверная длина его частей — ошибка кода.
    Match.tag(
      'PasswordHashIntegrityError',
      (cause) => new AuthInternalError({ cause }),
    ),
    Match.orElse(mapTechnicalError),
  );

const mapLoginError = (error: LoginOperationError): AuthLoginError =>
  Match.value(error).pipe(
    Match.tag('AuthInvalidCredentialsError', (cause) => cause),
    // При login хэш прочитан из базы: не разбирается — значит, запись повреждена.
    Match.tag(
      'PasswordHashIntegrityError',
      (cause) => new AuthDataIntegrityError({ cause }),
    ),
    Match.orElse(mapTechnicalError),
  );

const mapAuthenticateError = (
  error: AuthenticateOperationError,
): AuthAuthenticateError =>
  Match.value(error).pipe(
    Match.tag(
      'SchemaError',
      (cause) => new AuthUnauthenticatedError({ cause }),
    ),
    Match.tag('AuthUnauthenticatedError', (cause) => cause),
    Match.orElse(mapTechnicalError),
  );

interface AuthServiceShape {
  authenticate: (
    credential: Redacted.Redacted,
  ) => Effect.Effect<AuthenticatedSession, AuthAuthenticateError>;
  login: (
    input: LoginRequestBody,
  ) => Effect.Effect<LoginResult, AuthLoginError>;
  logout: (
    credential: Redacted.Redacted,
  ) => Effect.Effect<void, AuthTechnicalError>;
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

    const dummyPasswordHash: StoredPasswordHash = yield* hasher.hash(
      Redacted.make(dummyHashInput),
    );

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
      }).pipe(Effect.mapError(mapLoginError));

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
      }).pipe(Effect.mapError(mapAuthenticateError));

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
      }).pipe(Effect.mapError(mapTechnicalError));

    return { signup, login, authenticate, logout };
  }),
);
