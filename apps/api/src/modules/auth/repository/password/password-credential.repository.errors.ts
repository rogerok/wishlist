import { Data } from 'effect';

import type { PasswordCredentialsOperations } from '#modules/auth/schemas/password/password-credentials-operations.schema.js';

export class PasswordCredentialsInvalidRecord extends Data.TaggedError(
  'PasswordCredentialsInvalidRecord',
)<{
  cause: unknown;
  operation: PasswordCredentialsOperations;
}> {}

export class PasswordCredentialsRepositoryError extends Data.TaggedError(
  'PasswordCredentialsRepositoryError',
)<{
  readonly cause: unknown;
  readonly operation: PasswordCredentialsOperations;
}> {}

export class PasswordCredentialsAlreadyExists extends Data.TaggedError(
  'PasswordCredentialsAlreadyExists',
)<{
  readonly operation: PasswordCredentialsOperations;
}> {}

export type PasswordCredentialsCreateError =
  | PasswordCredentialsAlreadyExists
  | PasswordCredentialsInvalidRecord
  | PasswordCredentialsRepositoryError;

export type PasswordCredentialsGetByIdError =
  | PasswordCredentialsInvalidRecord
  | PasswordCredentialsRepositoryError;
