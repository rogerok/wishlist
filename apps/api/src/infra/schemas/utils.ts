import { Schema } from 'effect';

export const makeBrandedSchema = <Brand extends string, S extends Schema.Top>(
  brand: Brand,
  schema: S,
) => schema.pipe(Schema.brand(brand));

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

export const withRequestParseOptions = <S extends Schema.Top>(
  schema: S,
): S['Rebuild'] =>
  schema.annotate({
    parseOptions: {
      errors: 'all',
      onExcessProperty: 'error',
    },
  });
