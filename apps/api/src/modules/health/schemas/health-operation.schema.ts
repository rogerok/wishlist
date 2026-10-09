import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const HealthOperationSchema = makeLiteralUnionSchema(['get']);
export type HealthOperation = Schema.Schema.Type<typeof HealthOperationSchema>;
export const HealthOperation = HealthOperationSchema.values;
