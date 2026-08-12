import { Schema } from 'effect';

export const ensureSchema = <
  TType,
  TSchema extends Schema.Schema<TType, any, any>,
>(
  schema: TSchema,
): TSchema => schema;
