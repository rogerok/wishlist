import { Schema } from 'effect';

import type { UserId } from '#modules/users/schemas/user.schema.js';

import { domainProblem } from '#infra/errors/http-problem.js';
import {
  makeConflictBody,
  makeNotFoundBody,
} from '#infra/errors/problem-bodies.js';
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

const UserNotFoundBody = makeNotFoundBody(
  {
    code: 'USER_NOT_FOUND',
    detail: 'The requested user does not exist',
    title: 'User not found',
    type: '/errors/user-not-found',
  },
  { id: UserIdSchema, instance: UserByIdInstanceSchema },
);

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
  makeConflictBody(
    {
      code: 'USER_EMAIL_ALREADY_EXISTS',
      detail: 'A user with this email already exists',
      title: 'User email already exists',
      type: '/errors/user-email-already-exists',
    },
    { instance: Schema.tag(instance) },
  );

const UserEmailAlreadyExistsBody =
  makeEmailAlreadyExistsBody(usersCollectionPath);

export const UserEmailAlreadyExistsProblem = domainProblem({
  body: UserEmailAlreadyExistsBody,
  error: UserEmailAlreadyExistsError,
  status: 409,
  decode: () => new UserEmailAlreadyExistsError(),
  encode: () => UserEmailAlreadyExistsBody.make({}),
});
