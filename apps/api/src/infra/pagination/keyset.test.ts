import type { SqlError } from 'effect/sql';
import type { Expression } from 'kysely';

import { describe, layer, test } from '@effect/vitest';
import { DateTime, Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';
import * as TestClock from 'effect/testing/TestClock';
import {
  CamelCasePlugin,
  DummyDriver,
  expressionBuilder,
  Kysely,
  sql as kyselySql,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';

import type { DB as Database } from '#infra/db/generated/database.js';
import type { KeyPart, KeysetSort } from '#infra/pagination/keyset.js';

import { DB, DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { keyPart, NO_PARAMS, prepareKeyset } from '#infra/pagination/keyset.js';

type AsOfCursor = { readonly asOf: string } & DatedRow;

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
      sqlType: 'timestamptz',
    }),
    keyPart({
      column: (eb) => eb.ref('id'),
      value: (cursor) => cursor.id,
      sqlType: 'uuid',
    }),
  ],
  cursorOf: (row) => ({ createdAt: row.createdAt, id: row.id }),
  params: NO_PARAMS,
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
    const keyset = yield* prepareKeyset(sort, { cursor, limit });

    let rows = yield* db
      .selectFrom('wishlists')
      .select(['id', 'createdAt'])
      .where('ownerId', '=', ownerId)
      .$call(keyset.apply);

    return keyset.toPage(rows);
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

// Вычисляемый ключ без параметров: сначала Wishlist с Occasion Date, потом без неё.
const hasOccasionDate = (date: Expression<string | null>) =>
  kyselySql<number>`CASE WHEN ${date} IS NULL THEN 1 ELSE 0 END`;

type DatedRow = { readonly id: string; readonly occasionDate: string | null };

const datedFirst: KeysetSort<Database, 'wishlists', DatedRow, DatedRow> = {
  direction: 'asc',
  key: [
    keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      value: (cursor) => cursor.occasionDate,
      rule: hasOccasionDate,
    }),
    keyPart({
      sqlType: 'uuid',
      column: (eb) => eb.ref('id'),
      value: (cursor) => cursor.id,
    }),
  ],
  cursorOf: (row) => ({ id: row.id, occasionDate: row.occasionDate }),
  params: NO_PARAMS,
};

// Сортировка occasionDate (design, решение 5): сначала будущие даты от ближайшей, потом прошедшие от недавней, потом
// Wishlist без даты. asOf — сегодняшняя дата UTC на первой странице; дальше её приносит курсор.
const occasionDate: KeysetSort<
  Database,
  'wishlists',
  DatedRow,
  AsOfCursor,
  { asOf: 'date' }
> = {
  direction: 'asc',
  key: [
    keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      rule: (date, { asOf }) =>
        kyselySql<number>`CASE WHEN ${date} IS NULL THEN 2 WHEN ${date} >= ${asOf} THEN 0 ELSE 1 END`,
      value: (cursor) => cursor.occasionDate,
    }),
    keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      value: (cursor) => cursor.occasionDate,
      rule: (date, { asOf }) =>
        kyselySql<number>`CASE WHEN ${date} IS NULL THEN 0 WHEN ${date} >= ${asOf} THEN ${date} - ${asOf} ELSE ${asOf} - ${date} END`,
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
  cursorOf: (row, { asOf }) => ({ ...row, asOf }),
};

// id N1 стоит между D1 и D2: если правило не сработает и порядок решит id, N1 окажется в середине.
const D1 = {
  id: '00000000-0000-4000-8000-000000000011',
  occasionDate: '2026-12-31',
};
const N1 = { id: '00000000-0000-4000-8000-000000000012', occasionDate: null };
const D2 = {
  id: '00000000-0000-4000-8000-000000000013',
  occasionDate: '2026-01-01',
};

// Сценарий «Все три группы» (specs/wishlists, «Сортировка occasionDate») при asOf = 2026-10-18.
// id идут против ожидаемого порядка, кроме UL < UH: если правило группы или дней не сработает, порядок решит id,
// и тест упадёт. В скобках тройка (группа, дни).
const U1 = {
  id: '00000000-0000-4000-8000-000000000021',
  occasionDate: '2026-10-18',
}; // (0, 0)
const U2 = {
  id: '00000000-0000-4000-8000-000000000020',
  occasionDate: '2026-12-31',
}; // (0, 74)
const UL = {
  id: '00000000-0000-4000-8000-000000000018',
  occasionDate: '2027-01-15',
}; // (0, 89)
const UH = {
  id: '00000000-0000-4000-8000-000000000019',
  occasionDate: '2027-01-15',
}; // (0, 89)
const P1 = {
  id: '00000000-0000-4000-8000-000000000017',
  occasionDate: '2026-10-17',
}; // (1, 1)
const P2 = {
  id: '00000000-0000-4000-8000-000000000016',
  occasionDate: '2026-05-01',
}; // (1, 170)
const N = { id: '00000000-0000-4000-8000-000000000015', occasionDate: null }; // (2, 0)

type DatedWishlist = {
  readonly id: string;
  readonly occasionDate: string | null;
};

// Создаёт User и его Wishlist с occasion_date; возвращает id владельца.
const acquireDatedWishlists = (
  email: string,
  wishlists: ReadonlyArray<DatedWishlist>,
) =>
  Effect.gen(function* () {
    const sqlClient = yield* SqlClient;
    const ownerId = yield* acquireUser(email);

    yield* Effect.forEach(
      wishlists,
      (wishlist) =>
        sqlClient`
                INSERT INTO "public"."wishlists" ("id", "owner_id", "title", "occasion_date")
                VALUES (${wishlist.id}, ${ownerId}, 'Occasion', ${wishlist.occasionDate})
            `,
    );

    return ownerId;
  });

// Одна страница по occasionDate. asOf первой страницы даёт Clock, следующих: курсор.
const pageByOccasionDate = (
  ownerId: string,
  cursor: AsOfCursor | undefined,
  limit: number,
) =>
  Effect.gen(function* () {
    const db = yield* DB;
    const keyset = yield* prepareKeyset(occasionDate, { cursor, limit });
    const rows = yield* db
      .selectFrom('wishlists')
      .select(['id', 'occasionDate'])
      .where('ownerId', '=', ownerId)
      .$call(keyset.apply);

    return keyset.toPage(rows);
  });

// Обходит все страницы по limit 2 и возвращает id в порядке выдачи.
const walkByOccasionDate = (ownerId: string) =>
  Effect.gen(function* () {
    let cursor: AsOfCursor | undefined;
    const ids: string[] = [];

    for (let i = 1; i <= 10; i++) {
      const page = yield* pageByOccasionDate(ownerId, cursor, 2);

      ids.push(...page.items.map((row) => row.id));

      if (page.nextCursor === null) {
        break;
      }
      cursor = page.nextCursor;
    }

    return ids;
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
        const keyset = yield* prepareKeyset(sort, {
          cursor: undefined,
          limit: 2,
        });

        const rows = yield* db
          .selectFrom('wishlists')
          .select(['id', 'createdAt'])
          .where('ownerId', '=', ownerId)
          .orderBy('title', 'asc')
          .offset(5)
          .$call(keyset.apply);
        const page = keyset.toPage(rows);

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

    // limit 1 ставит курсор на каждую строку, в том числе на D2 перед N1 и на N1 с NULL. Без правила справа
    // PostgreSQL сравнил бы число с датой и вернул ошибку; без правила слева N1 с NULL выпал бы из WHERE.
    it.effect('applies the rule to both sides of the comparison', () =>
      Effect.gen(function* () {
        const db = yield* DB;
        const sqlClient = yield* SqlClient;
        const ownerId = yield* acquireUser('rule@example.test');

        yield* Effect.forEach(
          [D1, N1, D2],
          (wishlist) =>
            sqlClient`
                    INSERT INTO "public"."wishlists" ("id", "owner_id", "title", "occasion_date")
                    VALUES (${wishlist.id}, ${ownerId}, 'Dated', ${wishlist.occasionDate})
                `,
        );

        let cursor: DatedRow | undefined;
        const ids: string[] = [];

        for (let i = 1; i <= 10; i++) {
          // Внутри цикла: keyset запоминает cursor этой итерации.
          const keyset = yield* prepareKeyset(datedFirst, { cursor, limit: 1 });
          const rows = yield* db
            .selectFrom('wishlists')
            .select(['id', 'occasionDate'])
            .where('ownerId', '=', ownerId)
            .$call(keyset.apply);
          const page = keyset.toPage(rows);

          ids.push(...page.items.map((row) => row.id));

          if (page.nextCursor === null) {
            break;
          }
          cursor = page.nextCursor;
        }

        expect(ids).toEqual([D1.id, D2.id, N1.id]);
      }).pipe(Effect.scoped),
    );

    // limit 2 ставит границы страниц внутри групп и между ними: U2 | UL, UH | P1, P2 | N.
    it.effect(
      'walks occasionDate in three groups: upcoming, past, without date',
      () =>
        Effect.gen(function* () {
          const ownerId = yield* acquireDatedWishlists(
            'three-groups@example.test',
            [U1, U2, UL, UH, P1, P2, N],
          );
          // first возьмёт отсюда asOf = 2026-10-18.
          yield* TestClock.setTime(Date.parse('2026-10-18T12:00:00Z'));

          expect(yield* walkByOccasionDate(ownerId)).toEqual([
            U1.id,
            U2.id,
            UL.id,
            UH.id,
            P1.id,
            P2.id,
            N.id,
          ]);
        }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    );

    // Сценарий «Несколько Wishlist без Occasion Date»: у NL и NH обе тройки (2, 0), порядок решает id. Граница первой
    // страницы проходит между NL и NH.
    it.effect('orders wishlists without a date by id', () =>
      Effect.gen(function* () {
        const P = {
          id: '00000000-0000-4000-8000-000000000033',
          occasionDate: '2026-09-01',
        };
        const NL = {
          id: '00000000-0000-4000-8000-000000000031',
          occasionDate: null,
        };
        const NH = {
          id: '00000000-0000-4000-8000-000000000032',
          occasionDate: null,
        };
        const ownerId = yield* acquireDatedWishlists('no-dates@example.test', [
          P,
          NL,
          NH,
        ]);
        yield* TestClock.setTime(Date.parse('2026-10-18T12:00:00Z'));

        expect(yield* walkByOccasionDate(ownerId)).toEqual([
          P.id,
          NL.id,
          NH.id,
        ]);
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    );

    // Сценарий «В Москве уже завтра»: в 23:30 UTC в Москве 19 октября, но asOf считается по UTC, 2026-10-18. T
    // остаётся будущей (0, 0). По московской дате T стала бы прошедшей и ушла бы после F.
    it.effect('takes today by UTC, not by local time', () =>
      Effect.gen(function* () {
        const T = {
          id: '00000000-0000-4000-8000-000000000042',
          occasionDate: '2026-10-18',
        };
        const F = {
          id: '00000000-0000-4000-8000-000000000041',
          occasionDate: '2026-10-25',
        };
        const ownerId = yield* acquireDatedWishlists(
          'moscow-tomorrow@example.test',
          [T, F],
        );
        yield* TestClock.setTime(Date.parse('2026-10-18T23:30:00Z'));

        expect(yield* walkByOccasionDate(ownerId)).toEqual([T.id, F.id]);
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    );

    // Сценарий «Полночь посреди обхода»: курсор первой страницы хранит asOf = 2026-10-18. Если вторая страница
    // пересчитает asOf по часам (2026-10-19), X станет прошедшей, тройка курсора (1, 1, X) окажется больше тройки
    // Y (0, 74, Y), и Y пропадёт без ошибки.
    it.effect('keeps asOf from the first page after midnight', () =>
      Effect.gen(function* () {
        const X = {
          id: '00000000-0000-4000-8000-000000000053',
          occasionDate: '2026-10-18',
        };
        const Y = {
          id: '00000000-0000-4000-8000-000000000052',
          occasionDate: '2026-12-31',
        };
        const P = {
          id: '00000000-0000-4000-8000-000000000051',
          occasionDate: '2026-09-01',
        };
        const ownerId = yield* acquireDatedWishlists('midnight@example.test', [
          X,
          Y,
          P,
        ]);

        yield* TestClock.setTime(Date.parse('2026-10-18T23:59:00Z'));
        const first = yield* pageByOccasionDate(ownerId, undefined, 1);

        yield* TestClock.setTime(Date.parse('2026-10-19T00:01:00Z'));
        const second = yield* pageByOccasionDate(
          ownerId,
          first.nextCursor ?? undefined,
          2,
        );

        expect(first.items.map((row) => row.id)).toEqual([X.id]);
        expect(first.nextCursor).toMatchObject({ asOf: '2026-10-18' });
        expect(second.items.map((row) => row.id)).toEqual([Y.id, P.id]);
        expect(second.nextCursor).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
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

// Kysely без подключения к базе: строит текст SQL и не выполняет запросы. `sql` в этом файле занят SqlClient,
// поэтому шаблон Kysely импортирован как `kyselySql`.
const offlineDb = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
  plugins: [new CamelCasePlugin()],
});
const offlineEb = expressionBuilder<Database, 'wishlists'>();
const toSql = (expression: Expression<unknown>) =>
  kyselySql`${expression}`.compile(offlineDb);

describe('keyPart', () => {
  // Таблицу и курсор keyPart узнаёт из типа переменной: без него eb.ref не знает колонок.
  test('builds the left side from the column and the right side from the cast cursor value', () => {
    const createdAt: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      sqlType: 'timestamptz',
      column: (eb) => eb.ref('createdAt'),
      value: (cursor) => cursor.createdAt,
    });

    expect(toSql(createdAt.left(offlineEb, {}))).toMatchObject({
      sql: '"created_at"',
      parameters: [],
    });
    expect(toSql(createdAt.right(offlineEb, W1, {}))).toMatchObject({
      sql: 'cast($1 as timestamptz)',
      parameters: [W1.createdAt],
    });
  });

  test('builds both sides from one rule', () => {
    const datedPart: KeyPart<Database, 'wishlists', DatedRow> = keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      value: (cursor) => cursor.occasionDate,
      rule: (date) =>
        kyselySql<number>`CASE WHEN ${date} IS NULL THEN 1 ELSE 0 END`,
    });

    expect(toSql(datedPart.left(offlineEb, {}))).toMatchObject({
      sql: 'CASE WHEN "occasion_date" IS NULL THEN 1 ELSE 0 END',
      parameters: [],
    });
    expect(toSql(datedPart.right(offlineEb, N1, {}))).toMatchObject({
      sql: 'CASE WHEN cast($1 as date) IS NULL THEN 1 ELSE 0 END',
      parameters: [null],
    });
  });

  // Дальше проверки выполняет check-types: если ошибка типа исчезнет, директива ts-expect-error над ней сама станет
  // ошибкой. Вызовы expect нужны только для того, чтобы переменная использовалась.
  test('rejects a column and a cursor value of different types at compile time', () => {
    const wrong: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      sqlType: 'timestamptz',
      column: (eb) => eb.ref('createdAt'),
      // @ts-expect-error id (string) стоит в паре с created_at (Date)
      value: (cursor) => cursor.id,
    });

    expect(wrong).toBeDefined();
  });

  // cast(... as date) отрезает время: курсор 10:00:03 превратится в полночь, и вторая страница придёт пустой.
  test('rejects a cast type that does not match the column at compile time', () => {
    const wrongCast: KeyPart<Database, 'wishlists', Cursor> = keyPart({
      sqlType: 'date',
      // @ts-expect-error created_at (Date), а sqlType 'date' ждёт string
      column: (eb) => eb.ref('createdAt'),
      // @ts-expect-error cursor.createdAt (Date), а sqlType 'date' ждёт string
      value: (cursor) => cursor.createdAt,
    });

    expect(wrongCast).toBeDefined();
  });

  // NULL в ключе: сравнение кортежей даёт «неизвестно», и WHERE молча отбрасывает строку (design, решение 4).
  test('rejects a column that may be NULL without a rule at compile time', () => {
    const nullable: KeyPart<Database, 'wishlists', DatedRow> = keyPart({
      sqlType: 'date',
      // @ts-expect-error occasion_date может быть NULL, а rule не передан
      column: (eb) => eb.ref('occasionDate'),
      // @ts-expect-error occasion_date может быть NULL, а rule не передан
      value: (cursor) => cursor.occasionDate,
    });

    expect(nullable).toBeDefined();
  });

  test('rejects a rule whose result may be NULL at compile time', () => {
    const nullResult: KeyPart<Database, 'wishlists', DatedRow> = keyPart({
      sqlType: 'date',
      // @ts-expect-error правило вернуло вход как есть, и NULL остался в ключе
      column: (eb) => eb.ref('occasionDate'),
      // @ts-expect-error правило вернуло вход как есть, и NULL остался в ключе
      value: (cursor) => cursor.occasionDate,
      rule: (date) => date,
    });

    expect(nullResult).toBeDefined();
  });

  // Объект без keyPart мог бы пропустить приведение типа или правило на одной из сторон.
  test('rejects a key part written without keyPart at compile time', () => {
    // @ts-expect-error компонент создаётся только через keyPart
    const raw: KeyPart<Database, 'wishlists', Cursor> = {
      left: (eb) => eb.ref('createdAt'),
      right: (eb, cursor) => eb.val(cursor.createdAt),
    };

    expect(raw).toBeDefined();
  });
});

// Параметр ключа на примере `asOf`, сегодняшней даты. Пресет объявляет только имя и SQL-тип параметра
// (`{ asOf: 'date' }`), а `cast($n as date)` строит модуль. Запрос собирается через offlineDb и не выполняется.
describe('key params', () => {
  // На первой странице `asOf` даёт `first` (позже здесь будет Clock), на следующих курсор.
  const upcomingFirst: KeysetSort<
    Database,
    'wishlists',
    DatedRow,
    AsOfCursor,
    { asOf: 'date' }
  > = {
    direction: 'asc',
    key: [
      keyPart({
        sqlType: 'date',
        column: (eb) => eb.ref('occasionDate'),
        value: (cursor) => cursor.occasionDate,
        // asOf уже имеет вид cast($n as date): приводить его к типу здесь не нужно.
        rule: (date, { asOf }) =>
          kyselySql<number>`CASE WHEN ${date} >= ${asOf} THEN 0 ELSE 1 END`,
      }),
      keyPart({
        sqlType: 'uuid',
        column: (eb) => eb.ref('id'),
        value: (cursor) => cursor.id,
      }),
    ],
    cursorOf: (row, { asOf }) => ({ ...row, asOf }),
    params: {
      first: Effect.succeed({ asOf: '2026-10-18' }),
      types: { asOf: 'date' },
      fromCursor: (cursor) => ({ asOf: cursor.asOf }),
    },
  };

  const compilePage = (cursor: AsOfCursor | undefined) => {
    const keyset = Effect.runSync(
      prepareKeyset(upcomingFirst, { cursor, limit: 2 }),
    );

    return offlineDb
      .selectFrom('wishlists')
      .select(['id', 'occasionDate'])
      .$call(keyset.apply)
      .compile();
  };

  test('takes asOf from first on the first page and casts it in SQL', () => {
    expect(compilePage(undefined)).toMatchObject({
      sql:
        'select "id", "occasion_date" from "wishlists" ' +
        'order by CASE WHEN "occasion_date" >= cast($1 as date) THEN 0 ELSE 1 END asc, "id" asc ' +
        'limit $2',
      parameters: ['2026-10-18', 3],
    });
  });

  // Курсор хранит asOf первой страницы. Если бы модуль взял его из first, в параметрах был бы '2026-10-18'.
  test('takes asOf from the cursor on the next pages', () => {
    const cursor: AsOfCursor = { ...D2, asOf: '2026-10-17' };

    expect(compilePage(cursor)).toMatchObject({
      parameters: [
        '2026-10-17', // asOf слева в WHERE
        D2.occasionDate, // occasionDate из курсора справа
        '2026-10-17', // asOf справа
        D2.id, // id из курсора
        '2026-10-17', // asOf в ORDER BY
        3, // limit 2 + 1
      ],
    });
  });

  test('passes the param values to cursorOf', () => {
    const keyset = Effect.runSync(
      prepareKeyset(upcomingFirst, { cursor: undefined, limit: 1 }),
    );
    const page = keyset.toPage([D1, D2]);

    expect(page.nextCursor).toEqual({ ...D1, asOf: '2026-10-18' });
  });

  // Дальше проверки выполняет check-types.
  test('rejects a rule that reads asOf in a sort without params at compile time', () => {
    const noAsOf: KeyPart<Database, 'wishlists', DatedRow> = keyPart({
      sqlType: 'date',
      column: (eb) => eb.ref('occasionDate'),
      value: (cursor) => cursor.occasionDate,
      // @ts-expect-error у пресета без параметров нет asOf
      rule: (date, { asOf }) =>
        kyselySql<number>`CASE WHEN ${date} >= ${asOf} THEN 0 ELSE 1 END`,
    });

    expect(noAsOf).toBeDefined();
  });

  test('rejects a first value of the wrong type at compile time', () => {
    const wrongFirst: KeysetSort<
      Database,
      'wishlists',
      DatedRow,
      AsOfCursor,
      { asOf: 'date' }
    >['params'] = {
      // @ts-expect-error asOf: 'date' ждёт строку '2026-10-18', а не Date
      first: Effect.succeed({ asOf: new Date('2026-10-18') }),
      types: { asOf: 'date' },
      fromCursor: (cursor) => ({ asOf: cursor.asOf }),
    };

    expect(wrongFirst).toBeDefined();
  });
});
