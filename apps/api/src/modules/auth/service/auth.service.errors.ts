import { Data } from 'effect';

// Доменные ошибки auth. Технические отказы — OperationFailed (#infra/errors).

// Нет User, нет Password Credential или пароль не совпал: клиент не должен
// различать эти случаи.
export class AuthInvalidCredentialsError extends Data.TaggedError(
  'AuthInvalidCredentialsError',
) {}

// Cookie не разбирается, Session нет или она истекла, User удалён.
export class AuthUnauthenticatedError extends Data.TaggedError(
  'AuthUnauthenticatedError',
) {}
