import { Schema } from 'effect';

import { makeEmailBrandedSchema } from '#schemas/email.schema.js';
import { makeIdBrandedSchema } from '#schemas/id.schema.js';
import { makeNullableStringSchema } from '#schemas/utils.js';

export const UserIdSchema = makeIdBrandedSchema('UserId');
export type UserId = Schema.Schema.Type<typeof UserIdSchema>;

export const UserEmailSchema = makeEmailBrandedSchema('UserEmail');
export type UserEmail = Schema.Schema.Type<typeof UserEmailSchema>;
export const UserNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(255),
);

export const NullableUserNameSchema = makeNullableStringSchema(UserNameSchema);
