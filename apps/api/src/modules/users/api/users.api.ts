import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';

import { technicalHttpErrors } from '#infra/errors/technical-http-errors.js';
import {
  userByIdPath,
  usersCollectionPath,
  usersGroupIdentifier,
} from '#modules/users/api/users.api.constants.js';
import {
  UserEmailAlreadyExistsProblem,
  UserNotFoundProblem,
} from '#modules/users/api/users.api.errors.js';
import {
  CreateUserBodySchema,
  CreateUserResponseSchema,
} from '#modules/users/schemas/create-user.schema.js';
import { UpdateUserBodySchema } from '#modules/users/schemas/update-user.schema.js';
import { UserResponseSchema } from '#modules/users/schemas/user-response.schema.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

//TODO: put переписать на патч.
export const usersGroup = HttpApiGroup.make(usersGroupIdentifier).add(
  HttpApiEndpoint.post(UserOperation.create, usersCollectionPath, {
    payload: CreateUserBodySchema,
    success: CreateUserResponseSchema,
    error: [UserEmailAlreadyExistsProblem, ...technicalHttpErrors],
  }),
  HttpApiEndpoint.get(UserOperation.getAll, usersCollectionPath, {
    success: Schema.Array(UserResponseSchema),
    error: technicalHttpErrors,
  }),
  HttpApiEndpoint.get(UserOperation.getById, userByIdPath, {
    params: { id: UserIdSchema },
    success: UserResponseSchema,
    error: [...technicalHttpErrors, UserNotFoundProblem],
  }),
  HttpApiEndpoint.put(UserOperation.update, userByIdPath, {
    params: { id: UserIdSchema },
    payload: UpdateUserBodySchema,
    success: UserResponseSchema,
    error: [
      ...technicalHttpErrors,
      UserEmailAlreadyExistsProblem,
      UserNotFoundProblem,
    ],
  }),
  HttpApiEndpoint.delete(UserOperation.delete, userByIdPath, {
    params: { id: UserIdSchema },
    success: HttpApiSchema.NoContent,
    error: [...technicalHttpErrors, UserNotFoundProblem],
  }),
);
