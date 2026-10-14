import { Schema } from 'effect';

import {
  UserDisplayNameInputSchema,
  UserEmailSchema,
} from '#modules/users/schemas/user.schema.js';

export const UpdateUserBodySchema = Schema.Struct({
  displayName: UserDisplayNameInputSchema,
  email: UserEmailSchema,
});

export type UpdateUserBody = Schema.Schema.Type<typeof UpdateUserBodySchema>;
