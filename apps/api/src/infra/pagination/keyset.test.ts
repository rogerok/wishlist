import type { SqlError } from 'effect/sql';

import { describe, layer, test } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

import type { DB as Database } from '#infra/db/generated/database.js';
import type { KeyPart, KeysetSort } from '#infra/pagination/keyset.js';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { applyKeyset, keyPart, toPage } from '#infra/pagination/keyset.js';

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

// Пять Wishlist одного владельца. W3 и W4 созданы в одну миллисекунду, и порядок между ними решает id.
// Порядок «новые сверху» (`created_at desc, id desc`): W5, W4, W3, W2, W1.
// При limit = 2 граница первой страницы проходит между W4 и W3 с одинаковым временем.
// id идут против времени: если пресет отсортирует по id раньше, чем по created_at, тесты обхода упадут.
const W1 = {
  id: '00000000-0000-4000-8000-000000000005',
  createdAt: new Date('2026-10-19T10:00:01.000Z'),
};
const W2 = {
  id: '00000000-0000-4000-8000-000000000004',
  createdAt: new Date('2026-10-19T10:00:02.000Z'),
};
const W3 = {
  id: '00000000-0000-4000-8000-000000000002',
  createdAt: new Date('2026-10-19T10:00:03.000Z'),
};
const W4 = {
  id: '00000000-0000-4000-8000-000000000003',
  createdAt: new Date('2026-10-19T10:00:03.000Z'),
};
const W5 = {
  id: '00000000-0000-4000-8000-000000000001',
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

type PageByCreatedAtParams = {
  cursor: Cursor | undefined;
  limit: number;
  ownerId: string;
  sort: KeysetSort<Database, 'wishlists', Row, Cursor>;
};
type Cursor = { readonly createdAt: Date; readonly id: string };
type PageByCreatedAtResult = {
  readonly items: Row[];
  nextCursor: Cursor | null;
};

type Row = { readonly createdAt: Date; readonly id: string };

type Direction = 'asc' | 'desc';

const makeSort = (
  direction: Direction,
): KeysetSort<Database, 'wishlists', Row, Cursor> => ({
  direction,
  key: [
    keyPart({
      column: (eb) => eb.ref('createdAt'),
      value: (cursor) => cursor.createdAt,
    }),
    keyPart({ column: (eb) => eb.ref('id'), value: (cursor) => cursor.id }),
  ],
  cursorOf: (row) => ({ createdAt: row.createdAt, id: row.id }),
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

    let rows = yield* db
      .selectFrom('wishlists')
      .select(['id', 'createdAt'])
      .where('ownerId', '=', ownerId)
      .$call(applyKeyset(sort, { limit, cursor }));

    return toPage(sort, limit, rows);
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

    // Пользователь модуля уже добавил свою сортировку и смещение: порядок и размер выборки задаёт только модуль
    // (design, решение 4). Его WHERE по владельцу при этом сохраняется.
    it.effect('ignores ORDER BY and OFFSET set by the caller', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const ownerId = yield* acquireFiveWishlists(
          'foreign-order@example.test',
        );
        const sort = makeSort('desc');

        const rows = yield* db
          .selectFrom('wishlists')
          .select(['id', 'createdAt'])
          .where('ownerId', '=', ownerId)
          .orderBy('title', 'asc')
          .offset(5)
          .$call(applyKeyset(sort, { cursor: undefined, limit: 2 }));
        const page = toPage(sort, 2, rows);

        expect(page.items.map((row) => row.id)).toEqual([W5.id, W4.id]);
      }).pipe(Effect.scoped),
    );

    // Признак последней страницы — только отсутствие строк после выданных, а не «пришло меньше limit».
    it.effect('returns a null nextCursor only when no rows remain', () =>
      Effect.gen(function* () {
        const ownerId = yield* acquireFiveWishlists('last-page@example.test');
        const sort = makeSort('desc');

        const exactlyAll = yield* pageByCreatedAt({
          ownerId,
          limit: 5,
          cursor: undefined,
          sort,
        });
        const oneLeft = yield* pageByCreatedAt({
          ownerId,
          limit: 4,
          cursor: undefined,
          sort,
        });

        expect(exactlyAll.items).toHaveLength(5);
        expect(exactlyAll.nextCursor).toBeNull();
        expect(oneLeft.items).toHaveLength(4);
        expect(oneLeft.nextCursor).toEqual({
          createdAt: W2.createdAt,
          id: W2.id,
        });
      }).pipe(Effect.scoped),
    );

    // Курсор хранит значения ключа, а не номер строки, поэтому следующая страница может быть другого размера.
    it.effect('continues from the cursor with another limit', () =>
      Effect.gen(function* () {
        const ownerId = yield* acquireFiveWishlists('other-limit@example.test');
        const sort = makeSort('desc');

        const first = yield* pageByCreatedAt({
          ownerId,
          limit: 1,
          cursor: undefined,
          sort,
        });
        const second = yield* pageByCreatedAt({
          ownerId,
          limit: 3,
          cursor: first.nextCursor ?? undefined,
          sort,
        });

        expect(first.items.map((row) => row.id)).toEqual([W5.id]);
        expect(second.items.map((row) => row.id)).toEqual([
          W4.id,
          W3.id,
          W2.id,
        ]);
      }).pipe(Effect.scoped),
    );

    // Курсор — значения, а не ссылка на строку: удаление строки, на которой он стоит, обход не ломает.
    it.effect('continues after the last row of the page is deleted', () =>
      Effect.gen(function* () {
        const sqlClient = yield* SqlClient;
        const ownerId = yield* acquireFiveWishlists('deleted-row@example.test');
        const sort = makeSort('desc');

        const first = yield* pageByCreatedAt({
          ownerId,
          limit: 2,
          cursor: undefined,
          sort,
        });
        yield* sqlClient`DELETE FROM "public"."wishlists" WHERE "id" = ${W4.id}`;
        const second = yield* pageByCreatedAt({
          ownerId,
          limit: 2,
          cursor: first.nextCursor ?? undefined,
          sort,
        });

        expect(first.items.map((row) => row.id)).toEqual([W5.id, W4.id]);
        expect(second.items.map((row) => row.id)).toEqual([W3.id, W2.id]);
      }).pipe(Effect.scoped),
    );
  });
});

describe('KeysetSort', () => {
  // Проверки выполняются в check-types: если ошибка типа исчезнет,
  // директива ts-expect-error над ней сама станет ошибкой (design, решение 4).
  test('rejects an empty key at compile time', () => {
    const emptyKey: KeysetSort<Database, 'wishlists', Row, Cursor> = {
      direction: 'desc',
      // @ts-expect-error ключ должен содержать хотя бы один компонент
      key: [],
      cursorOf: (row) => row,
    };

    expect(emptyKey.direction).toBe('desc');
  });
});

describe('keyPart', () => {
  // Таблицу и курсор keyPart узнаёт из типа переменной: без него eb.ref не знает колонок.
  test('accepts a column and a cursor value of the same type', () => {
    const createdAt: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      column: (eb) => eb.ref('createdAt'),
      value: (cursor) => cursor.createdAt,
    });

    expect(createdAt.value(W1)).toEqual(W1.createdAt);
  });

  test('rejects a column and a cursor value of different types at compile time', () => {
    const wrong: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      column: (eb) => eb.ref('createdAt'),
      // @ts-expect-error id (string) стоит в паре с created_at (Date)
      value: (cursor) => cursor.id,
    });

    expect(wrong.value(W1)).toBe(W1.id);
  });

  // NULL в ключе: сравнение кортежей даёт «неизвестно», и WHERE молча отбрасывает строку (design, решение 4).
  test('rejects a column that may be NULL at compile time', () => {
    const nullable: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      // @ts-expect-error occasion_date может быть NULL
      column: (eb) => eb.ref('occasionDate'),
      value: (cursor) => cursor.id,
    });

    expect(nullable.value(W1)).toBe(W1.id);
  });

  // Объект без keyPart не проходит проверку пары: здесь created_at (Date) стоит в паре с id (string).
  test('rejects a key part written without keyPart at compile time', () => {
    // @ts-expect-error компонент создаётся только через keyPart
    const raw: KeyPart<Database, 'wishlists', Cursor> = {
      column: (eb) => eb.ref('createdAt'),
      value: (cursor) => cursor.id,
    };

    expect(raw.value(W1)).toBe(W1.id);
  });
});
