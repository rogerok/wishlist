import { describe, expect, it } from '@effect/vitest';
import { Effect, Redacted } from 'effect';

import { parsePasswordHashStructure } from '#modules/auth/service/password-hash-format.js';
import { PasswordHashIntegrityError } from '#modules/auth/service/password-hasher.service.errors.js';
import {
  PasswordHasher,
  PasswordHasherLive,
} from '#modules/auth/service/password-hasher.service.js';

const firstPass = Redacted.make('First');
const secondPass = Redacted.make('Second');

describe('PasswordHasherService', () => {
  it.effect(
    'accepts the original password and rejects a different password',
    () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher;
        const firstHashed = yield* hasher.hash(firstPass);
        const verifiedSuccess = yield* hasher.verify(firstPass, firstHashed);
        const verifiedFail = yield* hasher.verify(secondPass, firstHashed);

        expect(verifiedSuccess).toBe(true);
        expect(verifiedFail).toBe(false);
      }).pipe(Effect.provide(PasswordHasherLive)),
  );

  it.effect('rejects invalid hash', () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;

      const verifiedFail = yield* Effect.result(
        hasher.verify(secondPass, 'invalid-hash'),
      );

      expect(verifiedFail).toBeResultFailure(PasswordHashIntegrityError, {});
    }).pipe(Effect.provide(PasswordHasherLive)),
  );

  it.effect('generates a fresh salt on each execution', () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;
      const hashEff = hasher.hash(firstPass);
      const hash1 = yield* hashEff;
      const hash2 = yield* hashEff;
      const parsed1 = yield* parsePasswordHashStructure(hash1);
      const parsed2 = yield* parsePasswordHashStructure(hash2);

      expect(parsed1.salt).not.toEqual(parsed2.salt);
    }).pipe(Effect.provide(PasswordHasherLive)),
  );
});
