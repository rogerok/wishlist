import type { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#schemas/utils.js';

export const AuthOperationSchema = makeLiteralUnionSchema([
  'signup',
  'login',
  'logout',
  'me',
]);
export type AuthOperation = Schema.Schema.Type<typeof AuthOperationSchema>;
export const AuthOperation = AuthOperationSchema.values;
