import { Schema, SchemaTransformation } from 'effect';

type TextLength = {
  readonly max: number;
  readonly min: number;
};

const blankToNull = (value: string | null) => {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const makeTrimmedTextSchemas = ({ min, max }: TextLength) => {
  const length = Schema.isBetweenLength(min, max);

  return {
    input: Schema.Trim.check(length),
    stored: Schema.String.check(Schema.isTrimmed(), length),
  };
};

export const makeOptionalTextSchemas = ({ min, max }: TextLength) => {
  const stored = Schema.NullOr(
    Schema.String.check(Schema.isTrimmed(), Schema.isBetweenLength(min, max)),
  );
  const input = Schema.NullOr(Schema.String).pipe(
    Schema.decodeTo(
      stored,
      SchemaTransformation.transform({
        decode: blankToNull,
        encode: (value) => value,
      }),
    ),
  );

  return { input, stored };
};
