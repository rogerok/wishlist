import { Schema } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

import { UserEmailSchema, UserNameInputSchema } from './user.schema.js';

export const CreateUserBodySchema = Schema.Struct({
  middleName: Schema.optionalKey(UserNameInputSchema),
  firstName: Schema.optionalKey(UserNameInputSchema),
  lastName: Schema.optionalKey(UserNameInputSchema),
  email: UserEmailSchema,
});
export type CreateUserBody = Schema.Schema.Type<typeof CreateUserBodySchema>;

export const CreateUserResponseSchema = UserResponseSchema.pipe(
  HttpApiSchema.status(201),
);
