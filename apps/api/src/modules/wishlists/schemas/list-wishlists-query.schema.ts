import { Schema } from 'effect';

import {
  PgCalendarDate,
  PgInstantFromString,
} from '#infra/schemas/dates.schema.js';
import { Uuid4Schema } from '#infra/schemas/uuid4.schema.js';

export const ListWishlistsQuerySchema = Schema.Union([
  Schema.Struct({
    sort: Schema.Literal('createdAt'),
    createdAt: PgInstantFromString,
    id: Uuid4Schema,
  }),
  Schema.Struct({
    sort: Schema.Literal('occasionDate'),
    asOf: PgCalendarDate,
    occasionDate: Schema.NullOr(PgCalendarDate),
    id: Uuid4Schema,
  }),
]);
