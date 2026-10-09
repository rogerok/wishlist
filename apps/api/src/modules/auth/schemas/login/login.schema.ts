import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import {
  CredentialsSchema,
  ExpiresAtSchema,
} from '#modules/auth/schemas/auth.schema.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';

export const LoginRequestBodySchema = Schema.Struct({
  email: UserEmailSchema,
  password: PasswordSchema,
}).pipe(withRequestParseOptions);

export type LoginRequestBody = Schema.Schema.Type<
  typeof LoginRequestBodySchema
>;

export const LoginResponseSuccessSchema = UserResponseSchema.pipe(
  HttpApiSchema.status(200),
);

export const LoginResultSchema = Schema.Struct({
  user: UserResponseSchema,
  credential: CredentialsSchema,
  expiresAt: ExpiresAtSchema,
});
export type LoginResult = Schema.Schema.Type<typeof LoginResultSchema>;
