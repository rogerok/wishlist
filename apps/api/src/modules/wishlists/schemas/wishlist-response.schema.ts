import { Schema } from 'effect';

import { wishlistFields } from '#modules/wishlists/schemas/wishlist.schema.js';

export const WishlistResponseSchema = Schema.Struct({
  ...wishlistFields,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
});
