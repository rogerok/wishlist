import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';

import { UserNotFoundError } from '#modules/users/errors/user-not-found.error.js';
import { CreateUserBodySchema } from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const usersGroup = HttpApiGroup.make('users')
  .add(
    HttpApiEndpoint.get('list')`/api/users`.addSuccess(
      Schema.Array(UserSchema),
    ),
  )
  .add(
    HttpApiEndpoint.get(
      'byId',
    )`/api/users/${HttpApiSchema.param('id', UserIdSchema)}`
      .addSuccess(UserSchema)
      .addError(UserNotFoundError),
  )
  .add(
    HttpApiEndpoint.post('create')`/api/users`
      .setPayload(CreateUserBodySchema)
      .addSuccess(UserSchema),
  )
  .add(
    HttpApiEndpoint.put(
      'update',
    )`/api/users/${HttpApiSchema.param('id', UserIdSchema)}`
      .setPayload(UpdateUserBodySchema)
      .addSuccess(UserSchema)
      .addError(UserNotFoundError),
  )
  .add(
    HttpApiEndpoint.del(
      'delete',
    )`/api/users/${HttpApiSchema.param('id', UserIdSchema)}`.addError(
      UserNotFoundError,
    ),
  );
