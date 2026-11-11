import { Schema } from 'effect';

export const makePageSchema = <S extends Schema.Top, Cursor extends Schema.Top>(
  item: S,
  cursor: Cursor,
) =>
  Schema.Struct({
    items: Schema.Array(item),
    nextCursor: Schema.NullOr(cursor),
  });
