import { Data } from 'effect';

import { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

export type UserRepositoryOperation =
  | 'create'
  | 'delete'
  | 'getAll'
  | 'getById'
  | 'update';

export class UserNotFoundRepositoryError extends Data.TaggedError(
  'UserNotFoundRepositoryError',
)<{
  readonly cause: unknown;
  readonly id: UserId;
  operation: UserRepositoryOperation;
}> {}

export class InvalidUserRecord extends Data.TaggedError('InvalidUserRecord')<{
  cause: unknown;
  id: string;
  operation: UserRepositoryOperation;
}> {}

export class UserEmailAlreadyExists extends Data.TaggedError(
  'UserEmailAlreadyExists',
)<{
  readonly email: UserEmail;
  readonly operation: UserRepositoryOperation;
}> {}

export class UsersRepositoryError extends Data.TaggedError(
  'UsersRepositoryError',
)<{
  readonly cause: unknown;
  readonly operation: UserRepositoryOperation;
}> {}

export type UsersRepositoryGetByIdError =
  | InvalidUserRecord
  | UsersRepositoryError;

export type UsersRepositoryGetAllError =
  | InvalidUserRecord
  | UsersRepositoryError;

export type UserRepositoryCreateError =
  | InvalidUserRecord
  | UserEmailAlreadyExists
  | UsersRepositoryError;
