import { Schema } from 'effect';

export const ensureSchema = <TType, TSchema extends Schema.Schema<TType>>(
  schema: TSchema,
): TSchema => schema;
