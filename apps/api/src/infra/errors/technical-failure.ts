import { Effect } from 'effect';
import { HttpServerRequest } from 'effect/http';
import { randomBytes } from 'node:crypto';

import type {
  FailureReason,
  OperationFailed,
} from '#infra/errors/operation-failed.js';

import { getRequestPathname } from '#infra/errors/http-problem.js';
import {
  InternalHttpError,
  ServiceUnavailableHttpError,
} from '#infra/errors/technical-http-errors.js';
import { describeErrorChain } from '#infra/logging/error-chain.js';

// failure — типизированная ошибка сервиса, defect — непредвиденное исключение.
export type FailureKind = 'defect' | 'failure';

export const operationFailedEvent = 'operation.failed';

// Дополнительный контекст строки лога. Только примитивы: объект целиком (строку
// БД, тело запроса, ошибку) сюда не передать.
export type FailureMeta = Readonly<
  Record<string, boolean | number | string | null>
>;

type TechnicalFailureContext<Operation extends string> = {
  readonly operation: Operation;
  readonly meta?: FailureMeta;
};

type TechnicalFailureOptions<Operation extends string> = {
  readonly module: string;
  // Нужно только для вывода типа Operation из значений вроде AuthOperation.
  readonly operations: Readonly<Record<string, Operation>>;
};

type TechnicalFailure = {
  readonly error: unknown;
  readonly kind: FailureKind;
  readonly module: string;
  readonly reason: FailureReason;
} & TechnicalFailureContext<string>;

type ProblemContext = {
  readonly errorId: string;
  readonly instance: string;
};

type TechnicalHttpError = InternalHttpError | ServiceUnavailableHttpError;

// Всегда завершается ошибкой 5xx; instance для ответа берёт из текущего запроса.
type TechnicalFailureResponse = Effect.Effect<
  never,
  TechnicalHttpError,
  HttpServerRequest.HttpServerRequest
>;

// Обработчик для catchTag('OperationFailed'): переводит отказ в 5xx.
type TechnicalErrorHandler = (
  error: OperationFailed,
) => TechnicalFailureResponse;

// Привязывает обработчик к операции конкретного запроса.
type MakeTechnicalErrorHandler<Operation extends string> = (
  context: TechnicalFailureContext<Operation>,
) => TechnicalErrorHandler;

const generateErrorId = Effect.sync(() => randomBytes(16).toString('hex'));

// Одна строка лога на технический отказ; возвращает поля для 5xx-ответа
// с тем же errorId, что и в логе.
export const logTechnicalFailure = ({
  error,
  kind,
  meta = {},
  module,
  operation,
  reason,
}: TechnicalFailure): Effect.Effect<
  ProblemContext,
  never,
  HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const errorId = yield* generateErrorId;

    yield* Effect.logError('Operation failed').pipe(
      Effect.annotateLogs({
        event: operationFailedEvent,
        kind,
        module,
        operation,
        meta,
        reason,
        errorChain: describeErrorChain(error),
        errorId,
      }),
    );

    return { errorId, instance: getRequestPathname(request) };
  });

const failTechnically = (failure: TechnicalFailure): TechnicalFailureResponse =>
  Effect.gen(function* () {
    const problem = yield* logTechnicalFailure(failure);

    return yield* failure.reason === 'unavailable'
      ? new ServiceUnavailableHttpError(problem)
      : new InternalHttpError(problem);
  });

// reason уже назначил источник отказа; handler добавляет модуль и операцию
// запроса, логирует и отвечает 500 или 503.
export const makeTechnicalFailureHandler =
  <Operation extends string>(
    options: TechnicalFailureOptions<Operation>,
  ): MakeTechnicalErrorHandler<Operation> =>
  (context) =>
  (error) =>
    failTechnically({
      ...context,
      error,
      kind: 'failure',
      module: options.module,
      reason: error.reason,
    });
