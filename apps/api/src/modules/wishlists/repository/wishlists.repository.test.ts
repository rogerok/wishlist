import { describe, expect, layer } from '@effect/vitest';
import { Effect, Layer, Option } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';

import { DBLive } from '#infra/db/db.service.js';
import { TestDatabaseLive } from '#infra/db/test-database.layer.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import {
  WishlistRepository,
  WishlistRepositoryLive,
} from '#modules/wishlists/repository/wishlists.repository.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';

const repositoryLayer = WishlistRepositoryLive.pipe(
  Layer.provideMerge(DBLive.pipe(Layer.provideMerge(TestDatabaseLive))),
);

const body = (
  overrides: Partial<CreateWishlistBody> = {},
): CreateWishlistBody => ({
  title: 'Books',
  description: null,
  occasionDate: null,
  visibility: 'private',
  ...overrides,
});

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

layer(repositoryLayer, { timeout: '60 seconds' })(
  'WishlistRepository',
  (it) => {
    describe('create', () => {
      it.effect(
        'returns the saved Wishlist with a server id and timestamps',
        () =>
          Effect.gen(function* () {
            const repository = yield* WishlistRepository;
            const ownerId = yield* acquireUser('create@example.test');

            const wishlist = yield* repository.create(
              ownerId,
              body({
                description: 'Art',
                occasionDate: '2028-02-29',
                visibility: 'public',
              }),
            );

            expect(wishlist).toMatchObject({
              ownerId,
              title: 'Books',
              description: 'Art',
              occasionDate: '2028-02-29',
              visibility: 'public',
            });
            expect(wishlist.id).toEqual(expect.any(String));
            expect(wishlist.createdAt).toBeInstanceOf(Date);
            expect(wishlist.updatedAt).toBeInstanceOf(Date);
          }).pipe(Effect.scoped),
      );

      it.effect(
        'creates several Wishlist with different ids for one owner',
        () =>
          Effect.gen(function* () {
            const repository = yield* WishlistRepository;
            const ownerId = yield* acquireUser('several@example.test');

            const first = yield* repository.create(ownerId, body());
            const second = yield* repository.create(ownerId, body());

            expect(first.id).not.toBe(second.id);
          }).pipe(Effect.scoped),
      );

      it.effect('ignores an id passed in the input', () =>
        Effect.gen(function* () {
          const repository = yield* WishlistRepository;
          const ownerId = yield* acquireUser('extra@example.test');
          const chosenId = '00000000-0000-4000-8000-000000000abc';
          const inputWithExtras = { ...body(), id: chosenId };

          const wishlist = yield* repository.create(ownerId, inputWithExtras);

          expect(wishlist.id).not.toBe(chosenId);
        }).pipe(Effect.scoped),
      );
    });

    describe('getReadableById', () => {
      const readMatrix = [
        {
          name: 'the owner reads a private',
          visibility: 'private',
          reader: 'owner',
          found: true,
        },
        {
          name: 'the owner reads a public',
          visibility: 'public',
          reader: 'owner',
          found: true,
        },
        {
          name: 'another User reads a public',
          visibility: 'public',
          reader: 'other',
          found: true,
        },
        {
          name: 'another User reads a private',
          visibility: 'private',
          reader: 'other',
          found: false,
        },
      ] as const;

      it.effect.each(readMatrix)(
        '$name Wishlist → found: $found',
        ({ visibility, reader, found }) =>
          Effect.gen(function* () {
            const repository = yield* WishlistRepository;
            const ownerId = yield* acquireUser(
              `owner-${visibility}-${reader}@example.test`,
            );
            const otherId = yield* acquireUser(
              `other-${visibility}-${reader}@example.test`,
            );
            const created = yield* repository.create(
              ownerId,
              body({ visibility }),
            );

            const result = yield* repository.getReadableById(
              reader === 'owner' ? ownerId : otherId,
              created.id,
            );

            expect(result).toEqual(
              found ? Option.some(created) : Option.none(),
            );
          }).pipe(Effect.scoped),
      );

      it.effect('returns none for an id that does not exist', () =>
        Effect.gen(function* () {
          const repository = yield* WishlistRepository;
          const viewerId = yield* acquireUser('missing@example.test');

          const result = yield* repository.getReadableById(
            viewerId,
            WishlistIdSchema.make('00000000-0000-4000-8000-0000000000ff'),
          );

          expect(result).toEqual(Option.none());
        }).pipe(Effect.scoped),
      );

      it.effect('returns a past Occasion Date unchanged', () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          const repository = yield* WishlistRepository;
          const ownerId = yield* acquireUser('past-date@example.test');
          const [row] = yield* sql<{ id: string }>`
          INSERT INTO "public"."wishlists" ("owner_id", "title", "occasion_date")
          VALUES (${ownerId}, 'Birthday', '2020-02-29')
          RETURNING "id"
        `;

          const result = yield* repository.getReadableById(
            ownerId,
            WishlistIdSchema.make(row?.id ?? ''),
          );

          expect(
            Option.map(result, (wishlist) => wishlist.occasionDate),
          ).toEqual(Option.some('2020-02-29'));
        }).pipe(Effect.scoped),
      );

      it.effect(
        'fails with dataIntegrity when a stored row breaks the schema',
        () =>
          Effect.gen(function* () {
            const sql = yield* SqlClient;
            const repository = yield* WishlistRepository;
            const ownerId = yield* acquireUser('corrupted@example.test');
            yield* Effect.acquireRelease(
              sql`ALTER TABLE "public"."wishlists" DROP CONSTRAINT "wishlists_title_not_blank_check"`,
              () =>
                Effect.gen(function* () {
                  yield* sql`DELETE FROM "public"."wishlists" WHERE btrim("title") = ''`;
                  yield* sql`
                ALTER TABLE "public"."wishlists"
                ADD CONSTRAINT "wishlists_title_not_blank_check" CHECK (btrim("title") <> '')
              `;
                }).pipe(Effect.orDie),
            );
            const [row] = yield* sql<{ id: string }>`
          INSERT INTO "public"."wishlists" ("owner_id", "title")
          VALUES (${ownerId}, '   ')
          RETURNING "id"
        `;

            const error = yield* Effect.flip(
              repository.getReadableById(
                ownerId,
                WishlistIdSchema.make(row?.id ?? ''),
              ),
            );

            expect(error).toMatchObject({
              _tag: 'OperationFailed',
              reason: 'dataIntegrity',
              source: 'wishlistsRepository',
              operation: 'getReadableById',
            });
          }).pipe(Effect.scoped),
      );
    });
  },
);
