import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';

export const PasswordCredentialsOperationSchema = makeLiteralUnionSchema([
  'create',
  'getByIdUserId',
]);
export const PasswordCredentialsOperation =
  PasswordCredentialsOperationSchema.values;
export type PasswordCredentialsOperation = Schema.Schema.Type<
  typeof PasswordCredentialsOperationSchema
>;
