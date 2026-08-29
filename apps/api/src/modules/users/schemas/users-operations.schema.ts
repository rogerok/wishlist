import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const UserOperationSchema = makeLiteralUnionSchema([
  'create',
  'delete',
  'getAll',
  'getById',
  'update',
]);
export const UserOperation = UserOperationSchema.values;
export type UserOperation = Schema.Schema.Type<typeof UserOperationSchema>;
