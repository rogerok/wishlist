import { randomBytes } from 'crypto';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { Base64Url } from 'effect/encoding';
import { createHash } from 'node:crypto';

import { OperationFailed } from '#infra/errors/operation-failed.js';
import { isSafeIntegerInRange } from '#infra/lib/utils/checkers.js';
import { CredentialsSchema } from '#modules/auth/schemas/auth.schema.js';
import {
  secureRandomBytesMaxLength,
  secureRandomBytesMinLength,
} from '#modules/auth/service/constants.js';

export const digestSessionToken = (tokenBytes: Uint8Array): Uint8Array =>
  createHash('sha256').update(tokenBytes).digest();

interface SecureRandomBytesShape {
  readonly get: (total: number) => Effect.Effect<Uint8Array, OperationFailed>;
}

export class SecureRandomBytes extends Context.Service<
  SecureRandomBytes,
  SecureRandomBytesShape
>()('app/SecureRandomBytes') {}

export const SecureRandomBytesLive = Layer.succeed(SecureRandomBytes, {
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
          catch: (cause) =>
            new OperationFailed({
              reason: 'unavailable',
              source: 'secureRandomBytes',
              operation: 'get',
              cause,
            }),
        });
      }

      return yield* Effect.die(
        `Can not to get ${total} bytes.Check bytes length.`,
      );
    }),
});

const GeneratedSessionTokenSchema = Schema.Struct({
  credential: CredentialsSchema,
  digest: Schema.Uint8Array,
});

type GeneratedSessionToken = Schema.Schema.Type<
  typeof GeneratedSessionTokenSchema
>;

interface SessionTokenGeneratorShape {
  readonly generate: Effect.Effect<GeneratedSessionToken, OperationFailed>;
}

export class SessionTokenGenerator extends Context.Service<
  SessionTokenGenerator,
  SessionTokenGeneratorShape
>()('app/SessionTokenGenerator') {}

export const SessionTokenGeneratorLive = Layer.effect(
  SessionTokenGenerator,
  Effect.gen(function* () {
    const secureRandomBytes = yield* SecureRandomBytes;

    return {
      generate: Effect.gen(function* () {
        const random32 = yield* secureRandomBytes.get(32);
        const credential = Redacted.make(Base64Url.encode(random32));
        const digest = createHash('sha256').update(random32).digest();

        return { credential, digest };
      }),
    };
  }),
);
