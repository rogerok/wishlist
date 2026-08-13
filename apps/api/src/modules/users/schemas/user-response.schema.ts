import { Schema } from 'effect';

import {
  NullableUserNameSchema,
  UserEmailSchema,
  UserIdSchema,
} from '#modules/users/schemas/user.schema.js';

export const UserResponseSchema = Schema.Struct({
  id: UserIdSchema,
  lastName: NullableUserNameSchema,
  middleName: NullableUserNameSchema,
  firstName: NullableUserNameSchema,
  email: UserEmailSchema,
});

export type UserResponse = Schema.Schema.Type<typeof UserResponseSchema>;
