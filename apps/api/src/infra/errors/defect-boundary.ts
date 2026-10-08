import { Cause, Config, Effect, Layer, Option } from 'effect';
import { HttpApiMiddleware } from 'effect/unstable/httpapi';

import { DefectDetailsConfig, ModeConfig } from '#infra/config/config.js';
import { asProblemJson } from '#infra/errors/http-problem.js';
import { logTechnicalFailure } from '#infra/errors/technical-failure.js';
import { InternalHttpError } from '#infra/errors/technical-http-errors.js';

export const defectDetailsEvent = 'operation.defect.details';

// Подключается к API последним, поэтому оборачивает хендлер и все остальные
// middleware эндпоинта.
export class DefectBoundaryMiddleware extends HttpApiMiddleware.Service<DefectBoundaryMiddleware>()(
  'app/DefectBoundaryMiddleware',
  {
    error: InternalHttpError.pipe(asProblemJson),
  },
) {}

// Текст и stack дефекта печатаются только для отладки: флаг включён и MODE явно
// не production. Без MODE флаг игнорируется.
const shouldLogDefectDetails = Effect.gen(function* () {
  const requested = yield* DefectDetailsConfig;
  const mode = yield* Config.option(ModeConfig);

  return requested && Option.exists(mode, (value) => value !== 'production');
});

// Ловит только дефекты. Типизированные ошибки хендлер уже залогировал и
// перевёл в HTTP-ошибки, а отмена запроса не должна становиться ответом 500.
export const DefectBoundaryMiddlewareLive = Layer.effect(
  DefectBoundaryMiddleware,
  Effect.gen(function* () {
    const logDefectDetails = yield* shouldLogDefectDetails;

    return (httpEffect, { endpoint, group }) =>
      httpEffect.pipe(
        Effect.catchDefect((defect) =>
          Effect.gen(function* () {
            const problem = yield* logTechnicalFailure({
              error: defect,
              kind: 'defect',
              module: group.identifier,
              operation: endpoint.identifier,
              reason: 'internal',
              userId: null,
            });

            if (logDefectDetails) {
              yield* Effect.logError('Defect details', Cause.die(defect)).pipe(
                Effect.annotateLogs({
                  event: defectDetailsEvent,
                  errorId: problem.errorId,
                }),
              );
            }

            return yield* new InternalHttpError(problem);
          }),
        ),
      );
  }),
);
