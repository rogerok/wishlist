import type { Schema } from 'effect';

import { makeEmailBrandedSchema } from '#infra/schemas/email.schema.js';
import { makeTrimmedTextSchemas } from '#infra/schemas/strings.schema.js';
import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';

export const UserIdSchema = makeIdBrandedSchema('UserId');
export type UserId = Schema.Schema.Type<typeof UserIdSchema>;

export const UserEmailSchema = makeEmailBrandedSchema('UserEmail');
export type UserEmail = Schema.Schema.Type<typeof UserEmailSchema>;

const displayName = makeTrimmedTextSchemas({ min: 1, max: 100 });
export const UserDisplayNameSchema = displayName.stored;
export const UserDisplayNameInputSchema = displayName.input;
