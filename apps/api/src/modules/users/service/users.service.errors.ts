import { Data } from 'effect';

import { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly id: UserId;
}> {}

export class UsersUnavailableError extends Data.TaggedError(
  'UsersUnavailableError',
)<{
  readonly cause: unknown;
}> {}

export class UserDataIntegrityError extends Data.TaggedError(
  'UserDataIntegrityError',
)<{
  readonly cause: unknown;
}> {}

export class UserEmailAlreadyExistsError extends Data.TaggedError(
  'UserEmailAlreadyExistsError',
)<{
  readonly cause: unknown;
  readonly email: UserEmail;
}> {}

export type UsersServiceCreateError =
  | UserDataIntegrityError
  | UserEmailAlreadyExistsError
  | UsersUnavailableError;

export type UsersServiceGetAllError =
  | UserDataIntegrityError
  | UsersUnavailableError;

export type UsersServiceGetByIdError =
  | UserDataIntegrityError
  | UserNotFoundError
  | UsersUnavailableError;

export type UserServiceUpdateError =
  | UserDataIntegrityError
  | UserEmailAlreadyExistsError
  | UserNotFoundError
  | UsersUnavailableError;

export type UserServiceDeleteByIdError =
  | UserNotFoundError
  | UsersUnavailableError;
