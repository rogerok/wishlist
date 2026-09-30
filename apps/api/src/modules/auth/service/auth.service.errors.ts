import type { SqlError } from 'effect/unstable/sql';

import { Data } from 'effect';

import type { PasswordCredentialsCreateError } from '#modules/auth/repository/password/password-credential.repository.errors.js';
import type { SessionCreateError } from '#modules/auth/repository/session/session.repository.errors.js';
import type {
  PasswordHashIntegrityError,
  PasswordHashOverloadedError,
} from '#modules/auth/service/password/password-hasher.service.errors.js';
import type { SecurePrimitiveUnavailableError } from '#modules/auth/service/session/session-token-generator.errors.js';
import type { UsersRepositoryCreateError } from '#modules/users/repository/users.repository.errors.js';

export class AuthCredentialsError extends Data.TaggedError(
  'AuthCredentialsError',
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export type AuthSignupError =
  | PasswordCredentialsCreateError
  | PasswordHashIntegrityError
  | PasswordHashOverloadedError
  | SecurePrimitiveUnavailableError
  | SessionCreateError
  | SqlError.SqlError
  | UsersRepositoryCreateError;
