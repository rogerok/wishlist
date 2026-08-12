import { Schema } from 'effect';

export const makeBrandedSchema = <
  Brand extends string,
  S extends Schema.Schema.Any,
>(
  brand: Brand,
  schema: S,
) => schema.pipe(Schema.brand(brand));

export const makeNullableStringSchema = (schema: Schema.Schema.All) =>
  Schema.transform(Schema.NullOr(Schema.String), Schema.NullOr(schema), {
    strict: true,
    decode: (value) => {
      if (value === null) {
        return null;
      }
      const normalized = value.trim();
      return normalized === '' ? null : normalized;
    },
    encode: (value) => value,
  });
