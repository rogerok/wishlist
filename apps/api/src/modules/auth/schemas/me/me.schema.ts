import { HttpApiSchema } from 'effect/unstable/httpapi';

import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

export const MeResponseBodySchema = UserResponseSchema.pipe(
  HttpApiSchema.status(200),
);
