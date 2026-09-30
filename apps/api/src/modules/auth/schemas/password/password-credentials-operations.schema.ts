import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const PasswordCredentialsOperationsSchema = makeLiteralUnionSchema([
  'create',
  'getByIdUserId',
]);
export const PasswordCredentialsOperations =
  PasswordCredentialsOperationsSchema.values;
export type PasswordCredentialsOperations = Schema.Schema.Type<
  typeof PasswordCredentialsOperationsSchema
>;
