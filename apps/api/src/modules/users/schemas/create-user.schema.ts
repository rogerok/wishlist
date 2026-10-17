import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/http-api';

import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

import { UserDisplayNameInputSchema, UserEmailSchema } from './user.schema.js';

export const CreateUserBodySchema = Schema.Struct({
  displayName: UserDisplayNameInputSchema,
  email: UserEmailSchema,
});
export type CreateUserBody = Schema.Schema.Type<typeof CreateUserBodySchema>;

export const CreateUserResponseSchema = UserResponseSchema.pipe(
  HttpApiSchema.status(201),
);
