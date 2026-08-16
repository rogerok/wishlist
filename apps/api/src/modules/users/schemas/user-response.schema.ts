import { Schema } from 'effect';

import {
  UserEmailSchema,
  UserIdSchema,
  UserNameSchema,
} from '#modules/users/schemas/user.schema.js';

const NameSchema = Schema.NullOr(UserNameSchema);

export const UserResponseSchema = Schema.Struct({
  id: UserIdSchema,
  lastName: NameSchema,
  middleName: NameSchema,
  firstName: NameSchema,
  email: UserEmailSchema,
});

export type UserResponse = Schema.Schema.Type<typeof UserResponseSchema>;
