import { layer } from '@effect/vitest';
import { assertSome, assertTrue } from '@effect/vitest/utils';
import { Effect, Layer, Option, Redacted } from 'effect';
import * as TestClock from 'effect/testing/TestClock';
import { createHash } from 'node:crypto';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import {
  PasswordCredentialsRepository,
  PasswordCredentialsRepositoryLive,
} from '#modules/auth/repository/password/password-credentials.repository.js';
import {
  SessionRepository,
  SessionRepositoryLive,
} from '#modules/auth/repository/session/sesion.repository.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';
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
const cryptoLayer = Layer.mergeAll(
  PasswordHasherLive,
  SessionTokenGeneratorLive.pipe(Layer.provide(SecureRandomBytesLive)),
);
const authLayer = AuthServiceLive.pipe(
  Layer.provideMerge(Layer.mergeAll(repoLayer, cryptoLayer)),
);

const email = UserEmailSchema.make('test@example.test');
const password = PasswordSchema.make('Password1!');
const signupInput = SignupInputSchema.make({
  email,
  password,
  lastName: null,
  middleName: null,
  firstName: null,
});

describe('AuthService', () => {
  layer(authLayer, { timeout: '60 seconds' })((it) => {
    it.effect('signup', () =>
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
      }),
    );
    it.effect('rollback failed transaction', () =>
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
      }),
    );
  });
});
