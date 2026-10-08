import { Data } from 'effect';

import type { UserEmail } from '#modules/users/schemas/user.schema.js';

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly cause: unknown;
}> {}

export class UsersUnavailableError extends Data.TaggedError(
  'UsersUnavailableError',
)<{
  readonly cause: unknown;
}> {}
export class UsersInternalError extends Data.TaggedError('UsersInternalError')<{
  readonly cause: unknown;
}> {}

export class UserDataIntegrityError extends Data.TaggedError(
  'UserDataIntegrityError',
)<{
  readonly cause: unknown;
}> {}

export type UsersTechnicalError =
  | UserDataIntegrityError
  | UsersInternalError
  | UsersUnavailableError;

export class UserEmailAlreadyExistsError extends Data.TaggedError(
  'UserEmailAlreadyExistsError',
)<{
  readonly cause: unknown;
  readonly email: UserEmail;
}> {}

export type UsersServiceCreateError =
  | UserDataIntegrityError
  | UserEmailAlreadyExistsError
  | UsersInternalError
  | UsersUnavailableError;

export type UsersServiceGetAllError =
  | UserDataIntegrityError
  | UsersInternalError
  | UsersUnavailableError;

export type UsersServiceGetByIdError =
  | UserDataIntegrityError
  | UserNotFoundError
  | UsersInternalError
  | UsersUnavailableError;

export type UserServiceUpdateError =
  | UserDataIntegrityError
  | UserEmailAlreadyExistsError
  | UserNotFoundError
  | UsersInternalError
  | UsersUnavailableError;

export type UserServiceDeleteByIdError =
  | UserNotFoundError
  | UsersInternalError
  | UsersUnavailableError;
