import type { SchemaError } from 'effect/Schema';
import type { SqlError } from 'effect/unstable/sql';

import { Data } from 'effect';

import type {
  PasswordCredentialsCreateError,
  PasswordCredentialsInvalidRecord,
  PasswordCredentialsRepositoryError,
} from '#modules/auth/repository/password/password-credential.repository.errors.js';
import type {
  SessionCreateError,
  SessionDeleteByTokenDigestError,
  SessionGetByTokenDigestError,
  SessionInvalidRecordError,
  SessionRepositoryError,
  SessionTokenDigestAlreadyExistsError,
} from '#modules/auth/repository/session/session.repository.errors.js';
import type {
  PasswordHashIntegrityError,
  PasswordHashOverloadedError,
} from '#modules/auth/service/password/password-hasher.service.errors.js';
import type { SecurePrimitiveUnavailableError } from '#modules/auth/service/session/session-token-generator.errors.js';
import type {
  UserInvalidRecord,
  UsersRepositoryCreateError,
  UsersRepositoryError,
  UsersRepositoryGetByError,
} from '#modules/users/repository/users.repository.errors.js';

export class AuthEmailAlreadyExistsError extends Data.TaggedError(
  'AuthEmailAlreadyExistsError',
)<{
  readonly cause: unknown;
}> {}

export class AuthInvalidCredentialsError extends Data.TaggedError(
  'AuthInvalidCredentialsError',
)<{
  readonly cause: unknown;
}> {}

export class AuthUnavailableError extends Data.TaggedError(
  'AuthUnavailableError',
)<{
  readonly cause: unknown;
}> {}

export class AuthUnauthenticatedError extends Data.TaggedError(
  'AuthUnauthenticatedError',
)<{
  readonly cause: unknown;
}> {}

export class AuthInternalError extends Data.TaggedError('AuthInternalError')<{
  readonly cause: unknown;
}> {}

export class AuthDataIntegrityError extends Data.TaggedError(
  'AuthDataIntegrityError',
)<{
  readonly cause: unknown;
}> {}

// Ошибки, которые handler переводит в 5xx через makeTechnicalFailureHandler.
export type AuthTechnicalError =
  | AuthDataIntegrityError
  | AuthInternalError
  | AuthUnavailableError;

export type AuthSignupError = AuthEmailAlreadyExistsError | AuthTechnicalError;
export type AuthLoginError = AuthInvalidCredentialsError | AuthTechnicalError;

export type AuthAuthenticateError =
  | AuthTechnicalError
  | AuthUnauthenticatedError;

export type AuthenticateOperationError =
  | AuthUnauthenticatedError
  | SchemaError
  | SessionGetByTokenDigestError
  | UsersRepositoryGetByError;

export type LogoutOperationError = SessionDeleteByTokenDigestError;

export type SignupOperationError =
  | PasswordCredentialsCreateError
  | PasswordHashIntegrityError
  | PasswordHashOverloadedError
  | SecurePrimitiveUnavailableError
  | SessionCreateError
  | SqlError.SqlError
  | UsersRepositoryCreateError;

export type LoginOperationError =
  | AuthInvalidCredentialsError
  | PasswordCredentialsInvalidRecord
  | PasswordCredentialsRepositoryError
  | PasswordHashIntegrityError
  | PasswordHashOverloadedError
  | SecurePrimitiveUnavailableError
  | SessionInvalidRecordError
  | SessionRepositoryError
  | SessionTokenDigestAlreadyExistsError
  | UserInvalidRecord
  | UsersRepositoryError;
