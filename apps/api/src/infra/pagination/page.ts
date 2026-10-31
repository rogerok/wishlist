import { Schema } from 'effect';

export const makePageSchema = <S extends Schema.Top>(item: S) =>
  Schema.Struct({
    items: Schema.Array(item),
    nextCursor: Schema.NullOr(Schema.String),
  });
