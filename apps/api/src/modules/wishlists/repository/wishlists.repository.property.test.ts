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

import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { CreatedAtCursor } from '#modules/wishlists/wishlists.sorts.js';

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

const rowsArb = Arbitrary.array(createdAtArb, { maxLength: 30 }).pipe(
  Arbitrary.map((dates) =>
    dates.map((date, index): Row => ({
      createdAt: new Date(date),
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    })),
  ),
);

const limitArb = Arbitrary.schema(
  Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
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
  },
);
