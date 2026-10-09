import { Schema } from 'effect';

import type { UserId } from '#modules/users/schemas/user.schema.js';

import { usersCollectionPath } from '#modules/users/api/users.api.constants.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';

export const UserByIdInstanceSchema = Schema.TemplateLiteral([
  usersCollectionPath,
  '/',
  UserIdSchema,
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
