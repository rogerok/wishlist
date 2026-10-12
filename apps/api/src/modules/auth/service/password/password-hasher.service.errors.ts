import { Data } from 'effect';

// Хэш не разбирается. Смысл зависит от сценария, поэтому reason назначает
// AuthService: при signup хэш только что посчитан (ошибка кода), при login
// прочитан из базы (повреждённая запись).
export class PasswordHashIntegrityError extends Data.TaggedError(
  'PasswordHashIntegrityError',
)<{
  readonly cause: unknown;
}> {}
