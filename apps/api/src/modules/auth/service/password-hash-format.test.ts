import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import {
  parsePasswordHashStructure,
  serializePasswordHash,
} from '#modules/auth/service/password-hash-format.js';
import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';

const invalidByteLengthTable = [
  { saltBytesLength: 15, keyBytesLength: 32, component: 'salt' },
  { saltBytesLength: 16, keyBytesLength: 31, component: 'derived key' },
] as const;

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
    input: 'scrypt$v=1$N=131072,r=8,p=1$salt-text$key-text',
    component: 'without $',
  },
  {
    input: '$scrypt$v=1$N=131072,r=8,p=1$salt-text$key-text$extra-key',
    component: 'extra segment',
  },
  {
    input: '$argon2$v=1$N=131072,r=8,p=1$salt-text$key-text',
    component: 'not scrypt algorithm',
  },
  {
    input: '$scrypt$v=2$N=131072,r=8,p=1$salt-text$key-text',
    component: 'version is not 1',
  },
  {
    input: '$scrypt$v=1$N=131072,r=7,p=1$salt-text$key-text',
    component: 'wrong r param',
  },
  {
    input: '$scrypt$v=1$N=131072,r=8,p=2$salt-text$key-text',
    component: 'wrong p param',
  },
  {
    input: '$scrypt$v=1$N=131071,r=8,p=1$salt-text$key-text',
    component: 'wrong N param',
  },
] as const;

describe('parsePasswordHashStructure', () => {
  it.effect('successful parsing hash', () =>
    Effect.gen(function* () {
      const { derivedKeyBase64Url, saltBase64Url } =
        yield* parsePasswordHashStructure(
          '$scrypt$v=1$N=131072,r=8,p=1$salt-text$key-text',
        );

      expect(derivedKeyBase64Url).toBe('key-text');
      expect(saltBase64Url).toBe('salt-text');
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
});
