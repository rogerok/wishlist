import { Schema } from 'effect';

import {
  UserEmailSchema,
  UserIdSchema,
  UserNameSchema,
} from '#modules/users/schemas/user.schema.js';

export const UserSchema = Schema.Struct({
  id: UserIdSchema,
  lastName: Schema.optional(UserNameSchema),
  middleName: Schema.optional(UserNameSchema),
  firstName: Schema.optional(UserNameSchema),
  email: UserEmailSchema,
});
