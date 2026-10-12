import { Data } from 'effect';

import type { SessionOperations } from '#modules/auth/schemas/session/session-operations.schema.js';

// Совпадение digest нового токена с существующим: при 32 случайных байтах это
// ошибка кода, а не пользовательский конфликт. reason назначает AuthService.
export class SessionTokenDigestAlreadyExistsError extends Data.TaggedError(
  'SessionTokenDigestAlreadyExistsError',
)<{
  readonly operation: SessionOperations;
}> {}
