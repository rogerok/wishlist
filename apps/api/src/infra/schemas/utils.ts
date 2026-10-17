import { Schema } from 'effect';

// Бренд в той форме, которую принимает Schema.brand: ровно один строковый литерал.
// Внутри обобщённой функции TypeScript не докажет это для голого Brand, поэтому тип берётся у Schema.brand.
export type BrandIdentifier<Brand extends string> = Parameters<
  typeof Schema.brand<Brand>
>[0];

export const makeBrandedSchema = <Brand extends string, S extends Schema.Top>(
  brand: BrandIdentifier<Brand>,
  schema: S,
) => schema.pipe(Schema.brand<Brand>(brand));

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
