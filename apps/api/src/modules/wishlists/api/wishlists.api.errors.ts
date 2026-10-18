import { Schema } from 'effect';

import type { WishlistId } from '#modules/wishlists/schemas/wishlist.schema.js';

import { domainProblem } from '#infra/errors/http-problem.js';
import { makeNotFoundBody } from '#infra/errors/problem-bodies.js';
import { wishlistsCollectionPath } from '#modules/wishlists/api/wishlists.api.constants.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';
import { WishlistNotFoundError } from '#modules/wishlists/wishlists.errors.js';

export const WishlistByIdInstanceSchema = Schema.TemplateLiteral([
  wishlistsCollectionPath,
  '/',
  WishlistIdSchema,
]);

export const makeByIdInstance = (id: WishlistId) =>
  `${wishlistsCollectionPath}/${id}` as const;

export const WishlistNotFoundBody = makeNotFoundBody(
  {
    code: 'WISHLIST_NOT_FOUND',
    detail: 'The requested wishlist does not exist',
    title: 'Wishlist not found',
    type: '/errors/wishlist-not-found',
  },
  {
    id: WishlistIdSchema,
    instance: WishlistByIdInstanceSchema,
  },
);

export const WishlistNotFoundProblem = domainProblem({
  body: WishlistNotFoundBody,
  error: WishlistNotFoundError,
  status: 404,
  decode: ({ id }) => new WishlistNotFoundError({ id }),
  encode: ({ id }) =>
    WishlistNotFoundBody.make({ id, instance: makeByIdInstance(id) }),
});
