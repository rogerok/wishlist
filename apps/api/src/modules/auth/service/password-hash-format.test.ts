import { describe, expect, it } from '@effect/vitest';
import { Effect, Result, Schema } from 'effect';

import {
  DerivedKeyFromBase64Schema,
  parsePasswordHashStructure,
  SaltFromBase64Schema,
  serializePasswordHash,
} from '#modules/auth/service/password-hash-format.js';
import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';

const invalidByteLengthTable = [
  { saltBytesLength: 15, keyBytesLength: 32, component: 'salt' },
  { saltBytesLength: 16, keyBytesLength: 31, component: 'derived key' },
] as const;
const saltBuffer = Buffer.alloc(16, 0x11);
const derivedKeyBuffer = Buffer.alloc(32, 0x22);

const validSalt = saltBuffer.toString('base64url');
const validDerivedKey = derivedKeyBuffer.toString('base64url');

describe('serializePasswordHash', () => {
  it.effect('successful serializing', () =>
    Effect.gen(function* () {
      const salt = Buffer.alloc(16, 0x11);
      const derivedKey = Buffer.alloc(32, 0x22);
      const hash = yield* serializePasswordHash(salt, derivedKey);
      const segments = hash.split('$');
      const safeSegments = segments.slice(0, 4);
      const saltSegment = segments[4];
      const derivedKeySegment = segments[5];
      const regex = /^[A-Za-z0-9_-]+$/;

      expect(segments.length).toBe(6);
      expect(safeSegments).toEqual(['', 'scrypt', 'v=1', 'N=131072,r=8,p=1']);
      expect(saltSegment?.length).toBe(22);
      expect(derivedKeySegment?.length).toBe(43);
      expect(regex.test(saltSegment ?? '')).toBe(true);
      expect(regex.test(derivedKeySegment ?? '')).toBe(true);
    }),
  );

  it.effect.each(invalidByteLengthTable)(
    'fails when $component has invalid byte length',
    ({ saltBytesLength, keyBytesLength }) =>
      Effect.gen(function* () {
        const salt = Buffer.alloc(saltBytesLength, 0x11);
        const derivedKey = Buffer.alloc(keyBytesLength, 0x22);
        const error = yield* Effect.flip(
          serializePasswordHash(salt, derivedKey),
        );

        expect(error._tag).toBe('PasswordHashIntegrityError');
        expect(error).toBeInstanceOf(PasswordHashIntegrityError);
        expect(error.cause).toBe('Invalid password hash component length');
      }),
  );
});

const invalidPasswordHashInputTable = [
  {
    input: `scrypt$v=1$N=131072,r=8,p=1$${validSalt}$${validDerivedKey}`,
    component: 'without $',
  },
  {
    input: `$scrypt$v=1$N=131072,r=8,p=1$${validSalt}$${validDerivedKey}$extra-key`,
    component: 'extra segment',
  },
  {
    input: `$argon2$v=1$N=131072,r=8,p=1$${validSalt}$${validDerivedKey}`,
    component: 'not scrypt algorithm',
  },
  {
    input: `$scrypt$v=2$N=131072,r=8,p=1$${validSalt}$${validDerivedKey}`,
    component: 'version is not 1',
  },
  {
    input: `$scrypt$v=1$N=131072,r=7,p=1$${validSalt}$${validDerivedKey}`,
    component: 'wrong r param',
  },
  {
    input: `$scrypt$v=1$N=131072,r=8,p=2$${validSalt}$${validDerivedKey}`,
    component: 'wrong p param',
  },
  {
    input: `$scrypt$v=1$N=131071,r=8,p=1$${validSalt}$${validDerivedKey}`,
    component: 'wrong N param',
  },
] as const;

const invalidPasswordHashEncodingTable = [
  {
    input: `$scrypt$v=1$N=131072,r=8,p=1$${
      validSalt.slice(0, -1) + '+'
    }$${validDerivedKey}`,
    component: 'salt',
  },
  {
    input: `$scrypt$v=1$N=131072,r=8,p=1$${validSalt}$${
      validDerivedKey.slice(0, -1) + '/'
    }`,
    component: 'derived key',
  },
] as const;

describe('parsePasswordHashStructure', () => {
  it.effect('successful parsing hash', () =>
    Effect.gen(function* () {
      const { salt, derivedKey } = yield* parsePasswordHashStructure(
        `$scrypt$v=1$N=131072,r=8,p=1$${validSalt}$${validDerivedKey}`,
      );

      expect(salt.length).toBe(16);
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(salt).equals(saltBuffer)).toBe(true);

      expect(derivedKey.length).toEqual(32);
      expect(derivedKey).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(derivedKey).equals(derivedKeyBuffer)).toBe(true);
    }),
  );

  it.effect.each(invalidPasswordHashInputTable)(
    'fails when $component',
    ({ input }) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(parsePasswordHashStructure(input));

        expect(error._tag).toBe('PasswordHashIntegrityError');
        expect(error).toBeInstanceOf(PasswordHashIntegrityError);
        expect(error.cause).toBe('Invalid stored password hash structure');
      }),
  );

  it.effect.each(invalidPasswordHashEncodingTable)(
    'fails when $component encoding is malformed',
    ({ input }) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(parsePasswordHashStructure(input));

        expect(error._tag).toBe('PasswordHashIntegrityError');

        expect(error).toBeInstanceOf(PasswordHashIntegrityError);
        expect(error.cause).toBe('Invalid stored password hash encoding');
      }),
  );
});

const saltFromBase64SchemaTestCases = [
  {
    salt: Buffer.alloc(15, 0x00).toString('base64url'),
    component: 'short salt',
  },
  {
    salt: validSalt.slice(0, -1) + '=',
    component: 'invalid padding',
  },
  {
    salt: validSalt.slice(0, -1) + '+',
    component: 'forbidden symbol',
  },
  {
    salt: validSalt.slice(0, -1) + 'R',
    component: 'non-canonical unused bits',
  },
];

describe('SaltFromBase64Schema', () => {
  it('Successful parsing', () => {
    const result = Schema.decodeResult(SaltFromBase64Schema)(validSalt);

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) {
      throw new Error('SaltFromBase64Schema expect success.');
    }
    expect(result.success.length).toBe(16);
    expect(result.success).toBeInstanceOf(Uint8Array);
  });

  it.each(saltFromBase64SchemaTestCases)(
    'rejects when $component',
    ({ salt }) => {
      const result = Schema.decodeResult(SaltFromBase64Schema)(salt);

      expect(Result.isFailure(result)).toBe(true);
    },
  );
});

const derivedKeysFromBase64SchemaTestCases = [
  {
    key: Buffer.alloc(31, 0x00).toString('base64url'),
    component: 'short key',
  },
  {
    key: validDerivedKey.slice(0, -1) + '/',
    component: 'invalid symbol',
  },
  {
    key: validDerivedKey.slice(0, -1) + 'J',
    component: 'non-canonical unused bits',
  },
];

describe('DerivedKeyFromBase64Schema', () => {
  it('Successful parsing', () => {
    const result = Schema.decodeResult(DerivedKeyFromBase64Schema)(
      validDerivedKey,
    );

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) {
      throw new Error('DerivedKeyFromBase64Schema expect success.');
    }
    expect(result.success.length).toBe(32);
    expect(result.success).toBeInstanceOf(Uint8Array);
  });

  it.each(derivedKeysFromBase64SchemaTestCases)(
    'rejects when $component',
    ({ key }) => {
      const result = Schema.decodeResult(DerivedKeyFromBase64Schema)(key);

      expect(Result.isFailure(result)).toBe(true);
    },
  );
});
