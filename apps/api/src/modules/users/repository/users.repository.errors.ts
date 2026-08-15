import { Data } from 'effect';

import { UserEmail } from '#modules/users/schemas/user.schema.js';

type UserRepositoryOperation =
  | 'create'
  | 'delete'
  | 'getAll'
  | 'getById'
  | 'update';

class InvalidUserRecord extends Data.TaggedError('InvalidUserRecord')<{
  cause: unknown;
  id: string;
  operation: UserRepositoryOperation;
}> {}

class UserEmailAlreadyExists extends Data.TaggedError(
  'UserEmailAlreadyExists',
)<{
  readonly email: UserEmail;
  readonly operation: UserRepositoryOperation;
}> {}

class UsersRepositoryError extends Data.TaggedError('UsersRepositoryError')<{
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

interface MakeInvalidUserRecordErrorOptions {
  readonly cause: InvalidUserRecord['cause'];
  readonly id: InvalidUserRecord['id'];
  readonly operation: InvalidUserRecord['operation'];
}
export const makeInvalidUserRecordError = (
  options: MakeInvalidUserRecordErrorOptions,
) => new InvalidUserRecord(options);

interface MakeUserEmailAlreadyExistsOptions {
  readonly email: UserEmailAlreadyExists['email'];
  readonly operation: UserEmailAlreadyExists['operation'];
}
export const makeUserEmailAlreadyExistsError = (
  options: MakeUserEmailAlreadyExistsOptions,
) => new UserEmailAlreadyExists(options);

interface MakeUsersRepositoryErrorOptions {
  readonly cause: UsersRepositoryError['cause'];
  readonly operation: UsersRepositoryError['operation'];
}
export const makeUsersRepositoryError = (
  options: MakeUsersRepositoryErrorOptions,
) => new UsersRepositoryError(options);
