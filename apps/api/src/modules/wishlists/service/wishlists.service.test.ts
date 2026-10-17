import { describe, expect, layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';
import { WishlistsService } from '#modules/wishlists/service/wishlists.service.js';
import { WishlistNotFoundError } from '#modules/wishlists/wishlists.errors.js';
import { WishlistsModuleLive } from '#modules/wishlists/wishlists.module.js';

const serviceLayer = WishlistsModuleLive.pipe(
  Layer.provideMerge(DBLive.pipe(Layer.provideMerge(TestDatabaseLive))),
);

// Service получает уже нормализованный input: trim и null делает Schema.
const body = (
  overrides: Partial<CreateWishlistBody> = {},
): CreateWishlistBody => ({
  title: 'Books',
  description: null,
  occasionDate: null,
  visibility: 'private',
  ...overrides,
});

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

interface WishlistRow {
  readonly description: string | null;
  readonly id: string;
  readonly occasionDate: string | null;
  readonly ownerId: string;
  readonly title: string;
  readonly visibility: string;
}

// Состояние таблицы читается мимо repository.
const selectWishlists = SqlClient.pipe(
  Effect.flatMap(
    (sql) => sql<WishlistRow>`
      SELECT "id", "owner_id", "title", "description", "occasion_date", "visibility"
      FROM "public"."wishlists"
      ORDER BY "created_at", "id"
    `,
  ),
  Effect.orDie,
);

const readers = [
  {
    name: 'Владелец читает Private Wishlist',
    visibility: 'private',
    byOwner: true,
  },
  {
    name: 'Владелец читает Public Wishlist',
    visibility: 'public',
    byOwner: true,
  },
  {
    name: 'Другой User читает Public Wishlist',
    visibility: 'public',
    byOwner: false,
  },
] as const;

layer(serviceLayer, { timeout: '60 seconds' })('WishlistsService', (it) => {
  describe('create', () => {
    it.effect('Создание минимального Wishlist', () =>
      Effect.gen(function* () {
        const service = yield* WishlistsService;
        const ownerId = yield* acquireUser('a@example.test');

        const wishlist = yield* service.create(ownerId, body());

        expect(yield* selectWishlists).toEqual([
          {
            id: wishlist.id,
            ownerId,
            title: 'Books',
            description: null,
            occasionDate: null,
            visibility: 'private',
          },
        ]);
        expect(wishlist.createdAt).toBeInstanceOf(Date);
        expect(wishlist.updatedAt).toBeInstanceOf(Date);
      }),
    );

    it.effect('Несколько Wishlist одного User', () =>
      Effect.gen(function* () {
        const service = yield* WishlistsService;
        const ownerId = yield* acquireUser('a@example.test');
        const first = yield* service.create(
          ownerId,
          body({ description: 'Art', occasionDate: '2028-02-29' }),
        );
        const [firstRow] = yield* selectWishlists;

        const second = yield* service.create(ownerId, body());

        const rows = yield* selectWishlists;
        expect(rows).toHaveLength(2);
        expect(second.id).not.toBe(first.id);
        expect(rows.every((row) => row.ownerId === ownerId)).toBe(true);
        expect(rows.find((row) => row.id === first.id)).toEqual(firstRow);
      }),
    );
  });

  describe('getReadableById', () => {
    it.effect.each(readers)('$name', ({ visibility, byOwner }) =>
      Effect.gen(function* () {
        const service = yield* WishlistsService;
        const ownerId = yield* acquireUser('a@example.test');
        const otherId = yield* acquireUser('b@example.test');
        const created = yield* service.create(
          ownerId,
          body({ description: 'Art', occasionDate: '2028-02-29', visibility }),
        );

        const read = yield* service.getReadableById(
          byOwner ? ownerId : otherId,
          created.id,
        );

        expect(read).toEqual(created);
      }),
    );

    it.effect('Чужой Private Wishlist', () =>
      Effect.gen(function* () {
        const service = yield* WishlistsService;
        const ownerId = yield* acquireUser('a@example.test');
        const otherId = yield* acquireUser('b@example.test');
        const created = yield* service.create(ownerId, body());

        const error = yield* Effect.flip(
          service.getReadableById(otherId, created.id),
        );

        expect(error).toEqual(new WishlistNotFoundError({ id: created.id }));
      }),
    );

    it.effect('Отсутствующий Wishlist', () =>
      Effect.gen(function* () {
        const service = yield* WishlistsService;
        const viewerId = yield* acquireUser('a@example.test');
        const id = WishlistIdSchema.make(
          '00000000-0000-4000-8000-0000000000aa',
        );

        const error = yield* Effect.flip(service.getReadableById(viewerId, id));

        expect(error).toEqual(new WishlistNotFoundError({ id }));
      }),
    );

    // Дата вне текущего окна create: read её не проверяет.
    it.effect('Чтение старой Occasion Date', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        const service = yield* WishlistsService;
        const ownerId = yield* acquireUser('a@example.test');
        const [row] = yield* sql<{ id: string }>`
          INSERT INTO "public"."wishlists" ("owner_id", "title", "occasion_date")
          VALUES (${ownerId}, 'Books', '2020-02-29')
          RETURNING "id"
        `;
        const id = WishlistIdSchema.make(
          row?.id ?? (yield* Effect.die('INSERT did not return the id')),
        );

        const read = yield* service.getReadableById(ownerId, id);

        expect(read.occasionDate).toBe('2020-02-29');
      }),
    );
  });
});
