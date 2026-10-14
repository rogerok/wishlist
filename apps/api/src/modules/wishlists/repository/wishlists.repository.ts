// TODO(you): create(ownerId, input) — INSERT … RETURNING 8 полей;
//  getReadableById(viewerId, id) — WHERE id AND (owner_id = viewer OR visibility = 'public') → Option.
// TODO(you): ошибки — OperationFailed через sqlOperationFailed/invalidRecordFailed
//  (образец: users/repository/users.repository.ts).

import type { CreateWishlistBody } from '#modules/wishlists/schemas/create-wishlist.schema.js';
import type { Effect } from 'effect';
import type { Wishlist } from '#modules/wishlists/schemas/wishlist.schema.js';

interface WishlistsRepositoryShape {
  readonly create: (input: CreateWishlistBody) => Effect.Effect<Wishlist>;
}
