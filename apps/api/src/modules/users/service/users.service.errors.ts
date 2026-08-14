import { Data } from 'effect';

import { UserEmail, UserId } from '#modules/users/schemas/user.schema.js';

export class UserNotFound extends Data.TaggedError('UserNotFound')<{
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

export class UserEmailAlreadyExists extends Data.TaggedError(
  'UserEmailAlreadyExists',
)<{
  readonly cause: unknown;
  readonly email: UserEmail;
}> {}

export type UsersServiceCreateError =
  | UserDataIntegrityError
  | UserEmailAlreadyExists
  | UsersUnavailableError;

export type UsersServiceGetAllError =
  | UserDataIntegrityError
  | UsersUnavailableError;

export type UsersServiceGetByIdError =
  | UserDataIntegrityError
  | UserNotFound
  | UsersUnavailableError;

export type UserServiceDeleteByIdError = UserNotFound | UsersUnavailableError;

export const makeUserNotFoundError = (id: UserNotFound['id']) =>
  new UserNotFound({ id });
export const makeUsersUnavailableError = (
  cause: UsersUnavailableError['cause'],
) => new UsersUnavailableError({ cause });
export const makeUserDataIntegrityError = (
  cause: UserDataIntegrityError['cause'],
) => new UserDataIntegrityError({ cause });
export const makeUserEmailAlreadyExistsError = (
  email: UserEmailAlreadyExists['email'],
  cause: UserEmailAlreadyExists['cause'],
) => new UserEmailAlreadyExists({ email, cause });
