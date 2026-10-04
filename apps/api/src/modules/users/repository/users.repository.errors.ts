import { Data } from 'effect';

import type { UserEmail } from '#modules/users/schemas/user.schema.js';
import type { UserOperation } from '#modules/users/schemas/users-operations.schema.js';

export class UserInvalidRecord extends Data.TaggedError('InvalidUserRecord')<{
  cause: unknown;
  operation: UserOperation;
  id?: unknown;
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
  | UserEmailAlreadyExists
  | UserInvalidRecord
  | UsersRepositoryError;

export type UsersRepositoryGetAllError =
  | UserInvalidRecord
  | UsersRepositoryError;

export type UsersRepositoryGetByError =
  | UserInvalidRecord
  | UsersRepositoryError;

export type UsersRepositoryUpdateError =
  | UserEmailAlreadyExists
  | UserInvalidRecord
  | UsersRepositoryError;

export type UsersRepositoryDeleteError = UsersRepositoryError;
