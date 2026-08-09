import { Schema } from 'effect';

import { makeEmailBrandedSchema } from '#schemas/email.schema.js';
import { makeIdBrandedSchema } from '#schemas/id.schema.js';

export const UserIdSchema = makeIdBrandedSchema('UserId');
export type UserId = Schema.Schema.Type<typeof UserIdSchema>;

export const UserEmailSchema = makeEmailBrandedSchema('UserEmail');
export type UserEmail = Schema.Schema.Type<typeof UserEmailSchema>;
export const UserNameSchema = Schema.String.pipe(Schema.maxLength(100));
