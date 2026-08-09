import { Schema } from 'effect';

import {
  UserEmailSchema,
  UserNameSchema,
} from '#modules/users/schemas/user.schema.js';

export const UpdateUserBodySchema = Schema.TaggedStruct('UpdateUserBody', {
  middleName: Schema.optional(UserNameSchema),
  firstName: Schema.optional(UserNameSchema),
  lastName: Schema.optional(UserNameSchema),
  email: UserEmailSchema,
});
