import type { Redacted } from 'effect';

import { scrypt } from 'crypto';
import { Effect } from 'effect';
import { Context } from 'effect';

import type { StoredPasswordHash } from '#modules/auth/service/password-hash-format.js';
import type { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';
import type { PasswordHashOverloadedError } from '#modules/auth/service/password-hasher.service.errors.js';

import {
  cryptOptions,
  derivedKeyBytesLength,
} from '#modules/auth/service/constants.js';
import { SecurePrimitiveUnavailableError } from '#modules/auth/service/session-token-generator.errors.js';

interface PasswordHasherShape {
  readonly hash: (
    password: Redacted.Redacted<string>,
  ) => Effect.Effect<
    StoredPasswordHash,
    | PasswordHashIntegrityError
    | PasswordHashOverloadedError
    | SecurePrimitiveUnavailableError
  >;
  readonly verify: (
    password: Redacted.Redacted<string>,
    hash: string,
  ) => Effect.Effect<
    boolean,
    | PasswordHashIntegrityError
    | PasswordHashOverloadedError
    | SecurePrimitiveUnavailableError
  >;
}

export class PasswordHasher extends Context.Service<
  PasswordHasher,
  PasswordHasherShape
>()('app/PasswordHasher') {}

const deriveKey = (password: string, salt: Uint8Array<ArrayBufferLike>) =>
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

const hash = Effect.gen(function* () {});
