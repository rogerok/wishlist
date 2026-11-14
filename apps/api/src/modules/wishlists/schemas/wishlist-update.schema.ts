import { Schema } from 'effect';

import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import {
  WishlistDescriptionInputSchema,
  WishlistOccasionDateSchema,
  WishlistTitleInputSchema,
  WishlistVisibilitySchema,
} from '#modules/wishlists/schemas/wishlist.schema.js';

export const UpdateWishlistBodySchema = Schema.Struct({
  description: WishlistDescriptionInputSchema,
  title: WishlistTitleInputSchema,
  visibility: WishlistVisibilitySchema,
  occasionDate: WishlistOccasionDateSchema,
});

export type UpdateWishlistBody = Schema.Schema.Type<
  typeof UpdateWishlistBodySchema
>;

export const UpdateWishlistResponseSchema = WishlistResponseSchema;
