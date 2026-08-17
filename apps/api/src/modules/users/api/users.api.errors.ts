import { Schema } from 'effect';

import { usersCollectionPath } from '#modules/users/api/users.api.constants.js';
import { UserId, UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const UserByIdInstanceSchema = Schema.TemplateLiteral([
  usersCollectionPath,
  '/',
  UserIdSchema,
]);
export const UserInstanceSchema = Schema.Union([
  Schema.Literal(usersCollectionPath),
  UserByIdInstanceSchema,
]);

export const makeByIdInstance = (id: UserId) =>
  `${usersCollectionPath}/${id}` as const;

export class UserNotFoundHttpError extends Schema.Error<UserNotFoundHttpError>(
  'UserNotFoundHttpError',
)(
  {
    code: Schema.tag('USER_NOT_FOUND'),
    detail: Schema.tag('The requested user does not exist'),
    status: Schema.tag(404),
    title: Schema.tag('User not found'),
    type: Schema.tag('/errors/user-not-found'),
    id: UserIdSchema,
    instance: UserByIdInstanceSchema,
  },
  {
    httpApiStatus: 404,
  },
) {}

export class UsersUnavailableHttpError extends Schema.Error<UsersUnavailableHttpError>(
  'UsersUnavailableHttpError',
)(
  {
    code: Schema.tag('USERS_UNAVAILABLE'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(503),
    title: Schema.tag('Users service is unavailable'),
    type: Schema.tag('/errors/users-unavailable'),
    instance: UserInstanceSchema,
  },
  {
    httpApiStatus: 503,
  },
) {}

export class UsersInternalHttpError extends Schema.Error<UsersInternalHttpError>(
  'UsersInternalHttpError',
)(
  {
    code: Schema.tag('USERS_INTERNAL_ERROR'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(500),
    title: Schema.tag('Internal users service error'),
    type: Schema.tag('/errors/users-internal-error'),
    instance: UserInstanceSchema,
  },
  {
    httpApiStatus: 500,
  },
) {}

export class UserEmailAlreadyExistsHttpError extends Schema.Error<UserEmailAlreadyExistsHttpError>(
  'UserEmailAlreadyExistsHttpError',
)(
  {
    code: Schema.tag('USER_EMAIL_ALREADY_EXISTS'),
    detail: Schema.tag('A user with this email already exists'),
    status: Schema.tag(409),
    title: Schema.tag('User email already exists'),
    type: Schema.tag('/errors/user-email-already-exists'),
    instance: Schema.tag(usersCollectionPath),
  },
  {
    httpApiStatus: 409,
  },
) {}
