import { Schema } from 'effect';

import { makeLiteralUnionSchema } from '#infra/schemas/utils.js';
import { AuthOperationSchema } from '#modules/auth/schemas/auth-operations.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const AuhLogEventSchema = makeLiteralUnionSchema([
  'auth.operation.failed',
]);
export const AuthLogEvent = AuhLogEventSchema.values;
export type AuthLogEvent = Schema.Schema.Type<typeof AuhLogEventSchema>;

export const AuthFailureReasonSchema = makeLiteralUnionSchema([
  'unavailable',
  'dataIntegrity',
  'internal',
]);
export const AuthFailureReason = AuthFailureReasonSchema.values;
export type AuthFailureReason = Schema.Schema.Type<
  typeof AuthFailureReasonSchema
>;

export const AuthFailureLogAnnotationSchema = Schema.Struct({
  event: AuhLogEventSchema,
  reason: AuthFailureReasonSchema,
  operation: AuthOperationSchema,
  userId: Schema.NullOr(UserIdSchema),
});
export type AuthFailureLogAnnotation = Schema.Schema.Type<
  typeof AuthFailureLogAnnotationSchema
>;
