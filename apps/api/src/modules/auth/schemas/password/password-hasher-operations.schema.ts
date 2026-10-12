import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const PasswordHasherOperationSchema = makeLiteralUnionSchema([
  'hash',
  'verify',
]);
export const PasswordHasherOperation = PasswordHasherOperationSchema.values;
export type PasswordHasherOperation = Schema.Schema.Type<
  typeof PasswordHasherOperationSchema
>;
