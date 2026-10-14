import { HttpApiSchema } from 'effect/http-api';

import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';

export const MeResponseBodySchema = UserResponseSchema.pipe(
  HttpApiSchema.status(200),
);
