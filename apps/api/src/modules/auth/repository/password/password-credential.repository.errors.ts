import { Data } from 'effect';

import type { PasswordCredentialsOperations } from '#modules/auth/schemas/password/password-credentials-operations.schema.js';

// Повтор Password Credential для User. Сейчас это ошибка кода (signup создаёт
// User и пароль в одной транзакции), поэтому reason назначает AuthService.
export class PasswordCredentialsAlreadyExists extends Data.TaggedError(
  'PasswordCredentialsAlreadyExists',
)<{
  readonly operation: PasswordCredentialsOperations;
}> {}
