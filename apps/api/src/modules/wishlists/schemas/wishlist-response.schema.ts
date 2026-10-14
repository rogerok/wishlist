// TODO(you): JSON из 8 полей, timestamps строками ISO 8601 (образец: users/schemas/user-response.schema.ts; задача 1.4).

import { Schema } from 'effect';

import {
  WishlistDescriptionSchema,
  wishlistFields,
  WishlistOccasionDateSchema,
  WishlistSchema,
  WishlistTitleSchema,
  WishlistVisibilitySchema,
} from '#modules/wishlists/schemas/wishlist.schema.js';

export const WishlistResponseSchema = Schema.Struct({
  ...wishlistFields,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
});
