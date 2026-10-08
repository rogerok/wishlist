import { Effect } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { randomBytes } from 'node:crypto';

import { getRequestPathname } from '#infra/errors/http-problem.js';
import {
  InternalHttpError,
  ServiceUnavailableHttpError,
} from '#infra/errors/technical-http-errors.js';
import { describeErrorChain } from '#infra/logging/error-chain.js';

export type FailureReason = 'dataIntegrity' | 'internal' | 'unavailable';

// failure — типизированная ошибка сервиса, defect — непредвиденное исключение.
export type FailureKind = 'defect' | 'failure';

export const operationFailedEvent = 'operation.failed';

type TechnicalFailureContext<Operation extends string> = {
  readonly operation: Operation;
  readonly userId: string | null;
};

type TaggedError = { readonly _tag: string };

type TechnicalFailureOptions<
  Operation extends string,
  TechnicalError extends TaggedError,
> = {
  readonly module: string;
  // Нужно только для вывода типа Operation из значений вроде AuthOperation.
  readonly operations: Readonly<Record<string, Operation>>;
  // Тег технической ошибки сервиса → причина в логе и статус ответа.
  // Ключи — ровно теги TechnicalError: лишний или пропущенный тег не скомпилируется.
  readonly reasons: Readonly<Record<TechnicalError['_tag'], FailureReason>>;
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

// Обработчик для catchTags: переводит ошибку сервиса в 5xx.
type TechnicalErrorHandler<TechnicalError extends TaggedError> = (
  error: TechnicalError,
) => TechnicalFailureResponse;

// Привязывает обработчик к операции и пользователю конкретного запроса.
type MakeTechnicalErrorHandler<
  Operation extends string,
  TechnicalError extends TaggedError,
> = (
  context: TechnicalFailureContext<Operation>,
) => TechnicalErrorHandler<TechnicalError>;

// Свой идентификатор, а не trace id: trace id Effect берёт из заголовков
// traceparent/b3, которые выбирает клиент (ADR-0005).
const generateErrorId = Effect.sync(() => randomBytes(16).toString('hex'));

// Одна строка лога на технический отказ; возвращает поля для 5xx-ответа
// с тем же errorId, что и в логе.
export const logTechnicalFailure = ({
  error,
  kind,
  module,
  operation,
  reason,
  userId,
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
        userId,
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

// Первый вызов принимает тип ошибок явно, второй выводит Operation из
// operations: TypeScript не умеет задать один параметр типа и вывести другой.
export const makeTechnicalFailureHandler =
  <TechnicalError extends TaggedError>() =>
  <Operation extends string>(
    options: TechnicalFailureOptions<Operation, TechnicalError>,
  ): MakeTechnicalErrorHandler<Operation, TechnicalError> =>
  (context) =>
  (error) => {
    const tag: TechnicalError['_tag'] = error._tag;

    return failTechnically({
      ...context,
      error,
      kind: 'failure',
      module: options.module,
      reason: options.reasons[tag],
    });
  };
