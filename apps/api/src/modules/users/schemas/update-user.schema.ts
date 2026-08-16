import { Schema } from 'effect';

import {
  UserEmailSchema,
  UserNameInputSchema,
} from '#modules/users/schemas/user.schema.js';

export const UpdateUserBodySchema = Schema.Struct({
  middleName: UserNameInputSchema,
  firstName: UserNameInputSchema,
  lastName: UserNameInputSchema,
  email: UserEmailSchema,
});

export type UpdateUserBody = Schema.Schema.Type<typeof UpdateUserBodySchema>;
