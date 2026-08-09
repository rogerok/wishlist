import { Schema } from 'effect';

export const makeBrandedSchema = <
  Brand extends string,
  S extends Schema.Schema.Any,
>(
  brand: Brand,
  schema: S,
) => schema.pipe(Schema.brand(brand));
