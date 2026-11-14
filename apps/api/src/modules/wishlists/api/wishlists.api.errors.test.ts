import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';

import {
  WishlistForbiddenProblem,
  WishlistOccasionDateOutOfWindowProblem,
} from '#modules/wishlists/api/wishlists.api.errors.js';
import { WishlistIdSchema } from '#modules/wishlists/schemas/wishlist.schema.js';
import {
  WishlistForbiddenError,
  WishlistOccasionDateOutOfWindowError,
} from '#modules/wishlists/wishlists.errors.js';

const id = WishlistIdSchema.make('00000000-0000-4000-8000-000000000001');

// Encode превращает ошибку домена в тело ответа: так его увидит клиент.
describe('WishlistForbiddenProblem', () => {
  it('encodes the error into the exact 403 body', () => {
    const body = Schema.encodeSync(WishlistForbiddenProblem)(
      new WishlistForbiddenError({ id }),
    );

    expect(body).toStrictEqual({
      code: 'WISHLIST_FORBIDDEN',
      detail: 'You cannot modify this wishlist',
      status: 403,
      title: 'Wishlist forbidden',
      type: '/errors/wishlist-forbidden',
      id,
      instance: `/api/wishlists/${id}`,
    });
  });
});

describe('WishlistOccasionDateOutOfWindowProblem', () => {
  it('encodes the error into the exact 400 body', () => {
    const body = Schema.encodeSync(WishlistOccasionDateOutOfWindowProblem)(
      new WishlistOccasionDateOutOfWindowError({
        id,
        min: '2026-11-11',
        max: '2031-11-12',
      }),
    );

    expect(body).toStrictEqual({
      code: 'WISHLIST_OCCASION_DATE_OUT_OF_WINDOW',
      detail: 'The occasion date is outside the allowed window',
      status: 400,
      title: 'Occasion date out of window',
      type: '/errors/wishlist-occasion-date-out-of-window',
      id,
      instance: `/api/wishlists/${id}`,
      min: '2026-11-11',
      max: '2031-11-12',
      errors: [
        {
          location: 'payload',
          path: ['occasionDate'],
          message: 'Expected a date between 2026-11-11 and 2031-11-12',
        },
      ],
    });
  });

  it('decodes the body back into the same error', () => {
    const error = new WishlistOccasionDateOutOfWindowError({
      id,
      min: '2026-11-11',
      max: '2031-11-12',
    });
    const codec = WishlistOccasionDateOutOfWindowProblem;

    expect(Schema.decodeSync(codec)(Schema.encodeSync(codec)(error))).toEqual(
      error,
    );
  });
});
