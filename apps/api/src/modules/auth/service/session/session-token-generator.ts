import { randomBytes } from 'crypto';
import { Context, Effect, Encoding, Layer, Redacted, Schema } from 'effect';
import { createHash } from 'node:crypto';

import { isSafeIntegerInRange } from '#infra/lib/utils/checkers.js';
import {
  secureRandomBytesMaxLength,
  secureRandomBytesMinLength,
} from '#modules/auth/service/constants.js';
import { SecurePrimitiveUnavailableError } from '#modules/auth/service/session/session-token-generator.errors.js';

export interface SecureRandomBytesShape {
  readonly get: (
    total: number,
  ) => Effect.Effect<Uint8Array, SecurePrimitiveUnavailableError>;
}

export class SecureRandomBytes extends Context.Service<
  SecureRandomBytes,
  SecureRandomBytesShape
>()('app/SecureRandomBytes') {}

export const SecureRandomBytesLive: SecureRandomBytesShape = {
  get: (total) =>
    Effect.gen(function* () {
      if (
        isSafeIntegerInRange(
          total,
          secureRandomBytesMinLength,
          secureRandomBytesMaxLength,
        )
      ) {
        return yield* Effect.try({
          try: () => randomBytes(total),
          catch: (cause) => new SecurePrimitiveUnavailableError({ cause }),
        });
      }

      return yield* Effect.die(
        `Can not to get ${total} bytes.Check bytes length.`,
      );
    }),
};

export const SecureRandomBytesLiveLayer = Layer.succeed(
  SecureRandomBytes,
  SecureRandomBytesLive,
);

export const GeneratedSessionTokenSchema = Schema.Struct({
  credential: Schema.Redacted(Schema.String),
  digest: Schema.Uint8Array,
});

export type GeneratedSessionToken = Schema.Schema.Type<
  typeof GeneratedSessionTokenSchema
>;

interface SessionTokenGeneratorShape {
  readonly generate: Effect.Effect<
    GeneratedSessionToken,
    SecurePrimitiveUnavailableError
  >;
}

export class SessionTokenGenerator extends Context.Service<
  SessionTokenGenerator,
  SessionTokenGeneratorShape
>()('app/SessionTokenGenerator') {}

export const SessionTokenGeneratorLive = Layer.effect(
  SessionTokenGenerator,
  Effect.gen(function* () {
    const randomBytes = yield* SecureRandomBytes;

    return {
      generate: Effect.gen(function* () {
        const random32 = yield* randomBytes.get(32);
        const credential = Redacted.make(Encoding.encodeBase64Url(random32));
        const digest = createHash('sha256').update(random32).digest();

        return { credential, digest };
      }),
    };
  }),
);
