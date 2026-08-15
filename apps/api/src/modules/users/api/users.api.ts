import { Schema } from 'effect';
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi';

import { asProblemJson } from '#errors/http-problem.js';
import {
  UserEmailAlreadyExistsHttpError,
  UserNotFoundHttpError,
  UsersInternalHttpError,
  UsersUnavailableHttpError,
} from '#modules/users/api/users.api.errors.js';
import {
  CreateUserBodySchema,
  CreateUserResponseSchema,
} from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

// TODO: нужен middleware для ошибок валидации

export const usersGroup = HttpApiGroup.make('users').add(
  HttpApiEndpoint.post('create', '/api/users', {
    payload: CreateUserBodySchema,
    success: CreateUserResponseSchema,
    error: [
      UserEmailAlreadyExistsHttpError.pipe(asProblemJson),
      UsersInternalHttpError.pipe(asProblemJson),
      UsersUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.get('getAll', '/api/users', {
    success: Schema.Array(UserResponseSchema),
    error: [
      UsersInternalHttpError.pipe(asProblemJson),
      UsersUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.get('getById', '/api/users/:id', {
    params: { id: UserIdSchema },
    success: UserResponseSchema,
    error: [
      UserNotFoundHttpError.pipe(asProblemJson),
      UsersInternalHttpError.pipe(asProblemJson),
      UsersUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.put('update', '/api/users/:id', {
    params: { id: UserIdSchema },
    payload: UpdateUserBodySchema,
    success: UserResponseSchema,
    error: [
      UserEmailAlreadyExistsHttpError.pipe(asProblemJson),
      UserNotFoundHttpError.pipe(asProblemJson),
      UsersInternalHttpError.pipe(asProblemJson),
      UsersUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
  HttpApiEndpoint.delete('delete', '/api/users/:id', {
    params: { id: UserIdSchema },
    success: HttpApiSchema.NoContent,
    error: [
      UserNotFoundHttpError.pipe(asProblemJson),
      UsersUnavailableHttpError.pipe(asProblemJson),
    ],
  }),
);
