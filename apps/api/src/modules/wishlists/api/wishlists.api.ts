import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';

import { technicalHttpErrors } from '#infra/errors/technical-http-errors.js';
import { makePageSchema } from '#infra/pagination/page.js';
import { SessionAuthentication } from '#modules/auth/api/session-authentication.js';
import {
  wishlistsByIdPath,
  wishlistsCollectionPath,
  wishlistsGroupIdentifier,
} from '#modules/wishlists/api/wishlists.api.constants.js';
import {
  WishlistForbiddenProblem,
  WishlistNotFoundProblem,
  WishlistOccasionDateOutOfWindowProblem,
} from '#modules/wishlists/api/wishlists.api.errors.js';
import {
  CreateWishlistBodySchema,
  CreateWishlistResponseSchema,
} from '#modules/wishlists/schemas/wishlist-create.schema.js';
import { WishlistsOperations } from '#modules/wishlists/schemas/wishlist-operations.schema.js';
import { WishlistResponseSchema } from '#modules/wishlists/schemas/wishlist-response.schema.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';

import {
  UpdateWishlistBodySchema,
  UpdateWishlistResponseSchema,
} from '../schemas/wishlist-update.schema.js';
import {
  WishlistCursorCodec,
  WishlistQuerySchema,
} from '../schemas/wishlists-list-query.schema.js';

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
    HttpApiEndpoint.get(WishlistsOperations.listOwn, wishlistsCollectionPath, {
      query: WishlistQuerySchema,
      success: makePageSchema(WishlistResponseSchema, WishlistCursorCodec),
      error: technicalHttpErrors,
    }),
    HttpApiEndpoint.put(WishlistsOperations.update, wishlistsByIdPath, {
      params: { id: WishlistIdSchema },
      payload: UpdateWishlistBodySchema,
      success: UpdateWishlistResponseSchema,
      error: [
        ...technicalHttpErrors,
        WishlistNotFoundProblem,
        WishlistForbiddenProblem,
        WishlistOccasionDateOutOfWindowProblem,
      ],
    }),
    HttpApiEndpoint.delete(WishlistsOperations.delete, wishlistsByIdPath, {
      params: { id: WishlistIdSchema },
      success: HttpApiSchema.NoContent,
      error: [
        ...technicalHttpErrors,
        WishlistNotFoundProblem,
        WishlistForbiddenProblem,
      ],
    }),
  )
  .middleware(SessionAuthentication);
