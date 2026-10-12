import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const AccountOperationSchema = makeLiteralUnionSchema([
  'updateDisplayName',
]);

export const AccountOperation = AccountOperationSchema.values;
export type AccountOperation = Schema.Schema.Type<
  typeof AccountOperationSchema
>;
