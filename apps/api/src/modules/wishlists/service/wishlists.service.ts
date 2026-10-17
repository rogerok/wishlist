import { Context, Effect, Layer } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';
import type {
  Wishlist,
  WishlistId,
} from '#modules/wishlists/schemas/wishlist.schema.js';

import { WishlistRepository } from '#modules/wishlists/repository/wishlists.repository.js';
import { WishlistNotFoundError } from '#modules/wishlists/wishlists.errors.js';

export interface WishlistsServiceShape {
  readonly create: (
    ownerId: UserId,
    input: CreateWishlistBody,
  ) => Effect.Effect<Wishlist, OperationFailed>;
  readonly getReadableById: (
    viewerId: UserId,
    id: WishlistId,
  ) => Effect.Effect<Wishlist, OperationFailed | WishlistNotFoundError>;
}

export class WishlistsService extends Context.Service<
  WishlistsService,
  WishlistsServiceShape
>()('app/WishlistsService') {}

export const WishlistsServiceLive = Layer.effect(
  WishlistsService,
  Effect.gen(function* () {
    const repository = yield* WishlistRepository;

    const create: WishlistsServiceShape['create'] = repository.create;

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

    return { create, getReadableById };
  }),
);
