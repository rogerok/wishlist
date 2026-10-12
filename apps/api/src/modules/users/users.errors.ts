import { Data } from 'effect';

import type { UserId } from '#modules/users/schemas/user.schema.js';

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly id: UserId;
}> {}

export class UserEmailAlreadyExistsError extends Data.TaggedError(
  'UserEmailAlreadyExistsError',
) {}
