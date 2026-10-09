import { Schema } from 'effect';

import {
  UserDisplayNameSchema,
  UserEmailSchema,
  UserIdSchema,
} from '#modules/users/schemas/user.schema.js';

export const UserResponseSchema = Schema.Struct({
  id: UserIdSchema,
  displayName: UserDisplayNameSchema,
  email: UserEmailSchema,
});

export type UserResponse = Schema.Schema.Type<typeof UserResponseSchema>;
