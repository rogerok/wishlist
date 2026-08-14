import { Schema } from 'effect';

import {
  HttpProblemDefinition,
  makeHttpProblemFields,
} from '#errors/http-problem.js';
import { UserId, UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const usersCollectionInstance = '/api/users';

export const makeByIdInstance = (id: UserId) =>
  `${usersCollectionInstance}/${id}`;

const notFoundDefinition: HttpProblemDefinition = {
  code: 'USER_NOT_FOUND',
  detail: 'The requested user does not exist',
  status: 404,
  title: 'User not found',
  type: '/errors/user-not-found',
} as const;

const unavailableDefinition: HttpProblemDefinition = {
  code: 'USERS_UNAVAILABLE',
  detail: 'Unable to process the request',
  status: 503,
  title: 'Users service is unavailable',
  type: '/errors/users-unavailable',
} as const;

const internalDefinition: HttpProblemDefinition = {
  code: 'USERS_INTERNAL_ERROR',
  detail: 'Unable to process the request',
  status: 500,
  title: 'Internal users service error',
  type: '/errors/users-internal-error',
} as const;

const emailAlreadyExistsDefinition: HttpProblemDefinition = {
  code: 'USER_EMAIL_ALREADY_EXISTS',
  detail: 'A user with this email already exists',
  status: 409,
  title: 'User email already exists',
  type: '/errors/user-email-already-exists',
} as const;

export class UserNotFoundHttpError extends Schema.Error<UserNotFoundHttpError>(
  'UserNotFoundHttpError',
)(
  {
    ...makeHttpProblemFields(notFoundDefinition),
    id: UserIdSchema,
    instance: Schema.String,
  },
  {
    httpApiStatus: notFoundDefinition.status,
  },
) {}

export class UsersUnavailableHttpError extends Schema.Error<UsersUnavailableHttpError>(
  'UsersUnavailableHttpError',
)(
  {
    ...makeHttpProblemFields(unavailableDefinition),
    instance: Schema.String,
  },
  {
    httpApiStatus: unavailableDefinition.status,
  },
) {}

export class UsersInternalHttpError extends Schema.Error<UsersInternalHttpError>(
  'UsersInternalHttpError',
)(
  {
    ...makeHttpProblemFields(internalDefinition),
    instance: Schema.String,
  },
  {
    httpApiStatus: internalDefinition.status,
  },
) {}

export class UserEmailAlreadyExistsHttpError extends Schema.Error<UserEmailAlreadyExistsHttpError>(
  'UserEmailAlreadyExistsHttpError',
)(
  {
    ...makeHttpProblemFields(emailAlreadyExistsDefinition),
    instance: Schema.String,
  },
  {
    httpApiStatus: emailAlreadyExistsDefinition.status,
  },
) {}

export const makeUserNotFoundHttpError = (id: UserId) =>
  new UserNotFoundHttpError({
    id,
    instance: makeByIdInstance(id),
  });
export const makeUsersUnavailableHttpError = (instance: string) =>
  new UsersUnavailableHttpError({
    instance,
  });
export const makeUsersInternalHttpError = (instance: string) =>
  new UsersInternalHttpError({
    instance,
  });

export const makeUserEmailAlreadyExistsHttpError = () =>
  new UserEmailAlreadyExistsHttpError({
    instance: usersCollectionInstance,
  });
