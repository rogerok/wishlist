import { describe, expect, it } from '@effect/vitest';
import { Effect, Encoding, Layer, Redacted } from 'effect';
import { createHash } from 'node:crypto';

import { secureRandomBytesMaxLength } from '#modules/auth/service/constants.js';
import {
  SecureRandomBytes,
  SecureRandomBytesLiveLayer,
  SessionTokenGenerator,
  SessionTokenGeneratorLive,
} from '#modules/auth/service/session/session-token-generator.js';

describe('SecureRandomBytes', () => {
  it.effect('expect one effect return same bytes length', () =>
    Effect.gen(function* () {
      const service = yield* SecureRandomBytes;
      const bytes = 16;
      const eff = service.get(bytes);
      const first = yield* eff;
      const second = yield* eff;

      expect(first).not.toEqual(second);
      expect(first.length).toBe(bytes);
      expect(second.length).toBe(bytes);
    }).pipe(Effect.provide(SecureRandomBytesLiveLayer)),
  );

  it.effect('rejects invalid lengths as defects', () =>
    Effect.gen(function* () {
      const service = yield* SecureRandomBytes;

      const tooLarge = yield* Effect.exit(
        service.get(secureRandomBytesMaxLength + 1),
      );
      const withNegative = yield* Effect.exit(service.get(-1));
      const withNaN = yield* Effect.exit(service.get(Number.NaN));
      const withNegativeFloat = yield* Effect.exit(service.get(-0.5));
      const withPositiveFloat = yield* Effect.exit(service.get(1.5));
      const withZero = yield* Effect.exit(service.get(0));

      expect(tooLarge).toFailWithDie();
      expect(withNaN).toFailWithDie();
      expect(withNegative).toFailWithDie();
      expect(withNegativeFloat).toFailWithDie();
      expect(withPositiveFloat).toFailWithDie();
      expect(withZero).toFailWithDie();
    }).pipe(Effect.provide(SecureRandomBytesLiveLayer)),
  );
});

const knownBytes = Uint8Array.from({ length: 32 }, (_, i) => i);
const SecureRandomBytesTest = Layer.succeed(SecureRandomBytes, {
  get: () => Effect.succeed(knownBytes),
});
const SessionTokenGeneratorTest = SessionTokenGeneratorLive.pipe(
  Layer.provide(SecureRandomBytesTest),
);
const credential = Encoding.encodeBase64Url(knownBytes);
const digest = createHash('sha256').update(knownBytes).digest();

describe('SessionTokenGenerator', () => {
  it.effect('encodes known bytes and hashes the raw bytes;', () =>
    Effect.gen(function* () {
      const tokenGenerator = yield* SessionTokenGenerator;
      const result = yield* tokenGenerator.generate;

      expect(result.digest).toEqual(digest);
      expect(credential).toBe(Redacted.value(result.credential));
    }).pipe(Effect.provide(SessionTokenGeneratorTest)),
  );
  it.effect('generates a fresh token on each execution', () =>
    Effect.gen(function* () {
      const tokenGenerator = yield* SessionTokenGenerator;
      const first = yield* tokenGenerator.generate;
      const second = yield* tokenGenerator.generate;

      expect(first.digest).not.toEqual(second.digest);
      expect(Redacted.value(first.credential)).not.toBe(
        Redacted.value(second.credential),
      );
    }).pipe(
      Effect.provide(
        SessionTokenGeneratorLive.pipe(
          Layer.provide(SecureRandomBytesLiveLayer),
        ),
      ),
    ),
  );
});
