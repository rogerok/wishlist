import { Schema } from 'effect';

import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { UserOperationSchema } from '#modules/users/schemas/users-operations.schema.js';
import { makeLiteralUnionSchema } from '#schemas/utils.js';

export const UserLogEventSchema = makeLiteralUnionSchema([
  'users.operation.failed',
]);
export const UserLogEvent = UserLogEventSchema.values;
export type UserLogEvent = Schema.Schema.Type<typeof UserLogEventSchema>;

export const UserFailureReasonSchema = makeLiteralUnionSchema([
  'dataIntegrity',
  'unavailable',
]);
export const UserFailureReason = UserFailureReasonSchema.values;
export type UserFailureReason = Schema.Schema.Type<
  typeof UserFailureReasonSchema
>;

export const UserFailureLogAnnotationSchema = Schema.Struct({
  event: UserLogEventSchema,
  reason: UserFailureReasonSchema,
  operation: UserOperationSchema,
  userId: Schema.NullOr(UserIdSchema),
});
export type UserFailureLogAnnotation = Schema.Schema.Type<
  typeof UserFailureLogAnnotationSchema
>;
