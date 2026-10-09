import { Effect, Schema } from 'effect';

type ReplMember =
  | ((...args: ReadonlyArray<never>) => Effect.Effect<unknown, unknown>)
  | Effect.Effect<unknown, unknown>;

type ReplMembers<Members> = { readonly [K in keyof Members]: ReplMember };

export type ReplFacade<Members extends ReplMembers<Members>> = {
  readonly [K in keyof Members]: Members[K] extends (
    ...args: infer Args
  ) => Effect.Effect<infer A, unknown>
    ? (...args: Args) => Promise<A>
    : Members[K] extends Effect.Effect<infer A, unknown>
      ? () => Promise<A>
      : never;
};

/**
 * Turns Effect-based members into Promise-based functions for the Node REPL.
 * Effects run with the context of the fiber that built the facade.
 */
export const makeReplFacade = <Members extends ReplMembers<Members>>(
  members: Members,
): Effect.Effect<ReplFacade<Members>> =>
  Effect.gen(function* () {
    const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());

    const facade = Object.fromEntries(
      Object.entries<ReplMember>(members).map(([name, member]) => [
        name,
        Effect.isEffect(member)
          ? () => runPromise(member)
          : (...args: ReadonlyArray<never>) => runPromise(member(...args)),
      ]),
    );

    // Object.fromEntries loses the key-to-signature mapping that ReplFacade describes.
    return facade as ReplFacade<Members>;
  });

/**
 * Decodes raw REPL arguments with the given schemas before calling `fn`.
 */
export const decodeArgs = <
  const Schemas extends ReadonlyArray<Schema.ConstraintDecoder<unknown>>,
  A,
  E,
>(
  schemas: Schemas,
  fn: (...args: Schema.Tuple.Type<Schemas>) => Effect.Effect<A, E>,
) => {
  const decode = Schema.decodeEffect(Schema.Tuple(schemas));

  return (...args: Schema.Tuple.Encoded<Schemas>) =>
    decode(args).pipe(Effect.flatMap((decoded) => fn(...decoded)));
};
