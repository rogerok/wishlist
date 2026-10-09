import { describe, expect, it } from '@effect/vitest';
import { assertTrue } from '@effect/vitest/utils';
import { Effect, Encoding, Layer, Option, Redacted } from 'effect';
import * as TestClock from 'effect/testing/TestClock';
import { createHash } from 'node:crypto';

import type { DB } from '#infra/db/db.service.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { PasswordCredentialsRepositoryLive } from '#modules/auth/repository/password/password-credentials.repository.js';
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { SessionRepositoryError } from '#modules/auth/repository/session/session.repository.errors.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';
import { SessionIdSchema } from '#modules/auth/schemas/session/session.schema.js';
import { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';
import {
  AuthInternalError,
  AuthUnauthenticatedError,
} from '#modules/auth/service/auth.service.errors.js';
import {
  AuthService,
  AuthServiceLive,
} from '#modules/auth/service/auth.service.js';
import { PasswordHasherLive } from '#modules/auth/service/password/password-hasher.service.js';
import {
  SecureRandomBytesLive,
  SessionTokenGeneratorLive,
} from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepositoryLive } from '#modules/users/repository/users.repository.js';
import {
  UserEmailSchema,
  UserIdSchema,
} from '#modules/users/schemas/user.schema.js';

const DbLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const cryptoLayer = Layer.mergeAll(
  PasswordHasherLive,
  SessionTokenGeneratorLive.pipe(Layer.provide(SecureRandomBytesLive)),
);

const makeAuthLayer = (
  sessionRepo: Layer.Layer<SessionRepository, never, DB>,
) =>
  AuthServiceLive.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.mergeAll(
          UsersRepositoryLive,
          PasswordCredentialsRepositoryLive,
          sessionRepo,
        ).pipe(Layer.provideMerge(DbLayer)),
        cryptoLayer,
      ),
    ),
  );

const authLayer = makeAuthLayer(SessionRepositoryLive);

const sessionsNotQueried = Layer.succeed(SessionRepository, {
  create: () => Effect.die('Should not be used'),
  getByTokenDigest: () => Effect.die('Sessions must not be queried'),
  deleteByTokenDigest: () => Effect.die('Should not be used'),
});

const signupInput = SignupInputSchema.make({
  email: UserEmailSchema.make('test@example.test'),
  password: PasswordSchema.make('Password1!'),
  displayName: 'Test User',
});

const credentialOf = (bytes: Uint8Array) =>
  Redacted.make(Encoding.encodeBase64Url(bytes));

export const digestOf = (credential: Redacted.Redacted<string>) =>
  createHash('sha256')
    .update(Buffer.from(Redacted.value(credential), 'base64url'))
    .digest();

describe('AuthService.authenticate', () => {
  it.effect('rejects a missing credential without querying sessions', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;

      const error = yield* Effect.flip(auth.authenticate(Redacted.make('')));

      expect(error).toBeInstanceOf(AuthUnauthenticatedError);
    }).pipe(Effect.provide(makeAuthLayer(sessionsNotQueried))),
  );

  it.effect(
    'rejects a credential that is not 32 base64url bytes without querying sessions',
    () =>
      Effect.gen(function* () {
        const auth = yield* AuthService;
        const malformed = [
          'abc',
          Encoding.encodeBase64Url(Buffer.alloc(31, 0x11)),
          Encoding.encodeBase64Url(Buffer.alloc(33, 0x11)),
          '!'.repeat(43),
        ];

        for (const value of malformed) {
          const error = yield* Effect.flip(
            auth.authenticate(Redacted.make(value)),
          );
          expect(error, value).toBeInstanceOf(AuthUnauthenticatedError);
        }
      }).pipe(Effect.provide(makeAuthLayer(sessionsNotQueried))),
  );

  it.effect('rejects a well-formed credential without a session', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;

      const error = yield* Effect.flip(
        auth.authenticate(credentialOf(Buffer.alloc(32, 0x33))),
      );

      expect(error).toBeInstanceOf(AuthUnauthenticatedError);
    }).pipe(Effect.provide(authLayer)),
  );

  it.effect('rejects a session at its expiry time', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;

      yield* TestClock.setTime(Date.now());
      const signup = yield* auth.signup(signupInput);
      yield* TestClock.setTime(signup.expiresAt.getTime());

      const error = yield* Effect.flip(auth.authenticate(signup.credential));

      expect(error).toBeInstanceOf(AuthUnauthenticatedError);
    }).pipe(Effect.provide(authLayer)),
  );

  it.effect('returns the user and session for a valid credential', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const sessionRepo = yield* SessionRepository;

      yield* TestClock.setTime(Date.now());
      const signup = yield* auth.signup(signupInput);
      const session = yield* sessionRepo.getByTokenDigest(
        digestOf(signup.credential),
      );
      assertTrue(Option.isSome(session));

      const authenticated = yield* auth.authenticate(signup.credential);

      expect(authenticated).toEqual({
        sessionId: session.value.id,
        user: signup.user,
        expiresAt: signup.expiresAt,
      });
    }).pipe(Effect.provide(authLayer)),
  );

  it.effect(
    'rejects a session whose user was deleted after the session lookup',
    () =>
      Effect.gen(function* () {
        const auth = yield* AuthService;

        const error = yield* Effect.flip(
          auth.authenticate(credentialOf(Buffer.alloc(32, 0x44))),
        );

        expect(error).toBeInstanceOf(AuthUnauthenticatedError);
      }).pipe(
        Effect.provide(
          makeAuthLayer(
            Layer.succeed(SessionRepository, {
              create: () => Effect.die('Should not be used'),
              getByTokenDigest: () =>
                Effect.succeedSome({
                  id: SessionIdSchema.make(
                    '9c1f6f3e-2a7b-4c8d-9e0f-1a2b3c4d5e6f',
                  ),
                  userId: UserIdSchema.make(
                    'f26699b7-6a55-4971-aecc-aac8d2474e35',
                  ),
                  createdAt: new Date(),
                  expiresAt: new Date(Date.now() + 60_000),
                }),
              deleteByTokenDigest: () => Effect.die('Should not be used'),
            }),
          ),
        ),
      ),
  );

  it.effect('returns an internal error when the session lookup fails', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;

      const error = yield* Effect.flip(
        auth.authenticate(credentialOf(Buffer.alloc(32, 0x55))),
      );

      expect(error).toBeInstanceOf(AuthInternalError);
      expect(error.cause).toBeInstanceOf(SessionRepositoryError);
    }).pipe(
      Effect.provide(
        makeAuthLayer(
          Layer.succeed(SessionRepository, {
            create: () => Effect.die('Should not be used'),
            getByTokenDigest: () =>
              new SessionRepositoryError({
                cause: 'connection reset',
                operation: SessionOperations.getByTokenDigest,
              }),
            deleteByTokenDigest: () => Effect.die('Should not be used'),
          }),
        ),
      ),
    ),
  );
});
