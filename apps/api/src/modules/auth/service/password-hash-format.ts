import { Effect, Encoding, Result, Schema } from 'effect';

import {
  base64UrlRegex,
  cryptAlgorithm,
  cryptOptions,
  cryptVersion,
  derivedKeyBytesLength,
  derivedKeyTextLength,
  saltBytesLength,
  saltTextLength,
  segmentsLength,
} from '#modules/auth/service/constants.js';
import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';

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
  salt: Uint8Array,
  derivedKey: Uint8Array,
): Effect.Effect<StoredPasswordHash, PasswordHashIntegrityError> => {
  if (
    salt.length !== saltBytesLength ||
    derivedKey.length !== derivedKeyBytesLength
  ) {
    return new PasswordHashIntegrityError({
      cause: 'Invalid password hash component length',
    });
  }

  const saltBase64 = Encoding.encodeBase64Url(salt);
  const hashBase64 = Encoding.encodeBase64Url(derivedKey);

  return Effect.succeed(
    StoredPasswordHashSchema.make(
      `$${cryptAlgorithm}$v=${cryptVersion}$N=${cryptOptions.N},r=${cryptOptions.r},p=${cryptOptions.p}$${saltBase64}$${hashBase64}`,
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
    const isValidAlgorithmSegment = segments[1] === cryptAlgorithm;
    const isValidVersion = segments[2] === `v=${cryptVersion}`;
    const isValidParams =
      segments[3] ===
      `N=${cryptOptions.N},r=${cryptOptions.r},p=${cryptOptions.p}`;

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
