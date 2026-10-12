import { DateTime, Effect, Schema, SchemaGetter } from 'effect';

import { CalendarDate } from '#infra/schemas/dates.schema.js';
import {
  makeOptionalTextSchemas,
  makeTrimmedTextSchemas,
} from '#infra/schemas/strings.schema.js';
import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';
import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';

export const WishlistIdSchema = makeIdBrandedSchema('WishlistId');

const title = makeTrimmedTextSchemas({ min: 1, max: 255 });
export const WishlistTitleSchema = title.stored;
export const WishlistTitleInputSchema = title.input;

const description = makeOptionalTextSchemas({ min: 1, max: 1000 });
export const WishlistDescriptionSchema = description.stored;
export const WishlistDescriptionInputSchema = description.input;

export const WishlistVisibility = makeLiteralUnionSchema(['private', 'public']);

export const WishlistOccasionDateSchema = Schema.NullOr(CalendarDate);

const occasionDateWindow = (now: DateTime.Utc) => {
  const today = DateTime.startOf(now, 'day');

  return {
    min: DateTime.formatIsoDateUtc(DateTime.subtract(today, { days: 1 })),
    max: DateTime.formatIsoDateUtc(DateTime.add(today, { years: 5 })),
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
