import { randomBytes } from 'crypto';
import { Effect, Layer } from 'effect';
import { Schema } from 'effect';
import { Data } from 'effect';
import { Context } from 'effect';

export class SecurePrimitiveUnavailableError extends Data.TaggedError(
  'SecurePrimitiveUnavailableError',
)<{
  readonly cause: unknown;
}> {}

export interface SecureRandomBytesShape {
  readonly get: (
    total: number,
  ) => Effect.Effect<Uint8Array, SecurePrimitiveUnavailableError>;
}

export class SecureRandomBytes extends Context.Service<
  SecureRandomBytes,
  SecureRandomBytesShape
>()('app/SecureRandomBytes') {}

// export const SecureRandomBytesLive: SecureRandomBytesShape = {
//   get: (total) =>
//     Effect.gen(function* () {
//       const bytes = randomBytes(total);
//     }),
// };

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
    const random32 = yield* randomBytes.get(32);

    return {
      generate: null as unknown as Effect.Effect<
        GeneratedSessionToken,
        SecurePrimitiveUnavailableError
      >,
    };
  }),
);
