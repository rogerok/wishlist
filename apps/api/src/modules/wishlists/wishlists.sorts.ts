import { DateTime, Effect } from 'effect';
import { type Selectable, sql } from 'kysely';

import type {
  DB as Database,
  Wishlists,
} from '#infra/db/generated/database.js';
import type { KeysetSort, ParamSpec } from '#infra/pagination/keyset.js';

import { keyPart, NO_PARAMS } from '#infra/pagination/keyset.js';

import type { WishlistQuerySchema } from './schemas/wishlists-list-query.schema.js';

type WishlistRow = Selectable<Wishlists>;

export type WishlistSort<
  Cursor,
  Spec extends ParamSpec = Record<never, never>,
> = KeysetSort<Database, 'wishlists', WishlistRow, Cursor, Spec>;

export type CreatedAtCursor = {
  createdAt: Date;
  id: string;
  sort: 'createdAt';
};
export type OccasionDateCursor = {
  asOf: string;
  id: string;
  occasionDate: string | null;
  sort: 'occasionDate';
};

// Какую страницу просит listOwn: имя пресета выбирает пресет, курсор того же пресета, limit.
export type PageSort = typeof WishlistQuerySchema.Type;

export type WithCursor<T, Cursor> = {
  items: ReadonlyArray<T>;
  nextCursor: Cursor;
};

const createdAtSort: WishlistSort<CreatedAtCursor> = {
  direction: 'desc',
  key: [
    keyPart({
      column: (eb) => eb.ref('createdAt'),
      sqlType: 'timestamptz',
      value: (cursor) => cursor.createdAt,
    }),

    keyPart({
      column: (eb) => eb.ref('id'),
      sqlType: 'uuid',
      value: (cursor) => cursor.id,
    }),
  ],
  cursorOf: (row) => ({
    createdAt: row.createdAt,
    id: row.id,
    sort: 'createdAt',
  }),
  params: NO_PARAMS,
};

const occasionDateSort: WishlistSort<OccasionDateCursor, { asOf: 'date' }> = {
  direction: 'asc',
  key: [
    keyPart({
      column: (eb) => eb.ref('occasionDate'),
      sqlType: 'date',
      value: (cursor) => cursor.occasionDate,
      rule: (date, { asOf }) =>
        sql<number>`CASE WHEN ${date} IS NULL THEN 2 WHEN ${date} >=${asOf} THEN 0 ELSE 1 END`,
    }),
    keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      rule: (date, { asOf }) =>
        sql<number>`CASE WHEN ${date} IS NULL THEN 0 WHEN ${date} >= ${asOf} THEN ${date} - ${asOf} ELSE ${asOf} - ${date} END`,
      value: (cursor) => cursor.occasionDate,
    }),
    keyPart({
      sqlType: 'uuid',
      column: (eb) => eb.ref('id'),
      value: (cursor) => cursor.id,
    }),
  ],
  params: {
    first: Effect.gen(function* () {
      const now = yield* DateTime.now;
      const today = DateTime.startOf(now, 'day');
      const first = DateTime.formatIsoDateUtc(today);

      return { asOf: first };
    }),
    types: { asOf: 'date' },
    fromCursor: (cursor) => ({ asOf: cursor.asOf }),
  },
  cursorOf: ({ id, occasionDate }, { asOf }) => ({
    id,
    asOf,
    occasionDate,
    sort: 'occasionDate',
  }),
};

export const wishlistsSort = {
  createdAt: createdAtSort,
  occasionDate: occasionDateSort,
};
