import type { SqlError } from 'effect/sql';

import { describe, layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';
import {
  type Expression,
  expressionBuilder,
  type ExpressionBuilder,
} from 'kysely';

import type { DB as Database } from '#infra/db/generated/database.js';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';

const testLayer = DBLive.pipe(Layer.provideMerge(TestDatabaseLive));

const acquireUser = (email: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const [user] = yield* sql<{ id: string }>`
                INSERT INTO "public"."users" ("email", "display_name")
                VALUES (${email}, 'Owner')
                RETURNING "id"
            `;

      return user?.id ?? (yield* Effect.die('INSERT did not return the user'));
    }),
    (id) =>
      SqlClient.pipe(
        Effect.flatMap(
          (sql) => sql`DELETE
                                 FROM "public"."users"
                                 WHERE "id" = ${id}`,
        ),
        Effect.orDie,
      ),
  );

// Пять Wishlist одного владельца. W3 и W4 созданы в одну миллисекунду — порядок между ними решает id.
// Порядок «новые сверху» (`created_at desc, id desc`): W5, W4, W3, W2, W1.
// При limit = 2 граница первой страницы проходит ровно между W4 и W3 с одинаковым временем.
const W1 = {
  id: '00000000-0000-4000-8000-000000000001',
  createdAt: new Date('2026-10-19T10:00:01.000Z'),
};
const W2 = {
  id: '00000000-0000-4000-8000-000000000002',
  createdAt: new Date('2026-10-19T10:00:02.000Z'),
};
const W3 = {
  id: '00000000-0000-4000-8000-000000000003',
  createdAt: new Date('2026-10-19T10:00:03.000Z'),
};
const W4 = {
  id: '00000000-0000-4000-8000-000000000004',
  createdAt: new Date('2026-10-19T10:00:03.000Z'),
};
const W5 = {
  id: '00000000-0000-4000-8000-000000000005',
  createdAt: new Date('2026-10-19T10:00:05.000Z'),
};

// Создаёт User и его пять Wishlist; возвращает id владельца для `WHERE owner_id = …`.
const acquireFiveWishlists = (email: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const ownerId = yield* acquireUser(email);

    yield* Effect.forEach(
      [W1, W2, W3, W4, W5],
      (wishlist, index) =>
        sql`
                    INSERT INTO "public"."wishlists" ("id", "owner_id", "title", "created_at")
                    VALUES (${wishlist.id}, ${ownerId}, ${`W${index + 1}`}, ${wishlist.createdAt})
                `,
    );

    return ownerId;
  });

type Cursor = {
  readonly createdAt: Date;
  readonly id: string;
};

type PageByCreatedAtParams = {
  cursor: Cursor | undefined;
  limit: number;
  ownerId: string;
  sort: KeysetSort<Database, 'wishlists', Row, Cursor>;
};

type PageByCreatedAtResult = {
  readonly items: Row[];
  nextCursor: Cursor | null;
};

type Row = { readonly createdAt: Date; readonly id: string };

type Direction = 'asc' | 'desc';

interface KeysetSort<Database, TB extends keyof Database, Row, Cursor> {
  direction: 'asc' | 'desc';
  cursorOf: (row: Row) => Cursor;
  cursorValues: (cursor: Cursor) => ReadonlyArray<unknown>;
  keyColumns: (
    eb: ExpressionBuilder<Database, TB>,
  ) => ReadonlyArray<Expression<unknown>>;
}

const makeSort = (
  direction: Direction,
): KeysetSort<Database, 'wishlists', Row, Cursor> => ({
  direction,
  keyColumns: (eb) => [eb.ref('createdAt'), eb.ref('id')],
  cursorOf: (row) => ({ createdAt: row.createdAt, id: row.id }),
  cursorValues: (cursor) => [cursor.createdAt, cursor.id],
});

const pageByCreatedAt = ({
  cursor,
  limit,
  sort,
  ownerId,
}: PageByCreatedAtParams): Effect.Effect<
  PageByCreatedAtResult,
  SqlError.SqlError,
  DB
> =>
  Effect.gen(function* () {
    const db = yield* DB;

    let query = db
      .selectFrom('wishlists')
      .select(['id', 'createdAt'])
      .where('ownerId', '=', ownerId);

    const key = sort.keyColumns(expressionBuilder(query));

    key.forEach((k) => {
      query = query.orderBy(k, sort.direction);
    });

    if (cursor !== undefined) {
      query = query.where((eb) =>
        eb(
          eb.refTuple('createdAt', 'id'),
          sort.direction === 'desc' ? '<' : '>',
          eb.tuple(cursor.createdAt, cursor.id),
        ),
      );
    }

    const rows = yield* query.limit(limit + 1);
    const items = rows.slice(0, limit);

    const last = items.at(-1);
    const nextCursor =
      rows.length > limit && last !== undefined
        ? { createdAt: last.createdAt, id: last.id }
        : null;

    return { items, nextCursor };
  });

const walkAll = (ownerId: string, direction: Direction) =>
  Effect.gen(function* () {
    let cursor: Cursor | undefined;
    const pages: string[][] = [];

    for (let i = 1; i <= 10; i++) {
      const page = yield* pageByCreatedAt({
        ownerId,
        limit: 2,
        cursor,
        sort: makeSort(direction),
      });

      pages.push(page.items.map((p) => p.id));

      if (page.nextCursor === null) {
        break;
      }
      cursor = page.nextCursor;
    }

    return pages;
  });

describe('keyset test', () => {
  layer(testLayer, { timeout: '60 seconds' })('pageByCreatedAt', (it) => {
    it.effect(
      'walks all pages in both directions without gaps or repeats',
      () =>
        Effect.gen(function* () {
          const ownerId = yield* acquireFiveWishlists('example@test.com');

          expect(yield* walkAll(ownerId, 'desc')).toEqual([
            [W5.id, W4.id],
            [W3.id, W2.id],
            [W1.id],
          ]);

          expect(yield* walkAll(ownerId, 'asc')).toEqual([
            [W1.id, W2.id],
            [W3.id, W4.id],
            [W5.id],
          ]);
        }).pipe(Effect.scoped),
    );
  });
});
