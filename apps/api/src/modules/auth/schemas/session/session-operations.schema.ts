import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const SessionOperationsSchema = makeLiteralUnionSchema([
  'create',
  'getByTokenDigest',
  'deleteByTokenDigest',
]);

export const SessionOperations = SessionOperationsSchema.values;
export type SessionOperations = Schema.Schema.Type<
  typeof SessionOperationsSchema
>;
