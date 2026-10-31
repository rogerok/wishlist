import { Effect, Schema } from 'effect';

export const DEFAULT_LIMIT = 20;
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;

export const LimitQueryParam = Schema.String.check(
  Schema.isPattern(/^[1-9]\d*$/),
).pipe(
  Schema.decodeTo(Schema.FiniteFromString),
  Schema.check(
    Schema.isBetween({
      minimum: MIN_LIMIT,
      maximum: MAX_LIMIT,
    }),
  ),
  Schema.withDecodingDefaultKey(Effect.succeed(String(DEFAULT_LIMIT))),
);

export const cursorMatchesSort = <
  Query extends {
    readonly sort: string;
    readonly cursor?: { readonly sort: string };
  },
>() =>
  Schema.makeFilter((query: Query) => {
    if (query.cursor === undefined) return true;
    if (query.sort === query.cursor?.sort) return true;

    return { path: ['cursor'], issue: 'Cursor belongs to another sort' };
  });
