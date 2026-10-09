import { Schema } from 'effect';

import { ExpiresAtSchema } from '#modules/auth/schemas/auth.schema.js';
import { SessionIdSchema } from '#modules/auth/schemas/session/session.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

export const AuthenticatedSessionSchema = Schema.Struct({
  sessionId: SessionIdSchema,
  user: UserResponseSchema,
  expiresAt: ExpiresAtSchema,
});

export type AuthenticatedSession = Schema.Schema.Type<
  typeof AuthenticatedSessionSchema
>;
