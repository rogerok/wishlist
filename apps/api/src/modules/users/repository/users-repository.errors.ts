import { Data } from 'effect';

import { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

export type UserRepositoryOperation =
  | 'create'
  | 'delete'
  | 'findAll'
  | 'findById'
  | 'update';

export class UserMissing extends Data.TaggedError('UserMissing')<{
  readonly user: UserId;
}> {}

export class UserEmailAlreadyExists extends Data.TaggedError(
  'UserEmailAlreadyExists',
)<{
  readonly email: UserEmail;
}> {}

export class UserPersistenceError extends Data.TaggedError(
  'UserPersistenceError',
)<{
  readonly cause: unknown;
  readonly operation: UserRepositoryOperation;
}> {}

export type UserRepositoryError =
  | UserEmailAlreadyExists
  | UserMissing
  | UserPersistenceError;
