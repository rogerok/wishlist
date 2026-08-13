import { Schema } from 'effect';

export const HealthResponseSchema = Schema.Struct({
  status: Schema.Literal('OK'),
});
