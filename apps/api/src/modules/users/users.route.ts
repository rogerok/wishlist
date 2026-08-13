import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { UserNotFoundError } from '#modules/users/errors/user-not-found.error.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const usersGroup = HttpApiGroup.make('users').add(
  // HttpApiEndpoint.get('getAll', '/api/users', {
  //   success: Schema.Array(UserSchema),
  // }),
  HttpApiEndpoint.get('getById', '/api/users/:id', {
    params: { id: UserIdSchema },
    success: UserResponseSchema,
    error: UserNotFoundError,
  }),
  // HttpApiEndpoint.post('create', '/api/users', {
  //   payload: CreateUserBodySchema,
  //   success: UserSchema,
  // }),
  // HttpApiEndpoint.put('update', '/api/users/:id', {
  //   params: { id: UserIdSchema },
  //   payload: UpdateUserBodySchema,
  //   success: UserSchema,
  //   error: UserNotFoundError,
  // }),
  // HttpApiEndpoint.delete('delete', '/api/users/:id', {
  //   params: { id: UserIdSchema },
  //   error: UserNotFoundError,
  // }),
);
