import { Effect, Schema } from 'effect';

import { makeCursorCodec } from '#infra/pagination/cursor.js';
import {
  LimitQueryParam,
  withCursorMatchingSort,
} from '#infra/pagination/query.js';
import {
  PgCalendarDate,
  PgInstantFromString,
} from '#infra/schemas/dates.schema.js';
import { Uuid4Schema } from '#infra/schemas/uuid4.schema.js';

const CreatedAtSortSchema = Schema.Literal('createdAt');
const OccasionDateSortSchema = Schema.Literal('occasionDate');

const WishlistCursorSchema = Schema.Union([
  Schema.Struct({
    sort: CreatedAtSortSchema,
    createdAt: PgInstantFromString,
    id: Uuid4Schema,
  }),
  Schema.Struct({
    sort: OccasionDateSortSchema,
    asOf: PgCalendarDate,
    occasionDate: Schema.NullOr(PgCalendarDate),
    id: Uuid4Schema,
  }),
]);

export const WishlistCursorCodec = makeCursorCodec(WishlistCursorSchema);

const WishlistQueryFieldsSchema = Schema.Struct({
  sort: Schema.Union([CreatedAtSortSchema, OccasionDateSortSchema]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('createdAt')),
  ),
  limit: LimitQueryParam,
  cursor: Schema.optionalKey(WishlistCursorCodec),
});

export const WishlistQuerySchema = withCursorMatchingSort(
  WishlistQueryFieldsSchema,
);
