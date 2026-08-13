import { Schema } from 'effect';

import { UserId, UserIdSchema } from '#modules/users/schemas/user.schema.js';

const definition = {
  type: '/errors/user-not-found',
  title: 'User not found',
  status: 404,
  code: 'USER_NOT_FOUND',
} as const;

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  'UserNotFound',
  {
    id: UserIdSchema,
    type: Schema.Literal(definition.type),
    status: Schema.Literal(definition.status),
    detail: Schema.String,
    code: Schema.Literal(definition.code),
    instance: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
  {
    httpApiStatus: definition.status,
    description: 'User not found',
  },
) {}

export interface MakeUserNotFoundErrorOptions {
  readonly id: UserId;
  readonly cause?: unknown;
  readonly instance?: string;
  readonly requestId?: string;
}

export const makeUserNotFoundError = (options: MakeUserNotFoundErrorOptions) =>
  new UserNotFoundError({
    ...definition,
    ...options,
    detail: 'The requested user does not exist',
  });
