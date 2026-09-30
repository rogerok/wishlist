import { Data } from 'effect';

export class PasswordHashIntegrityError extends Data.TaggedError(
  'PasswordHashIntegrityError',
)<{
  readonly cause: unknown;
}> {}

export class PasswordHashOverloadedError extends Data.TaggedError(
  'PasswordHashOverloadedError',
)<{
  readonly cause: unknown;
}> {}
