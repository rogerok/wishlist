import type { Redacted } from 'effect';
import type { Buffer } from 'node:buffer';

import { Effect, Encoding, Result, Schema } from 'effect';
import { clear } from 'effect/Queue';

import type { AuthCredentialsError } from '#modules/auth/service/auth.service.errors.js';
import type { PasswordHashOverloadedError } from '#modules/auth/service/password-hasher.service.errors.js';
import type { SecurePrimitiveUnavailableError } from '#modules/auth/service/session-token-generator.errors.js';

import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';

const saltBytesLength = 16;
const derivedKeyBytesLength = 32;
const saltTextLength = 22;
const derivedKeyTextLength = 43;
const segmentsLength = 6;

const base64UrlRegex = /^[A-Za-z0-9_-]+$/;

const canonicalBase64UrlFilter = Schema.makeFilter<string>(
  (input) => {
    const decoded = Encoding.decodeBase64Url(input);

    return Result.match(decoded, {
      onFailure: () => false,
      onSuccess: (bytes) => Encoding.encodeBase64Url(bytes) === input,
    });
  },
  {
    expected: 'a canonical Base64URL string',
  },
);

const makeFromBase64Schema = (bytesLength: number, textLength: number) =>
  Schema.String.check(
    Schema.isBase64Url(),
    Schema.isPattern(base64UrlRegex),
    Schema.isLengthBetween(textLength, textLength),
    canonicalBase64UrlFilter,
  ).pipe(
    Schema.decodeTo(
      Schema.Uint8ArrayFromBase64Url.check(
        Schema.isLengthBetween(bytesLength, bytesLength),
      ),
    ),
  );

export const SaltFromBase64Schema = makeFromBase64Schema(
  saltBytesLength,
  saltTextLength,
);
export const DerivedKeyFromBase64Schema = makeFromBase64Schema(
  derivedKeyBytesLength,
  derivedKeyTextLength,
);

export const StoredPasswordHashSchema = Schema.String.pipe(
  Schema.brand('StoredPasswordHash'),
);
export type StoredPasswordHash = Schema.Schema.Type<
  typeof StoredPasswordHashSchema
>;

export const serializePasswordHash = (
  salt: Buffer,
  derivedKey: Buffer,
): Effect.Effect<StoredPasswordHash, PasswordHashIntegrityError> => {
  if (
    salt.length !== saltBytesLength ||
    derivedKey.length !== derivedKeyBytesLength
  ) {
    return new PasswordHashIntegrityError({
      cause: 'Invalid password hash component length',
    });
  }

  const saltBase64 = salt.toString('base64url');
  const hashBase64 = derivedKey.toString('base64url');

  return Effect.succeed(
    StoredPasswordHashSchema.make(
      `$scrypt$v=1$N=131072,r=8,p=1$${saltBase64}$${hashBase64}`,
    ),
  );
};

export interface PasswordHash {
  readonly derivedKey: Uint8Array;
  readonly salt: Uint8Array;
}

export const parsePasswordHashStructure = (
  input: string,
): Effect.Effect<PasswordHash, PasswordHashIntegrityError> =>
  Effect.gen(function* () {
    const segments = input.split('$');
    const isValidFirstSegment = segments[0] === '';
    const isValidAlgorithmSegment = segments[1] === 'scrypt';
    const isValidVersion = segments[2] === 'v=1';
    const isValidParams = segments[3] === 'N=131072,r=8,p=1';

    const isValidMetadata =
      isValidFirstSegment &&
      isValidAlgorithmSegment &&
      isValidVersion &&
      isValidParams;

    const saltBase64Url = segments[4];
    const derivedKeyBase64Url = segments[5];

    if (
      segments.length !== segmentsLength ||
      !saltBase64Url ||
      !derivedKeyBase64Url ||
      !isValidMetadata
    ) {
      return yield* new PasswordHashIntegrityError({
        cause: 'Invalid stored password hash structure',
      });
    }

    const salt = yield* Schema.decodeEffect(SaltFromBase64Schema)(
      saltBase64Url,
    ).pipe(
      Effect.mapError(
        () =>
          new PasswordHashIntegrityError({
            cause: 'Invalid stored password hash encoding',
          }),
      ),
    );
    const derivedKey = yield* Schema.decodeEffect(DerivedKeyFromBase64Schema)(
      derivedKeyBase64Url,
    ).pipe(
      Effect.mapError(
        () =>
          new PasswordHashIntegrityError({
            cause: 'Invalid stored password hash encoding',
          }),
      ),
    );

    return {
      salt,
      derivedKey,
    };
  });
