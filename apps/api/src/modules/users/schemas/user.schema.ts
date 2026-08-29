import { Schema } from 'effect';

import { makeEmailBrandedSchema } from '#infra/schemas/email.schema.js';
import { makeNullableStringSchema } from '#infra/schemas/utils.js';
import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';

export const UserIdSchema = makeIdBrandedSchema('UserId');
export type UserId = Schema.Schema.Type<typeof UserIdSchema>;

export const UserEmailSchema = makeEmailBrandedSchema('UserEmail');
export type UserEmail = Schema.Schema.Type<typeof UserEmailSchema>;
export const UserNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(255)),
);

export const UserNameInputSchema = makeNullableStringSchema(UserNameSchema);
