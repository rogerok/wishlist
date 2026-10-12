import { scrypt } from 'crypto';
import { Context, Effect, Layer, Option, Redacted, Semaphore } from 'effect';
import { timingSafeEqual } from 'node:crypto';

import type { StoredPasswordHash } from '#modules/auth/schemas/password/password-hash.schema.js';
import type { PasswordHashIntegrityError } from '#modules/auth/service/password/password-hasher.service.errors.js';

import { OperationFailed } from '#infra/errors/operation-failed.js';
import { PasswordHasherOperation } from '#modules/auth/schemas/password/password-hasher-operations.schema.js';
import {
  cryptOptions,
  derivedKeyBytesLength,
  saltBytesLength,
} from '#modules/auth/service/constants.js';
import {
  parsePasswordHashStructure,
  serializePasswordHash,
} from '#modules/auth/service/password/password-hash-format.js';
import {
  SecureRandomBytes,
  SecureRandomBytesLive,
} from '#modules/auth/service/session/session-token-generator.js';

const passwordHasherPermits = 2;
const passwordAdmissionPermits = 4;

const source = 'passwordHasher';

// Все слоты заняты: повтор позже может пройти.
const overloaded = (operation: PasswordHasherOperation) =>
  new OperationFailed({
    reason: 'unavailable',
    source,
    operation,
    cause:
      'Password hashing capacity exhausted: all execution and waiting slots are occupied',
  });

type PasswordHasherHashErrors = OperationFailed | PasswordHashIntegrityError;

type PasswordHasherVerifyErrors = OperationFailed | PasswordHashIntegrityError;

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

const makeDeriveKey = (
  password: string,
  salt: Uint8Array<ArrayBufferLike>,
  operation: PasswordHasherOperation,
) =>
  Effect.callback<Uint8Array, OperationFailed>((resume) => {
    scrypt(
      password,
      salt,
      derivedKeyBytesLength,
      cryptOptions,
      (error, derivedKey) => {
        if (error !== null) {
          resume(
            Effect.fail(
              new OperationFailed({
                reason: 'unavailable',
                source,
                operation,
                cause: error,
              }),
            ),
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
          workSem.withPermits(1)(
            makeDeriveKey(
              Redacted.value(password),
              salt,
              PasswordHasherOperation.hash,
            ),
          ),
        );

        if (Option.isNone(derivedKey)) {
          return yield* overloaded(PasswordHasherOperation.hash);
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
          workSem.withPermits(1)(
            makeDeriveKey(
              Redacted.value(password),
              salt,
              PasswordHasherOperation.verify,
            ),
          ),
        );

        if (Option.isNone(createdDerivedKey)) {
          return yield* overloaded(PasswordHasherOperation.verify);
        }

        return timingSafeEqual(derivedKey, createdDerivedKey.value);
      });

    return { hash, verify };
  }),
).pipe(Layer.provide(SecureRandomBytesLive));
