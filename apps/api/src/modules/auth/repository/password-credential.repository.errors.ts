import { Data } from 'effect';

import type { PasswordCredentialsOperation } from '#modules/auth/schemas/password-credentials-operations.schema.js';

export class PasswordCredentialsInvalidRecord extends Data.TaggedError(
  'PasswordCredentialsInvalidRecord',
)<{
  cause: unknown;
  operation: PasswordCredentialsOperation;
}> {}

export class PasswordCredentialsRepositoryError extends Data.TaggedError(
  'PasswordCredentialsRepositoryError',
)<{
  readonly cause: unknown;
  readonly operation: PasswordCredentialsOperation;
}> {}

export class PasswordCredentialsAlreadyExists extends Data.TaggedError(
  'PasswordCredentialsAlreadyExists',
)<{
  readonly operation: PasswordCredentialsOperation;
}> {}

export type PasswordCredentialsCreateError =
  | PasswordCredentialsAlreadyExists
  | PasswordCredentialsInvalidRecord
  | PasswordCredentialsRepositoryError;

export type PasswordCredentialsGetByIdError =
  | PasswordCredentialsInvalidRecord
  | PasswordCredentialsRepositoryError;
