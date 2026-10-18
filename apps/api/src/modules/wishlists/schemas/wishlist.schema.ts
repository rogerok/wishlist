import { DateTime, Effect, Schema, SchemaGetter } from 'effect';

import { CalendarDate } from '#infra/schemas/dates.schema.js';
import {
  makeOptionalTextSchemas,
  makeTrimmedTextSchemas,
} from '#infra/schemas/strings.schema.js';
import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';
import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

const MIN_DATE_TIME_WINDOW_DAYS = 1;
const MAX_DATE_TIME_WINDOW_YEARS = 5;

export const WishlistIdSchema = makeIdBrandedSchema('WishlistId');
export type WishlistId = Schema.Schema.Type<typeof WishlistIdSchema>;

const title = makeTrimmedTextSchemas({ min: 1, max: 255 });
export const WishlistTitleSchema = title.stored;
export const WishlistTitleInputSchema = title.input;

const description = makeOptionalTextSchemas({ min: 1, max: 1000 });
export const WishlistDescriptionSchema = description.stored;
export const WishlistDescriptionInputSchema = description.input;

export const WishlistVisibilitySchema = makeLiteralUnionSchema([
  'private',
  'public',
]);

export const WishlistOccasionDateSchema = Schema.NullOr(CalendarDate);

const occasionDateWindow = (now: DateTime.Utc) => {
  const today = DateTime.startOf(now, 'day');

  return {
    min: DateTime.formatIsoDateUtc(
      DateTime.subtract(today, { days: MIN_DATE_TIME_WINDOW_DAYS }),
    ),
    max: DateTime.formatIsoDateUtc(
      DateTime.add(today, { years: MAX_DATE_TIME_WINDOW_YEARS }),
    ),
  };
};

export const CalendarDateInWindow = CalendarDate.pipe(
  Schema.decode({
    decode: SchemaGetter.checkEffect((value: string) =>
      Effect.gen(function* () {
        const { min, max } = occasionDateWindow(yield* DateTime.now);

        return (
          (value >= min && value <= max) ||
          `Expected a date between ${min} and ${max}`
        );
      }),
    ),
    encode: SchemaGetter.passthrough(),
  }),
);

export const WishlistOccasionDateInputSchema =
  Schema.NullOr(CalendarDateInWindow);

export const wishlistFields = {
  id: WishlistIdSchema,
  ownerId: UserIdSchema,
  title: WishlistTitleSchema,
  description: WishlistDescriptionSchema,
  occasionDate: WishlistOccasionDateSchema,
  visibility: WishlistVisibilitySchema,
} as const;

export const WishlistSchema = Schema.Struct({
  ...wishlistFields,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type Wishlist = Schema.Schema.Type<typeof WishlistSchema>;
