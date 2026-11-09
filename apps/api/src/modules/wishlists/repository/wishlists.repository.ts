import { Context, Effect, Layer, Option, Schema } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { PageCursor, ParamSpec } from '#infra/pagination/keyset.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';
import type {
  Wishlist,
  WishlistId,
} from '#modules/wishlists/schemas/wishlist.schema.js';
import type {
  CreatedAtCursor,
  OccasionDateCursor,
  PageSort,
  WishlistSort,
  WithCursor,
} from '#modules/wishlists/wishlists.sorts.js';

import { DB } from '#infra/db/db.service.js';
import {
  invalidRecordFailed,
  sqlOperationFailed,
} from '#infra/db/repository-failure.js';
import { prepareKeyset } from '#infra/pagination/keyset.js';
import { WishlistsOperations } from '#modules/wishlists/schemas/wishlist-operations.schema.js';
import { WishlistSchema } from '#modules/wishlists/schemas/wishlist.schema.js';
import { wishlistsSort } from '#modules/wishlists/wishlists.sorts.js';

const source = 'wishlistsRepository';

const mapRepoError = (operation: WishlistsOperations) =>
  sqlOperationFailed(source, operation);

const getSomeOrNone = (row: unknown, operation: WishlistsOperations) =>
  Option.match(Option.fromUndefinedOr(row), {
    onNone: () => Effect.succeedNone,
    onSome: (some) => decodeRow(some, operation).pipe(Effect.asSome),
  });

const decodeRow = (row: unknown, operation: WishlistsOperations) =>
  Schema.decodeUnknownEffect(WishlistSchema)(row).pipe(
    Effect.mapError(invalidRecordFailed(source, operation)),
  );

interface WishlistsRepositoryShape {
  readonly create: (
    ownerId: UserId,
    input: CreateWishlistBody,
  ) => Effect.Effect<Wishlist, OperationFailed>;
  readonly getReadableById: (
    viewerId: UserId,
    id: WishlistId,
  ) => Effect.Effect<Option.Option<Wishlist>, OperationFailed>;
  readonly listOwn: (
    viewerId: UserId,
    page: PageSort,
  ) => Effect.Effect<
    WithCursor<Wishlist, CreatedAtCursor | OccasionDateCursor | null>,
    OperationFailed
  >;
}

export class WishlistRepository extends Context.Service<
  WishlistRepository,
  WishlistsRepositoryShape
>()('app/WishlistRepository') {}

export const WishlistRepositoryLive = Layer.effect(
  WishlistRepository,
  Effect.gen(function* () {
    const db = yield* DB;

    const listPage = <Cursor, Spec extends ParamSpec>(
      viewerId: UserId,
      sort: WishlistSort<Cursor, Spec>,
      page: PageCursor<Cursor>,
    ) =>
      Effect.gen(function* () {
        const keyset = yield* prepareKeyset(sort, page);

        const rows = yield* db
          .selectFrom('wishlists')
          .selectAll()
          .where('ownerId', '=', viewerId)
          .$call(keyset.apply)
          .pipe(Effect.mapError(mapRepoError(WishlistsOperations.listOwn)));

        const { items, nextCursor } = keyset.toPage(rows);
        const decoded = yield* Effect.forEach(items, (row) =>
          decodeRow(row, WishlistsOperations.listOwn),
        );
        return { items: decoded, nextCursor };
      });

    const create: WishlistsRepositoryShape['create'] = (
      ownerId,
      { title, description, occasionDate, visibility },
    ) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insertInto('wishlists')
          .values({ title, description, occasionDate, visibility, ownerId })
          .returningAll()
          .pipe(Effect.mapError(mapRepoError(WishlistsOperations.create)));

        return yield* decodeRow(row, WishlistsOperations.create);
      });

    const getReadableById: WishlistsRepositoryShape['getReadableById'] = (
      viewerId,
      id,
    ) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .selectFrom('wishlists')
          .selectAll()
          .where('id', '=', id)
          .where((eb) =>
            eb.or([
              eb('ownerId', '=', viewerId),
              eb('visibility', '=', 'public'),
            ]),
          )
          .pipe(
            Effect.mapError(mapRepoError(WishlistsOperations.getReadableById)),
          );

        return yield* getSomeOrNone(row, WishlistsOperations.getReadableById);
      });

    const listOwn: WishlistsRepositoryShape['listOwn'] = (viewerId, page) =>
      Effect.gen(function* () {
        if (page.sort === 'createdAt') {
          return yield* listPage(viewerId, wishlistsSort.createdAt, page);
        }

        return yield* listPage(viewerId, wishlistsSort.occasionDate, page);
      });

    return { create, getReadableById, listOwn };
  }),
);
