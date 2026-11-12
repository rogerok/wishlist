import { describe, expect, layer } from '@effect/vitest';
import {
  Arbitrary,
  Array,
  Effect,
  Layer,
  Option,
  Order,
  Schema,
  Stream,
} from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';
import * as TestClock from 'effect/testing/TestClock';

import type { UserId } from '#modules/users/schemas/user.schema.js';
import type {
  CreatedAtCursor,
  OccasionDateCursor,
} from '#modules/wishlists/wishlists.sorts.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import {
  WishlistRepository,
  WishlistRepositoryLive,
} from '#modules/wishlists/repository/wishlists.repository.js';

const repositoryLayer = WishlistRepositoryLive.pipe(
  Layer.provideMerge(DBLive.pipe(Layer.provideMerge(TestDatabaseLive))),
);

// Удаление User каскадом удаляет его Wishlist: следующий тест видит пустую таблицу.
const acquireUser = (email: string) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const [user] = yield* sql<{ id: string }>`
        INSERT INTO "public"."users" ("email", "display_name")
        VALUES (${email}, 'Owner')
        RETURNING "id"
      `;

      return UserIdSchema.make(
        user?.id ?? (yield* Effect.die('INSERT did not return the user')),
      );
    }),
    (id) =>
      SqlClient.pipe(
        Effect.flatMap(
          (sql) => sql`DELETE FROM "public"."users" WHERE "id" = ${id}`,
        ),
        Effect.orDie,
      ),
  );

// Repository не даёт задать id и createdAt, поэтому строки для сортировки пишет SQL.
const insertWishlist = (ownerId: UserId, { createdAt, id }: Row) =>
  SqlClient.pipe(
    Effect.flatMap(
      (sql) => sql`
        INSERT INTO "public"."wishlists" ("id", "owner_id", "title", "created_at")
        VALUES (${id}, ${ownerId}, 'Books', ${createdAt.toISOString()})
      `,
    ),
    Effect.orDie,
  );

type Row = {
  createdAt: Date;
  id: string;
};

const byCreatedAt = Order.mapInput(
  Order.Date,
  (wishlist: Row) => wishlist.createdAt,
);
const byId = Order.mapInput(Order.String, (wishlist: Row) => wishlist.id);
const wishlistOrder = Order.flip(Order.combine(byCreatedAt, byId));

const createdAtArb = Arbitrary.schema(
  Schema.Literals([
    '2026-10-19T10:00:01.000Z',
    '2026-10-19T10:00:02.000Z',
    '2026-10-19T10:00:03.000Z',
  ]),
);

// id из индекса: два id в одном наборе не совпадут, и INSERT не упадёт на первичном ключе.
const idOf = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const rowsArb = Arbitrary.array(createdAtArb, { maxLength: 30 }).pipe(
  Arbitrary.map((dates) =>
    dates.map((date, index): Row => ({
      createdAt: new Date(date),
      id: idOf(index),
    })),
  ),
);

const limitArb = Arbitrary.schema(
  Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
);

// Clock в тестах `occasionDate`: первая страница берёт из него `asOf` = 2026-10-18.
const NOW = Date.parse('2026-10-18T12:00:00Z');
const AS_OF = '2026-10-18';

type OccasionRow = {
  id: string;
  occasionDate: string | null;
};

// Repository не даёт задать id, поэтому строки для сортировки пишет SQL.
const insertOccasionWishlist = (
  ownerId: UserId,
  { id, occasionDate }: OccasionRow,
) =>
  SqlClient.pipe(
    Effect.flatMap(
      (sql) => sql`
        INSERT INTO "public"."wishlists" ("id", "owner_id", "title", "occasion_date")
        VALUES (${id}, ${ownerId}, 'Books', ${occasionDate})
      `,
    ),
    Effect.orDie,
  );

// Порядок из спеки «Сортировка occasionDate», записанный без SQL: сначала Upcoming (сегодня и позже) от ближней даты
// к дальней, затем Past от недавней к давней, затем без даты; внутри равных по `id` по возрастанию.
// Для Upcoming и Past «ближе» значит меньше дней от `AS_OF`, поэтому обе группы сортируются по расстоянию.
const groupOf = ({ occasionDate }: OccasionRow) => {
  if (occasionDate === null) return 2;
  return occasionDate >= AS_OF ? 0 : 1;
};
const daysFromAsOf = ({ occasionDate }: OccasionRow) =>
  occasionDate === null
    ? 0
    : Math.abs(Date.parse(occasionDate) - Date.parse(AS_OF)) / 86_400_000;
const occasionOrder = Order.combineAll([
  Order.mapInput(Order.Number, groupOf),
  Order.mapInput(Order.Number, daysFromAsOf),
  Order.mapInput(Order.String, (row: OccasionRow) => row.id),
]);

// Даты по обе стороны от `AS_OF` на одинаковом расстоянии: 2026-10-17 и 2026-10-19 оба в одном дне от него, и
// порядок между ними решает группа. Пять дат и NULL на 30 строк дают много равных значений на границах страниц.
const occasionDateArb = Arbitrary.schema(
  Schema.NullOr(
    Schema.Literals([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]),
  ),
);

const occasionRowsArb = Arbitrary.array(occasionDateArb, {
  maxLength: 30,
}).pipe(
  Arbitrary.map((dates) =>
    dates.map((occasionDate, index): OccasionRow => ({
      id: idOf(index),
      occasionDate,
    })),
  ),
);

// Все страницы `sort=createdAt` одним потоком. `Stream.paginate` вызывает функцию с курсором предыдущей страницы:
// первый вызов получает `undefined`, следующие получают `nextCursor`. Поток кончается, когда функция вернёт
// `Option.none()`, то есть когда `nextCursor` равен `null`.
const listAllByCreatedAt = (ownerId: UserId, limit: number) =>
  Effect.gen(function* () {
    const repository = yield* WishlistRepository;

    const pages = Stream.paginate(
      undefined as CreatedAtCursor | undefined,
      (cursor) =>
        repository
          .listOwn(
            ownerId,
            cursor === undefined
              ? { sort: 'createdAt', limit }
              : { sort: 'createdAt', limit, cursor },
          )
          .pipe(
            Effect.flatMap(({ items, nextCursor }) =>
              nextCursor === null || nextCursor.sort === 'createdAt'
                ? Effect.succeed([
                    items,
                    Option.fromNullishOr(nextCursor),
                  ] as const)
                : Effect.die('createdAt page returned an occasionDate cursor'),
            ),
          ),
    );

    return yield* Stream.runCollect(pages);
  });

// Все страницы `sort=occasionDate` одним потоком, как `listAllByCreatedAt`.
const listAllByOccasionDate = (ownerId: UserId, limit: number) =>
  Effect.gen(function* () {
    const repository = yield* WishlistRepository;

    const pages = Stream.paginate(
      undefined as OccasionDateCursor | undefined,
      (cursor) =>
        repository
          .listOwn(
            ownerId,
            cursor === undefined
              ? { sort: 'occasionDate', limit }
              : { sort: 'occasionDate', limit, cursor },
          )
          .pipe(
            Effect.flatMap(({ items, nextCursor }) =>
              nextCursor === null || nextCursor.sort === 'occasionDate'
                ? Effect.succeed([
                    items,
                    Option.fromNullishOr(nextCursor),
                  ] as const)
                : Effect.die('occasionDate page returned a createdAt cursor'),
            ),
          ),
    );

    return yield* Stream.runCollect(pages);
  });

layer(repositoryLayer, { timeout: '60 seconds' })(
  'WishlistRepository listOwn traversal',
  (it) => {
    describe('createdAt', () => {
      // Пять Wishlist одного владельца. W3 и W4 созданы в одну миллисекунду, и порядок между ними решает id.
      // Порядок «новые сверху» (`created_at desc, id desc`): W5, W4, W3, W2, W1.
      // При limit = 2 граница первой страницы проходит между W4 и W3 с одинаковым временем.
      // id идут против времени: если пресет отсортирует по id раньше, чем по created_at, тест упадёт.
      it.effect(
        'Обход по limit = 2 выдаёт каждый Wishlist один раз',
        Effect.fn(function* () {
          const ownerId = yield* acquireUser('traversal@example.test');

          const w1 = '00000000-0000-4000-8000-000000000005';
          const w2 = '00000000-0000-4000-8000-000000000004';
          const w3 = '00000000-0000-4000-8000-000000000002';
          const w4 = '00000000-0000-4000-8000-000000000003';
          const w5 = '00000000-0000-4000-8000-000000000001';
          const rows = [
            {
              id: w1,
              createdAt: new Date('2026-10-19T10:00:01.000Z'),
            },
            {
              id: w2,
              createdAt: new Date('2026-10-19T10:00:02.000Z'),
            },

            { id: w3, createdAt: new Date('2026-10-19T10:00:03.000Z') },
            { id: w4, createdAt: new Date('2026-10-19T10:00:03.000Z') },
            {
              id: w5,
              createdAt: new Date('2026-10-19T10:00:04.000Z'),
            },
          ];

          yield* Effect.forEach(rows, (row) => insertWishlist(ownerId, row));
          const wishlists = yield* listAllByCreatedAt(ownerId, 2);
          const expected = Array.sort(rows, wishlistOrder);

          expect(
            wishlists.map(({ id, createdAt }) => ({ id, createdAt })),
          ).toEqual(expected);
        }, Effect.scoped),
      );

      it.effect.prop(
        'Обход любого набора выдаёт каждый Wishlist один раз в порядке Order',
        { rows: rowsArb, limit: limitArb },
        ({ rows, limit }) =>
          Effect.gen(function* () {
            const ownerId = yield* acquireUser('traversal@example.test');
            yield* Effect.forEach(rows, (row) => insertWishlist(ownerId, row));

            const wishlists = yield* listAllByCreatedAt(ownerId, limit);

            expect(
              wishlists.map(({ createdAt, id }) => ({ createdAt, id })),
            ).toEqual(Array.sort(rows, wishlistOrder));
          }).pipe(Effect.scoped),
        { arbitrary: { runs: 50, seed: 42 } },
      );
    });

    describe('occasionDate', () => {
      it.effect.prop(
        'Обход любого набора выдаёт каждый Wishlist один раз в порядке спеки',
        { rows: occasionRowsArb, limit: limitArb },
        ({ rows, limit }) =>
          Effect.gen(function* () {
            yield* TestClock.setTime(NOW);
            const ownerId = yield* acquireUser('traversal@example.test');
            yield* Effect.forEach(rows, (row) =>
              insertOccasionWishlist(ownerId, row),
            );

            const wishlists = yield* listAllByOccasionDate(ownerId, limit);

            expect(
              wishlists.map(({ id, occasionDate }) => ({ id, occasionDate })),
            ).toEqual(Array.sort(rows, occasionOrder));
          }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
        { arbitrary: { runs: 50, seed: 42 } },
      );
    });
  },
);
