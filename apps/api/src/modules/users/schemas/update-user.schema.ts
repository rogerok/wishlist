import { Schema } from 'effect';

import {
  UserEmailSchema,
  UserNameInputSchema,
} from '#modules/users/schemas/user.schema.js';
import { withRequestParseOptions } from '#schemas/utils.js';

export const UpdateUserBodySchema = Schema.Struct({
  middleName: UserNameInputSchema,
  firstName: UserNameInputSchema,
  lastName: UserNameInputSchema,
  email: UserEmailSchema,
}).pipe(withRequestParseOptions);

export type UpdateUserBody = Schema.Schema.Type<typeof UpdateUserBodySchema>;
