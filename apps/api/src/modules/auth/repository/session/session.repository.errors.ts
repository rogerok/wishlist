import { Data } from 'effect';

import type { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';

export class SessionInvalidRecordError extends Data.TaggedError(
  'SessionInvalidRecordError',
)<{
  cause: unknown;
  operation: SessionOperations;
}> {}

export class SessionRepositoryError extends Data.TaggedError(
  'SessionRepositoryError',
)<{
  readonly cause: unknown;
  readonly operation: SessionOperations;
}> {}

export class SessionTokenDigestAlreadyExistsError extends Data.TaggedError(
  'SessionTokenDigestAlreadyExistsError',
)<{
  readonly operation: SessionOperations;
}> {}

export type SessionCreateError =
  | SessionInvalidRecordError
  | SessionRepositoryError
  | SessionTokenDigestAlreadyExistsError;

export type SessionGetByTokenDigestError =
  | SessionInvalidRecordError
  | SessionRepositoryError;

export type SessionDeleteByTokenDigestError = SessionRepositoryError;
