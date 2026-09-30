import { Clock, Effect, Layer, Redacted } from 'effect';
import { Context } from 'effect';

import type {
  SignupInput,
  SignupResult,
} from '#modules/auth/schemas/signup/signup.schema.js';
import type { AuthSignupError } from '#modules/auth/service/auth.service.errors.js';

import { DB } from '#infra/db/db.service.js';
import { PasswordCredentialsRepository } from '#modules/auth/repository/password/password-credentials.repository.js';
import { SessionRepository } from '#modules/auth/repository/session/sesion.repository.js';
import { sessionLifetimeMs } from '#modules/auth/service/constants.js';
import { PasswordHasher } from '#modules/auth/service/password/password-hasher.service.js';
import { SessionTokenGenerator } from '#modules/auth/service/session/session-token-generator.js';
import { UsersRepository } from '#modules/users/repository/users.repository.js';

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
      });

    return { signup };
  }),
);
