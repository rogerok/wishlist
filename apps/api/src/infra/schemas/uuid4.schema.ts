import { Schema } from 'effect';

import { makeBrandedSchema } from '#infra/schemas/utils.js';

export const Uuid4Schema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      { expected: 'a UUID v4' },
    ),
  ),
);

export const makeIdBrandedSchema = <Brand extends string>(brand: Brand) =>
  makeBrandedSchema(brand, Uuid4Schema);
