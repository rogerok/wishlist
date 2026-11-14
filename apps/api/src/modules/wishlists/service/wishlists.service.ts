import { Context, DateTime, Effect, Layer, Option, Result } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { CreateWishlistBody } from '#modules/wishlists/schemas/wishlist-create.schema.js';
import type {
  Wishlist,
  WishlistId,
} from '#modules/wishlists/schemas/wishlist.schema.js';
import type {
  CreatedAtCursor,
  OccasionDateCursor,
  PageSort,
  WithCursor,
} from '#modules/wishlists/wishlists.sorts.js';

import { DB } from '#infra/db/db.service.js';
import { sqlOperationFailed } from '#infra/db/repository-failure.js';
import { WishlistRepository } from '#modules/wishlists/repository/wishlists.repository.js';
import { WishlistsOperations } from '#modules/wishlists/schemas/wishlist-operations.schema.js';
import { checkDateWindow } from '#modules/wishlists/schemas/wishlist.schema.js';
import {
  WishlistForbiddenError,
  WishlistNotFoundError,
  WishlistOccasionDateOutOfWindowError,
} from '#modules/wishlists/wishlists.errors.js';

const source = 'wishlistsService';

export interface WishlistsServiceShape {
  readonly create: (
    ownerId: UserId,
    input: CreateWishlistBody,
  ) => Effect.Effect<Wishlist, OperationFailed>;
  readonly update: (
    viewerId: UserId,
    id: WishlistId,
    input: Pick<
      Wishlist,
      'description' | 'occasionDate' | 'title' | 'visibility'
    >,
  ) => Effect.Effect<
    Wishlist,
    | OperationFailed
    | WishlistForbiddenError
    | WishlistNotFoundError
    | WishlistOccasionDateOutOfWindowError
  >;
  readonly deleteById: (
    ownerId: UserId,
    id: WishlistId,
  ) => Effect.Effect<
    void,
    OperationFailed | WishlistForbiddenError | WishlistNotFoundError
  >;
  readonly getReadableById: (
    viewerId: UserId,
    id: WishlistId,
  ) => Effect.Effect<Wishlist, OperationFailed | WishlistNotFoundError>;
  readonly listOwn: (
    viewerId: UserId,
    page: PageSort,
  ) => Effect.Effect<
    WithCursor<Wishlist, CreatedAtCursor | OccasionDateCursor | null>,
    OperationFailed
  >;
}

export class WishlistsService extends Context.Service<
  WishlistsService,
  WishlistsServiceShape
>()('app/WishlistsService') {}

export const WishlistsServiceLive = Layer.effect(
  WishlistsService,
  Effect.gen(function* () {
    const repository = yield* WishlistRepository;
    const db = yield* DB;

    const create: WishlistsServiceShape['create'] = repository.create;
    const listOwn: WishlistsServiceShape['listOwn'] = repository.listOwn;

    const getReadableById: WishlistsServiceShape['getReadableById'] = (
      viewerId,
      id,
    ) =>
      Effect.gen(function* () {
        const wishlist = yield* repository.getReadableById(viewerId, id);

        return yield* Effect.fromOption(
          wishlist,
          () => new WishlistNotFoundError({ id }),
        );
      });

    const resolveMiss = (viewerId: UserId, id: WishlistId) =>
      Effect.gen(function* () {
        const readable = yield* repository.getReadableById(viewerId, id);

        return yield* Option.isSome(readable)
          ? Effect.fail(new WishlistForbiddenError({ id }))
          : Effect.fail(new WishlistNotFoundError({ id }));
      });

    const update: WishlistsServiceShape['update'] = (viewerId, id, input) =>
      db
        .withTransaction(
          Effect.gen(function* () {
            const locked = yield* repository.lockOwnById(viewerId, id);
            if (Option.isNone(locked)) {
              return yield* resolveMiss(viewerId, id);
            }

            const stored = locked.value.occasionDate;
            if (input.occasionDate !== null && input.occasionDate !== stored) {
              const window = checkDateWindow(
                input.occasionDate,
                yield* DateTime.now,
              );
              if (Result.isFailure(window)) {
                return yield* new WishlistOccasionDateOutOfWindowError({
                  id,
                  ...window.failure,
                });
              }
            }

            const updated = yield* repository.update(viewerId, id, input);

            return yield* Effect.fromOption(
              updated,
              () => new WishlistNotFoundError({ id }),
            );
          }),
        )
        .pipe(
          Effect.catchTag(
            'SqlError',
            sqlOperationFailed(source, WishlistsOperations.update),
          ),
        );

    const deleteById: WishlistsServiceShape['deleteById'] = (ownerId, id) =>
      Effect.gen(function* () {
        const deleted = yield* repository.deleteOwnById(ownerId, id);

        if (!deleted) {
          return yield* resolveMiss(ownerId, id);
        }
      });

    return { create, getReadableById, listOwn, update, deleteById };
  }),
);
