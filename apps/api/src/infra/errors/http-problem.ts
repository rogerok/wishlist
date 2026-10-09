import type { HttpServerRequest } from 'effect/unstable/http';

import { HttpApiSchema } from 'effect/unstable/httpapi';

export const asProblemJson = HttpApiSchema.asJson({
  contentType: 'application/problem+json',
});

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
