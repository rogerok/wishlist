import { Schema } from 'effect';

export const HealthResponseBodySchema = Schema.Struct({
  status: Schema.Literal('OK'),
});

export type HealthResponseBody = Schema.Schema.Type<
  typeof HealthResponseBodySchema
>;
