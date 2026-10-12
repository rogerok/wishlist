import type { HttpServerRequest } from 'effect/unstable/http';

import { Schema, SchemaTransformation } from 'effect';
import { HttpApiSchema } from 'effect/unstable/httpapi';

export const asProblemJson = HttpApiSchema.asJson({
  contentType: 'application/problem+json',
});

// Любой класс доменной ошибки. Готового типа Effect не экспортирует:
// Schema.instanceOf объявляет такой же прямо в своей сигнатуре.
type ErrorClass = abstract new (...args: never) => unknown;

type DomainProblemOptions<
  Body extends Schema.Top,
  DomainError extends ErrorClass,
> = {
  // Тело ответа problem+json (RFC 9457).
  readonly body: Body;
  readonly error: DomainError;
  readonly status: number;
  // Нужен для клиента HttpApi; сервер только кодирует.
  readonly decode: (body: Body['Type']) => InstanceType<DomainError>;
  readonly encode: (error: InstanceType<DomainError>) => Body['Type'];
};

// Схема ответа для доменной ошибки: Type — доменный класс, Encoded — тело.
// Handler пропускает доменную ошибку как есть, HttpApi сам кодирует её в ответ.
// Разные эндпоинты могут кодировать один и тот же класс разными схемами.
export const domainProblem = <
  Body extends Schema.Top,
  DomainError extends ErrorClass,
>({
  body,
  error,
  status,
  decode,
  encode,
}: DomainProblemOptions<Body, DomainError>) =>
  body.pipe(
    Schema.decodeTo(
      Schema.instanceOf(error),
      SchemaTransformation.transform({ decode, encode }),
    ),
    HttpApiSchema.status(status),
    asProblemJson,
  );

const stripSearchAndHash = (url: string) => {
  const end = url.search(/[?#]/);

  return end === -1 ? url : url.slice(0, end);
};

// Node-адаптер отдаёт строку запроса как есть («//api/users), веб-адаптер — абсолютный URL. Разбираем URL только во втором случае.
export const toRequestPathname = (originalUrl: string) => {
  if (originalUrl.startsWith('/')) {
    return stripSearchAndHash(originalUrl);
  }

  return URL.canParse(originalUrl) ? new URL(originalUrl).pathname : '/';
};

export const getRequestPathname = (
  request: HttpServerRequest.HttpServerRequest,
) => toRequestPathname(request.originalUrl);
