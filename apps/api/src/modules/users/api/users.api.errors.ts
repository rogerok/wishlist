import { Schema } from 'effect';

import type { UserId } from '#modules/users/schemas/user.schema.js';

import { domainProblem } from '#infra/errors/http-problem.js';
import { usersCollectionPath } from '#modules/users/api/users.api.constants.js';
import { UserIdSchema } from '#modules/users/schemas/user.schema.js';
import {
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '#modules/users/users.errors.js';

export const UserByIdInstanceSchema = Schema.TemplateLiteral([
  usersCollectionPath,
  '/',
  UserIdSchema,
]);

export const makeByIdInstance = (id: UserId) =>
  `${usersCollectionPath}/${id}` as const;

const UserNotFoundBody = Schema.Struct({
  code: Schema.tag('USER_NOT_FOUND'),
  detail: Schema.tag('The requested user does not exist'),
  status: Schema.tag(404),
  title: Schema.tag('User not found'),
  type: Schema.tag('/errors/user-not-found'),
  id: UserIdSchema,
  instance: UserByIdInstanceSchema,
});

export const UserNotFoundProblem = domainProblem({
  body: UserNotFoundBody,
  error: UserNotFoundError,
  status: 404,
  decode: ({ id }) => new UserNotFoundError({ id }),
  encode: ({ id }) =>
    UserNotFoundBody.make({ id, instance: makeByIdInstance(id) }),
});

// Общее тело конфликта email: users и auth отличаются только instance.
export const makeEmailAlreadyExistsBody = <Instance extends string>(
  instance: Instance,
) =>
  Schema.Struct({
    code: Schema.tag('USER_EMAIL_ALREADY_EXISTS'),
    detail: Schema.tag('A user with this email already exists'),
    status: Schema.tag(409),
    title: Schema.tag('User email already exists'),
    type: Schema.tag('/errors/user-email-already-exists'),
    instance: Schema.tag(instance),
  });

const UserEmailAlreadyExistsBody =
  makeEmailAlreadyExistsBody(usersCollectionPath);

export const UserEmailAlreadyExistsProblem = domainProblem({
  body: UserEmailAlreadyExistsBody,
  error: UserEmailAlreadyExistsError,
  status: 409,
  decode: () => new UserEmailAlreadyExistsError(),
  encode: () => UserEmailAlreadyExistsBody.make({}),
});
