import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/http-api';

import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import {
  WishlistDescriptionInputSchema,
  WishlistOccasionDateInputSchema,
  WishlistTitleInputSchema,
  WishlistVisibilitySchema,
} from '#modules/wishlists/schemas/wishlist.schema.js';

export const CreateWishlistBodySchema = Schema.Struct({
  description: WishlistDescriptionInputSchema,
  title: WishlistTitleInputSchema,
  visibility: WishlistVisibilitySchema,
  occasionDate: WishlistOccasionDateInputSchema,
});

export type CreateWishlistBody = Schema.Schema.Type<
  typeof CreateWishlistBodySchema
>;

export const CreateWishlistResponseSchema = WishlistResponseSchema.pipe(
  HttpApiSchema.status(201),
);
