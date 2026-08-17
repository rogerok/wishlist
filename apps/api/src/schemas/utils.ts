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

type LiteralUnionValues<Literals extends ReadonlyArray<string>> = {
  readonly [Literal in Literals[number]]: Literal;
};

export const makeLiteralUnionSchema = <
  const Literals extends ReadonlyArray<string>,
>(
  literals: Literals,
) => {
  const values = Object.fromEntries(
    literals.map((l) => [l, l]),
  ) as LiteralUnionValues<Literals>;

  return Object.assign(Schema.Literals(literals), {
    values: Object.freeze(values),
  });
};
