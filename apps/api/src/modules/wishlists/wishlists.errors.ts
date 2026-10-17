import { Data } from 'effect';

import type { WishlistId } from '#modules/wishlists/schemas/wishlist.schema.js';

export class WishlistNotFoundError extends Data.TaggedError(
  'WishlistNotFoundError',
)<{
  readonly id: WishlistId;
}> {}
