import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';

export const LoginRequestBodySchema = Schema.Struct({
  email: UserEmailSchema,
  password: PasswordSchema,
}).pipe(withRequestParseOptions);

export const LoginResponseBodySchema = UserResponseSchema.pipe(
  HttpApiSchema.status(200),
);
