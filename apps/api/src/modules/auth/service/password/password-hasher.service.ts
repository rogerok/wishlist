import { scrypt } from 'crypto';
import { Context, Effect, Layer, Option, Redacted, Semaphore } from 'effect';
import { timingSafeEqual } from 'node:crypto';

import type { StoredPasswordHash } from '#modules/auth/schemas/password/password.schema.js';
import type { PasswordHashIntegrityError } from '#modules/auth/service/password/password-hasher.service.errors.js';

import {
  cryptOptions,
  derivedKeyBytesLength,
  saltBytesLength,
} from '#modules/auth/service/constants.js';
import {
  parsePasswordHashStructure,
  serializePasswordHash,
} from '#modules/auth/service/password/password-hash-format.js';
import { PasswordHashOverloadedError } from '#modules/auth/service/password/password-hasher.service.errors.js';
import { SecurePrimitiveUnavailableError } from '#modules/auth/service/session/session-token-generator.errors.js';
import {
  SecureRandomBytes,
  SecureRandomBytesLive,
} from '#modules/auth/service/session/session-token-generator.js';

const passwordHasherPermits = 2;
const passwordAdmissionPermits = 4;
const passwordHashOverloadedErrorCause =
  'Password hashing capacity exhausted: all execution and waiting slots are occupied';

type PasswordHasherHashErrors =
  | PasswordHashIntegrityError
  | PasswordHashOverloadedError
  | SecurePrimitiveUnavailableError;

type PasswordHasherVerifyErrors =
  | PasswordHashIntegrityError
  | PasswordHashOverloadedError
  | SecurePrimitiveUnavailableError;

interface PasswordHasherShape {
  readonly hash: (
    password: Redacted.Redacted<string>,
  ) => Effect.Effect<StoredPasswordHash, PasswordHasherHashErrors>;
  readonly verify: (
    password: Redacted.Redacted<string>,
    hash: string,
  ) => Effect.Effect<boolean, PasswordHasherVerifyErrors>;
}

export class PasswordHasher extends Context.Service<
  PasswordHasher,
  PasswordHasherShape
>()('app/PasswordHasher') {}

const makeDeriveKey = (password: string, salt: Uint8Array<ArrayBufferLike>) =>
  Effect.callback<Uint8Array, SecurePrimitiveUnavailableError>((resume) => {
    scrypt(
      password,
      salt,
      derivedKeyBytesLength,
      cryptOptions,
      (error, derivedKey) => {
        if (error !== null) {
          resume(
            Effect.fail(new SecurePrimitiveUnavailableError({ cause: error })),
          );
        } else {
          resume(Effect.succeed(derivedKey));
        }
      },
    );
  }).pipe(Effect.uninterruptible);

export const PasswordHasherLive = Layer.effect(
  PasswordHasher,
  Effect.gen(function* () {
    const secureRandomBytes = yield* SecureRandomBytes;
    const workSem = yield* Semaphore.make(passwordHasherPermits);
    const admissionSem = yield* Semaphore.make(passwordAdmissionPermits);

    const hash: PasswordHasherShape['hash'] = (
      password: Redacted.Redacted<string>,
    ) =>
      Effect.gen(function* () {
        const salt = yield* secureRandomBytes.get(saltBytesLength);
        const derivedKey = yield* admissionSem.withPermitsIfAvailable(1)(
          workSem.withPermits(1)(makeDeriveKey(Redacted.value(password), salt)),
        );

        if (Option.isNone(derivedKey)) {
          return yield* new PasswordHashOverloadedError({
            cause: passwordHashOverloadedErrorCause,
          });
        }
        return yield* serializePasswordHash(salt, derivedKey.value);
      });

    const verify: PasswordHasherShape['verify'] = (
      password: Redacted.Redacted<string>,
      hash: string,
    ) =>
      Effect.gen(function* () {
        const { salt, derivedKey } = yield* parsePasswordHashStructure(hash);
        const createdDerivedKey = yield* admissionSem.withPermitsIfAvailable(1)(
          workSem.withPermits(1)(makeDeriveKey(Redacted.value(password), salt)),
        );

        if (Option.isNone(createdDerivedKey)) {
          return yield* new PasswordHashOverloadedError({
            cause: passwordHashOverloadedErrorCause,
          });
        }

        return timingSafeEqual(derivedKey, createdDerivedKey.value);
      });

    return { hash, verify };
  }),
).pipe(Layer.provide(SecureRandomBytesLive));
