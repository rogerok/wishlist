import { Schema } from 'effect';

import { makeIdBrandedSchema } from '#infra/schemas/uuid4.schema.js';
import { ExpiresAtSchema } from '#modules/auth/schemas/auth.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const SessionIdSchema = makeIdBrandedSchema('SessionId');
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>;

export const SessionSchema = Schema.Struct({
  id: SessionIdSchema,
  userId: UserIdSchema,
  createdAt: Schema.Date,
  expiresAt: ExpiresAtSchema,
});

export type Session = Schema.Schema.Type<typeof SessionSchema>;
