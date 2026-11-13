import { Schema } from 'effect';

import type { WishlistId } from '#modules/wishlists/schemas/wishlist.schema.js';

import { domainProblem } from '#infra/errors/http-problem.js';
import {
  makeBadRequestBody,
  makeForbiddenBody,
  makeNotFoundBody,
} from '#infra/errors/problem-bodies.js';
import { RequestValidationIssueSchema } from '#infra/errors/request-validation.js';
import { CalendarDate } from '#infra/schemas/dates.schema.js';
import { wishlistsCollectionPath } from '#modules/wishlists/api/wishlists.api.constants.js';
import {
  windowMessage,
  WishlistIdSchema,
} from '#modules/wishlists/schemas/wishlist.schema.js';
import {
  WishlistForbiddenError,
  WishlistNotFoundError,
  WishlistOccasionDateOutOfWindowError,
} from '#modules/wishlists/wishlists.errors.js';

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

export const WishlistForbiddenBody = makeForbiddenBody(
  {
    code: 'WISHLIST_FORBIDDEN',
    detail: 'You cannot modify this wishlist',
    title: 'Wishlist forbidden',
    type: '/errors/wishlist-forbidden',
  },
  {
    id: WishlistIdSchema,
    instance: WishlistByIdInstanceSchema,
  },
);

export const WishlistForbiddenProblem = domainProblem({
  body: WishlistForbiddenBody,
  error: WishlistForbiddenError,
  status: 403,
  decode: ({ id }) => new WishlistForbiddenError({ id }),
  encode: ({ id }) =>
    WishlistForbiddenBody.make({ id, instance: makeByIdInstance(id) }),
});

export const WishlistOccasionDateOutOfWindowBody = makeBadRequestBody(
  {
    code: 'WISHLIST_OCCASION_DATE_OUT_OF_WINDOW',
    detail: 'The occasion date is outside the allowed window',
    title: 'Occasion date out of window',
    type: '/errors/wishlist-occasion-date-out-of-window',
  },
  {
    id: WishlistIdSchema,
    instance: WishlistByIdInstanceSchema,
    min: CalendarDate,
    max: CalendarDate,
    // Ровно одна запись: кортеж не даст encode положить ноль или две.
    errors: Schema.Tuple([RequestValidationIssueSchema]),
  },
);

export const WishlistOccasionDateOutOfWindowProblem = domainProblem({
  body: WishlistOccasionDateOutOfWindowBody,
  error: WishlistOccasionDateOutOfWindowError,
  status: 400,
  decode: ({ id, min, max }) =>
    new WishlistOccasionDateOutOfWindowError({ id, min, max }),
  encode: ({ id, min, max }) =>
    WishlistOccasionDateOutOfWindowBody.make({
      id,
      instance: makeByIdInstance(id),
      min,
      max,
      errors: [
        {
          location: 'payload',
          path: ['occasionDate'],
          message: windowMessage({ min, max }),
        },
      ],
    }),
});
