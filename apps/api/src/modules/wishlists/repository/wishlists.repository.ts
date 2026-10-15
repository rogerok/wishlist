// TODO(you): create(ownerId, input) — INSERT … RETURNING 8 полей;
//  getReadableById(viewerId, id) — WHERE id AND (owner_id = viewer OR visibility = 'public') → Option.
// TODO(you): ошибки — OperationFailed через sqlOperationFailed/invalidRecordFailed
//  (образец: users/repository/users.repository.ts).

import type { Effect } from 'effect';
import { Context, Layer } from 'effect';

import type { OperationFailed } from '#infra/errors/operation-failed.js';
import type { UserId } from '#modules/users/schemas/user.schema.js';
import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';
import type { Wishlist } from '#modules/wishlists/schemas/wishlist.schema.js';

import { DB } from '#infra/db/db.service.js';

interface WishlistsRepositoryShape {
  readonly create: (
    ownerId: UserId,
    input: CreateWishlistBody,
  ) => Effect.Effect<Wishlist, OperationFailed>;
}

export class WishlistRepository extends Context.Service<
  WishlistRepository,
  WishlistsRepositoryShape
>()('app/WishlistRepository') {}

// export const WishlistRepositoryLive = Layer.effect(
//   WishlistRepository,
//   Effect.gen(function* () {
//     const db = yield* DB;
//
//     const create: WishlistsRepositoryShape['create'] = (ownerId, input) =>
//       Effect.gen(function* () {
//         // const [row] = yield* db.insertInto('wishlist')
//       });
//
//     return { create };
//   }),
// );
