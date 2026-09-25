import { Data } from 'effect';

export class AuthCredentialsError extends Data.TaggedError(
  'AuthCredentialsError',
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}
