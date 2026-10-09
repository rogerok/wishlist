import { Schema } from 'effect';

import { withRequestParseOptions } from '#infra/schemas/utils.js';
import {
  UserDisplayNameInputSchema,
  UserEmailSchema,
} from '#modules/users/schemas/user.schema.js';

export const UpdateUserBodySchema = Schema.Struct({
  displayName: UserDisplayNameInputSchema,
  email: UserEmailSchema,
}).pipe(withRequestParseOptions);

export type UpdateUserBody = Schema.Schema.Type<typeof UpdateUserBodySchema>;
