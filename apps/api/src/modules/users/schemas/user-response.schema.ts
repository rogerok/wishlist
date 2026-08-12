import { Schema } from 'effect';

import {
  NullableUserNameSchema,
  UserEmailSchema,
  UserIdSchema,
  UserNameSchema,
} from '#modules/users/schemas/user.schema.js';

export const UserSchema = Schema.Struct({
  id: UserIdSchema,
  lastName: NullableUserNameSchema,
  middleName: NullableUserNameSchema,
  firstName: NullableUserNameSchema,
  email: UserEmailSchema,
});
