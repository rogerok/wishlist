import { Data } from 'effect';

import { type AccountOperation } from '#modules/account/schemas/account-operations.schema.js';

export class AccountInvalidRecord extends Data.TaggedError(
  'AccountInvalidRecord',
)<{
  cause: unknown;
  id: unknown;
  operation: AccountOperation;
}> {}

export class AccountRepositoryError extends Data.TaggedError(
  'AccountRepositoryError',
)<{
  cause: unknown;
  operation: AccountOperation;
}> {}

export type AccountRepositoryUpdateError =
  | AccountInvalidRecord
  | AccountRepositoryError;
