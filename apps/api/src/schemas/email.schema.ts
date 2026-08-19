import { Schema, SchemaTransformation } from 'effect';

import { makeBrandedSchema } from '#schemas/utils.js';

const ValidEmailSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(255)),
  Schema.check(
    Schema.makeFilter<string>(
      (value) => {
        const at = value.indexOf('@');
        const dot = value.lastIndexOf('.');

        return (
          at > 0 &&
          at === value.lastIndexOf('@') &&
          dot > at + 1 &&
          dot < value.length - 1 &&
          !/\s/u.test(value)
        );
      },
      {
        expected: 'an email address',
      },
    ),
  ),
);

export const EmailSchema = Schema.String.pipe(
  Schema.decodeTo(
    ValidEmailSchema,
    SchemaTransformation.transform({
      encode: (value) => value,
      decode: (value) => value.trim().toLowerCase(),
    }),
  ),
);

export const makeEmailBrandedSchema = <const Brand extends string>(
  brand: Brand,
) => makeBrandedSchema(brand, EmailSchema);
