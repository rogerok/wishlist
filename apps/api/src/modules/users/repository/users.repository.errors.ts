import { Data } from 'effect';

import { UserEmail } from '#modules/users/schemas/user.schema.js';

// TODO: operation описать через схемы
type UserRepositoryOperation =
  | 'create'
  | 'delete'
  | 'getAll'
  | 'getById'
  | 'update';

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

export type UsersRepositoryCreateError =
  | InvalidUserRecord
  | UserEmailAlreadyExists
  | UsersRepositoryError;

export type UsersRepositoryGetAllError =
  | InvalidUserRecord
  | UsersRepositoryError;

export type UsersRepositoryGetByIdError =
  | InvalidUserRecord
  | UsersRepositoryError;

export type UsersRepositoryUpdateError =
  | InvalidUserRecord
  | UserEmailAlreadyExists
  | UsersRepositoryError;

export type UsersRepositoryDeleteError = UsersRepositoryError;
