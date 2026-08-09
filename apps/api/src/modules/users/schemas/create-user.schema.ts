import { Schema } from 'effect';

import { UserEmailSchema, UserNameSchema } from './user.schema.js';

export const CreateUserBodySchema = Schema.TaggedStruct('CreateUserBody', {
  middleName: Schema.NullOr(UserNameSchema),
  firstName: Schema.NullOr(UserNameSchema),
  lastName: Schema.NullOr(UserNameSchema),
  email: UserEmailSchema,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});
