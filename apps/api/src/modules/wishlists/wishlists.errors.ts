import { Data } from 'effect';

import type {
  OccasionDateWindow,
  WishlistId,
} from '#modules/wishlists/schemas/wishlist.schema.js';

export class WishlistNotFoundError extends Data.TaggedError(
  'WishlistNotFoundError',
)<{
  readonly id: WishlistId;
}> {}

export class WishlistForbiddenError extends Data.TaggedError(
  'WishlistForbiddenError',
)<{ readonly id: WishlistId }> {}

export class WishlistOccasionDateOutOfWindowError extends Data.TaggedError(
  'WishlistOccasionDateOutOfWindowError',
)<{ readonly id: WishlistId } & OccasionDateWindow> {}
