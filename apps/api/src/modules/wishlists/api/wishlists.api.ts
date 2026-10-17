import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';

import { technicalHttpErrors } from '#infra/errors/technical-http-errors.js';
import { SessionAuthentication } from '#modules/auth/api/session-authentication.js';
import {
  wishlistsByIdPath,
  wishlistsCollectionPath,
  wishlistsGroupIdentifier,
} from '#modules/wishlists/api/wishlists.api.constants.js';
import { WishlistNotFoundProblem } from '#modules/wishlists/api/wishlists.api.errors.js';
import {
  CreateWishlistBodySchema,
  CreateWishlistResponseSchema,
} from '#modules/wishlists/schemas/create-wishlist.schema.js';
import { WishlistsOperations } from '#modules/wishlists/schemas/wishlist-operations.schema.js';
import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';

export const wishlistsGroup = HttpApiGroup.make(wishlistsGroupIdentifier)
  .add(
    HttpApiEndpoint.post(WishlistsOperations.create, wishlistsCollectionPath, {
      payload: CreateWishlistBodySchema,
      success: CreateWishlistResponseSchema,
      error: technicalHttpErrors,
    }),
    HttpApiEndpoint.get(
      WishlistsOperations.getReadableById,
      wishlistsByIdPath,
      {
        params: { id: WishlistIdSchema },
        success: WishlistResponseSchema,
        error: [...technicalHttpErrors, WishlistNotFoundProblem],
      },
    ),
  )
  .middleware(SessionAuthentication);
