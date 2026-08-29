import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

import { UserEmailSchema, UserNameInputSchema } from './user.schema.js';

export const CreateUserBodySchema = Schema.Struct({
  middleName: UserNameInputSchema,
  firstName: UserNameInputSchema,
  lastName: UserNameInputSchema,
  email: UserEmailSchema,
}).pipe(withRequestParseOptions);
export type CreateUserBody = Schema.Schema.Type<typeof CreateUserBodySchema>;

export const CreateUserResponseSchema = UserResponseSchema.pipe(
  HttpApiSchema.status(201),
);
