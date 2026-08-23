import type { Buffer } from 'node:buffer';

import { Effect, Schema } from 'effect';

import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';

const saltBytesLength = 16;
const derivedKeyBytesLength = 32;
const base64regex = /^[A-Za-z0-9_-]+$/;

const AlgorithmSchema = Schema.Literal('scrypt');
const AlgorithmVersion = Schema.Literal('v=1');
const AlgorithmParams = Schema.Literal('N=131072,r=8,p=1');
const SaltBase64Schema = Schema.String.check(
  Schema.isPattern(base64regex),
).check(Schema.isLengthBetween(22, 22));

const DerivedKeyBase64Schema = Schema.String.check(
  Schema.isPattern(base64regex),
).check(Schema.isLengthBetween(43, 43));

const s = Schema.isBase64Url();

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

export interface PasswordHashStructure {
  readonly derivedKeyBase64Url: string;
  readonly saltBase64Url: string;
}

export const parsePasswordHashStructure = (
  input: string,
): Effect.Effect<PasswordHashStructure, PasswordHashIntegrityError> => {
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
    segments.length !== 6 ||
    !saltBase64Url ||
    !derivedKeyBase64Url ||
    !isValidMetadata
  ) {
    return new PasswordHashIntegrityError({
      cause: 'Invalid stored password hash structure',
    });
  }

  return Effect.succeed({
    saltBase64Url,
    derivedKeyBase64Url,
  });
};
