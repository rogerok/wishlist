import { Data } from 'effect';

export class SecurePrimitiveUnavailableError extends Data.TaggedError(
  'SecurePrimitiveUnavailableError',
)<{
  readonly cause: unknown;
}> {}
