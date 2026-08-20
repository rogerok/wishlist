import { Data } from 'effect';

import type { UserEmail } from '#modules/users/schemas/user.schema.js';
import type { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

export class InvalidUserRecord extends Data.TaggedError('InvalidUserRecord')<{
  cause: unknown;
  id: string;
  operation: UserOperation;
}> {}

export class UserEmailAlreadyExists extends Data.TaggedError(
  'UserEmailAlreadyExists',
)<{
  readonly email: UserEmail;
  readonly operation: UserOperation;
}> {}

export class UsersRepositoryError extends Data.TaggedError(
  'UsersRepositoryError',
)<{
  readonly cause: unknown;
  readonly operation: UserOperation;
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
