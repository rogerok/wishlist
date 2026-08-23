import { Data } from 'effect';

export class PasswordHashIntegrityError extends Data.TaggedError(
  'PasswordHashIntegrityError',
)<{
  readonly cause: unknown;
}> {}
