import { describe, expect, it } from '@effect/vitest';
import { assertSome, assertTrue } from '@effect/vitest/utils';
import { Effect, Encoding, Layer, Option, Redacted } from 'effect';
import * as TestClock from 'effect/testing/TestClock';
import { createHash } from 'node:crypto';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  PasswordCredentialsInvalidRecord,
  PasswordCredentialsRepositoryError,
} from '#modules/auth/repository/password/password-credential.repository.errors.js';
import {
  PasswordCredentialsRepository,
  PasswordCredentialsRepositoryLive,
} from '#modules/auth/repository/password/password-credentials.repository.js';
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { SessionTokenDigestAlreadyExistsError } from '#modules/auth/repository/session/session.repository.errors.js';
import { PasswordCredentialsOperations } from '#modules/auth/schemas/password/password-credentials-operations.schema.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';
import { AuthInternalError } from '#modules/auth/service/auth.service.errors.js';
import {
  AuthService,
  AuthServiceLive,
} from '#modules/auth/service/auth.service.js';
import {
  PasswordHasher,
  PasswordHasherLive,
} from '#modules/auth/service/password/password-hasher.service.js';
import {
  SecureRandomBytesLive,
  SessionTokenGenerator,
  SessionTokenGeneratorLive,
} from '#modules/auth/service/session/session-token-generator.js';
import {
  UsersRepository,
  UsersRepositoryLive,
} from '#modules/users/repository/users.repository.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';

const DbLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));
const repoLayer = Layer.mergeAll(
  UsersRepositoryLive,
  PasswordCredentialsRepositoryLive,
  SessionRepositoryLive,
).pipe(Layer.provideMerge(DbLayer));

const bytes = Buffer.alloc(32, 0x22);
const credential = Redacted.make(Encoding.encodeBase64Url(bytes));
const digest = createHash('sha256').update(bytes).digest();
const fixedTokenGenerator = Layer.succeed(SessionTokenGenerator, {
  generate: Effect.succeed({ credential, digest }),
});
const cryptoLayer = Layer.mergeAll(
  PasswordHasherLive,
  SessionTokenGeneratorLive.pipe(Layer.provide(SecureRandomBytesLive)),
);
const cryptoFixedLayer = Layer.mergeAll(
  PasswordHasherLive,
  fixedTokenGenerator,
);

const authLayer = AuthServiceLive.pipe(
  Layer.provideMerge(Layer.mergeAll(repoLayer, cryptoLayer)),
);

const email = UserEmailSchema.make('test@example.test');
const email2 = UserEmailSchema.make('test2@example.test');
const password = PasswordSchema.make('Password1!');
const signupInput = SignupInputSchema.make({
  email,
  password,
  lastName: null,
  middleName: null,
  firstName: null,
});

describe('AuthService', () => {
  it.effect(
    'creates a user with a verifiable password and a session matching the issued token',
    () =>
      Effect.gen(function* () {
        const auth = yield* AuthService;
        const usersRepo = yield* UsersRepository;
        const sessionRepo = yield* SessionRepository;
        const passwordRepo = yield* PasswordCredentialsRepository;
        const hasher = yield* PasswordHasher;

        yield* TestClock.setTime(Date.now());
        const signupResult = yield* auth.signup(signupInput);
        const savedUser = yield* usersRepo.getById(signupResult.user.id);
        assertSome(savedUser, signupResult.user);

        const passwordCredentials = yield* passwordRepo.getByUserId(
          savedUser.value.id,
        );
        assertTrue(Option.isSome(passwordCredentials));
        assertTrue(
          yield* hasher.verify(
            Redacted.make(signupInput.password),
            passwordCredentials.valueOrUndefined?.passwordHash,
          ),
        );

        const tokenBytes = Buffer.from(
          Redacted.value(signupResult.credential),
          'base64url',
        );
        const tokenDigest = createHash('sha256').update(tokenBytes).digest();

        const session = yield* sessionRepo.getByTokenDigest(tokenDigest);
        assertTrue(Option.isSome(session));
        expect(session.value.userId).toBe(signupResult.user.id);
        expect(session.value.expiresAt).toEqual(signupResult.expiresAt);
      }).pipe(Effect.provide(authLayer)),
  );

  it.effect('rollback failed transaction', () =>
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const db = yield* DB;

      yield* TestClock.setTime(Date.now());
      yield* auth.signup(signupInput);

      const usersReq = db.selectFrom('users').selectAll().orderBy('id');
      const sessionsReq = db.selectFrom('sessions').selectAll().orderBy('id');
      const passwordsReq = db
        .selectFrom('passwordCredentials')
        .selectAll()
        .orderBy('userId');

      const usersBefore = yield* usersReq;
      const sessionsBefore = yield* sessionsReq;
      const passwordsBefore = yield* passwordsReq;

      const signupError = yield* Effect.flip(
        auth.signup({
          ...signupInput,
          email: email2,
        }),
      );
      expect(signupError).toBeInstanceOf(AuthInternalError);
      if (signupError._tag === 'AuthInternalError') {
        expect(signupError.cause).toBeInstanceOf(
          SessionTokenDigestAlreadyExistsError,
        );
      }

      const usersAfter = yield* usersReq;
      const sessionsAfter = yield* sessionsReq;
      const passwordsAfter = yield* passwordsReq;
      expect(usersAfter).toEqual(usersBefore);
      expect(sessionsAfter).toEqual(sessionsBefore);
      expect(passwordsAfter).toEqual(passwordsBefore);
    }).pipe(
      Effect.provide(
        AuthServiceLive.pipe(
          Layer.provideMerge(Layer.mergeAll(repoLayer, cryptoFixedLayer)),
        ),
      ),
    ),
  );
  it.effect('rolls back the user when password credential creation fails', () =>
    Effect.gen(function* () {
      const passwordRepo = Layer.succeed(PasswordCredentialsRepository, {
        create: () =>
          new PasswordCredentialsRepositoryError({
            cause: 'error',
            operation: PasswordCredentialsOperations.create,
          }),
        getByUserId: () => Effect.die('Should not be used'),
      });

      const repos = Layer.mergeAll(
        UsersRepositoryLive,
        passwordRepo,
        SessionRepositoryLive,
      ).pipe(Layer.provideMerge(DbLayer));

      const program = Effect.gen(function* () {
        const auth = yield* AuthService;
        const db = yield* DB;

        yield* TestClock.setTime(Date.now());

        const usersReq = db.selectFrom('users').selectAll().orderBy('id');
        const sessionsReq = db.selectFrom('sessions').selectAll().orderBy('id');
        const passwordsReq = db
          .selectFrom('passwordCredentials')
          .selectAll()
          .orderBy('userId');

        const usersBefore = yield* usersReq;
        const sessionsBefore = yield* sessionsReq;
        const passwordsBefore = yield* passwordsReq;

        const signupError = yield* Effect.flip(
          auth.signup({
            ...signupInput,
            email: email2,
          }),
        );
        expect(signupError).toBeInstanceOf(AuthInternalError);
        if (signupError._tag === 'AuthInternalError') {
          expect(signupError.cause).toBeInstanceOf(
            PasswordCredentialsRepositoryError,
          );
        }

        const usersAfter = yield* usersReq;
        const sessionsAfter = yield* sessionsReq;
        const passwordsAfter = yield* passwordsReq;
        expect(usersAfter).toEqual(usersBefore);
        expect(sessionsAfter).toEqual(sessionsBefore);
        expect(passwordsAfter).toEqual(passwordsBefore);
      }).pipe(
        Effect.provide(
          AuthServiceLive.pipe(
            Layer.provideMerge(Layer.mergeAll(repos, cryptoFixedLayer)),
          ),
        ),
      );

      yield* program;
    }),
  );

  it.effect(
    'returns an internal error when stored password credentials are invalid',
    () =>
      Effect.gen(function* () {
        const auth = yield* AuthService;
        const usersRepo = yield* UsersRepository;
        const db = yield* DB;

        yield* TestClock.setTime(Date.now());
        const signupResult = yield* auth.signup(signupInput);
        const savedUser = yield* usersRepo.getById(signupResult.user.id);

        assertSome(savedUser, signupResult.user);

        yield* db
          .updateTable('passwordCredentials')
          .set('passwordHash', 'brokenHash')
          .where('userId', '=', savedUser.value.id);

        const sessionsReq = db.selectFrom('sessions').selectAll().orderBy('id');
        const sessionsBefore = yield* sessionsReq;
        const loginResult = yield* Effect.flip(auth.login({ email, password }));
        const sessionsAfter = yield* sessionsReq;
        expect(sessionsAfter).toEqual(sessionsBefore);
        expect(loginResult).toBeInstanceOf(AuthInternalError);
        expect(loginResult.cause).toBeInstanceOf(
          PasswordCredentialsInvalidRecord,
        );
      }).pipe(Effect.provide(authLayer)),
  );
});
