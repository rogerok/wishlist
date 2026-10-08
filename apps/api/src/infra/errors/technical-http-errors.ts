import { Schema } from 'effect';

import { asProblemJson } from '#infra/errors/http-problem.js';

// Идентификатор, по которому клиент сообщает об ошибке, генерируется сервером, заголовки запроса не влияют.
export const ErrorIdSchema = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{32}$/),
);

export class InternalHttpError extends Schema.Error<InternalHttpError>(
  'InternalHttpError',
)(
  {
    code: Schema.tag('INTERNAL_ERROR'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(500),
    title: Schema.tag('Internal server error'),
    type: Schema.tag('/errors/internal-error'),
    instance: Schema.String,
    errorId: ErrorIdSchema,
  },
  {
    httpApiStatus: 500,
  },
) {}

export class ServiceUnavailableHttpError extends Schema.Error<ServiceUnavailableHttpError>(
  'ServiceUnavailableHttpError',
)(
  {
    code: Schema.tag('SERVICE_UNAVAILABLE'),
    detail: Schema.tag('Unable to process the request'),
    status: Schema.tag(503),
    title: Schema.tag('Service is unavailable'),
    type: Schema.tag('/errors/service-unavailable'),
    instance: Schema.String,
    errorId: ErrorIdSchema,
  },
  {
    httpApiStatus: 503,
  },
) {}

export const technicalHttpErrors = [
  InternalHttpError.pipe(asProblemJson),
  ServiceUnavailableHttpError.pipe(asProblemJson),
] as const;
