import { Schema, SchemaTransformation } from 'effect';

export const makeBrandedSchema = <Brand extends string, S extends Schema.Top>(
  brand: Brand,
  schema: S,
) => schema.pipe(Schema.brand(brand));

export const makeNullableStringSchema = <S extends Schema.Codec<string>>(
  schema: S,
) =>
  Schema.NullOr(Schema.String).pipe(
    Schema.decodeTo(
      Schema.NullOr(schema),
      SchemaTransformation.transform({
        decode: (value) => {
          if (value === null) {
            return null;
          }
          const normalized = value.trim();
          return normalized === '' ? null : normalized;
        },
        encode: (value) => value,
      }),
    ),
  );
