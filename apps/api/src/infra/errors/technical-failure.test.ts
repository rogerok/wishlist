import { NodeHttpServer } from '@effect/platform-node';
import { describe, expect, it } from '@effect/vitest';
import {
  ConfigProvider,
  Context,
  Data,
  Effect,
  Layer,
  Logger,
  Schema,
} from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
} from 'effect/unstable/httpapi';
import { ConnectionError, SqlError } from 'effect/unstable/sql/SqlError';
import { createServer, request as httpRequest } from 'node:http';

import {
  DefectBoundaryMiddleware,
  DefectBoundaryMiddlewareLive,
  defectDetailsEvent,
} from '#infra/errors/defect-boundary.js';
import {
  makeTechnicalFailureHandler,
  operationFailedEvent,
} from '#infra/errors/technical-failure.js';
import {
  InternalHttpError,
  ServiceUnavailableHttpError,
  technicalHttpErrors,
} from '#infra/errors/technical-http-errors.js';
import { captureConsole } from '#infra/logging/capture-console.js';

const sensitiveMarker = 'sensitive@example.test';
const probeId = 'probe-7';
const probePath = `/probe/${probeId}`;
const clientTraceId = '0af7651916cd43dd8448eb211c80319c';
const forgedTraceId = 'forged-by-client';

class ProbeInternalError extends Data.TaggedError('ProbeInternalError')<{
  readonly cause: unknown;
}> {}

class ProbeUnavailableError extends Data.TaggedError('ProbeUnavailableError')<{
  readonly cause: unknown;
}> {}

class ProbeDataIntegrityError extends Data.TaggedError(
  'ProbeDataIntegrityError',
)<{
  readonly cause: unknown;
}> {}

class ProbeRepositoryError extends Data.TaggedError('ProbeRepositoryError')<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

type ProbeError =
  | ProbeDataIntegrityError
  | ProbeInternalError
  | ProbeUnavailableError;

const ProbeOperation = { read: 'read' } as const;

const probeApi = HttpApi.make('probe')
  .add(
    HttpApiGroup.make('probe').add(
      HttpApiEndpoint.get(ProbeOperation.read, '/probe/:id', {
        params: { id: Schema.String },
        success: Schema.String,
        error: technicalHttpErrors,
      }),
    ),
  )
  .middleware(DefectBoundaryMiddleware);

const handleTechnicalFailure = makeTechnicalFailureHandler({
  module: 'probe',
  operations: ProbeOperation,
  reasons: {
    ProbeDataIntegrityError: 'dataIntegrity',
    ProbeInternalError: 'internal',
    ProbeUnavailableError: 'unavailable',
  },
});

const logs: Array<ReturnType<typeof Logger.formatStructured.log>> = [];
const logger = Logger.make(
  (options) => void logs.push(Logger.formatStructured.log(options)),
);

// Явный ConfigProvider: переменные окружения разработчика не влияют на тесты.
const makeProbeLive = (
  outcome: Effect.Effect<string, ProbeError>,
  env: Readonly<Record<string, string>> = {},
) => {
  const probeHandlersLive = HttpApiBuilder.group(
    probeApi,
    'probe',
    (handlers) =>
      handlers.handle(ProbeOperation.read, ({ params: { id } }) => {
        const handleTechnicalError = handleTechnicalFailure({
          operation: ProbeOperation.read,
          userId: id,
        });

        return outcome.pipe(
          Effect.catchTags({
            ProbeDataIntegrityError: handleTechnicalError,
            ProbeInternalError: handleTechnicalError,
            ProbeUnavailableError: handleTechnicalError,
          }),
        );
      }),
  );

  return HttpApiBuilder.layer(probeApi).pipe(
    Layer.provide([
      probeHandlersLive.pipe(
        Layer.provide(
          DefectBoundaryMiddlewareLive.pipe(
            Layer.provide(
              ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
            ),
          ),
        ),
      ),
      NodeHttpServer.layerHttpServices,
    ]),
    Layer.provide(Logger.layer([logger])),
  );
};

const makeApp = (
  outcome: Effect.Effect<string, ProbeError>,
  env: Readonly<Record<string, string>> = {},
) => HttpRouter.toWebHandler(makeProbeLive(outcome, env));

const request = (headers: Record<string, string> = {}) =>
  new Request(`http://localhost${probePath}`, { headers });

const failedLogs = () =>
  logs.filter((log) => log.annotations.event === operationFailedEvent);

const repositoryCause = new ProbeRepositoryError({
  operation: 'getById',
  cause: new SqlError({
    reason: new ConnectionError({
      cause: new Error(`connect failed for ${sensitiveMarker}`),
    }),
  }),
});

beforeEach(() => {
  logs.length = 0;
});

describe('makeTechnicalFailureHandler', () => {
  it.effect.each([
    {
      reason: 'internal',
      failure: new ProbeInternalError({ cause: repositoryCause }),
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      reason: 'dataIntegrity',
      failure: new ProbeDataIntegrityError({ cause: repositoryCause }),
      status: 500,
      schema: InternalHttpError,
      code: 'INTERNAL_ERROR',
    },
    {
      reason: 'unavailable',
      failure: new ProbeUnavailableError({ cause: repositoryCause }),
      status: 503,
      schema: ServiceUnavailableHttpError,
      code: 'SERVICE_UNAVAILABLE',
    },
  ] as const)(
    'maps $reason to $status and writes one failure log',
    ({ reason, failure, status, schema, code }) =>
      Effect.gen(function* () {
        const app = yield* Effect.acquireRelease(
          Effect.sync(() => makeApp(Effect.fail(failure))),
          (started) => Effect.promise(() => started.dispose()),
        );

        const resp = yield* Effect.promise(() => app.handler(request()));
        const json = yield* Effect.promise(() => resp.json());
        const body = yield* Schema.decodeUnknownEffect(schema)(json);

        expect(resp.status).toBe(status);
        expect(resp.headers.get('content-type')).toBe(
          'application/problem+json',
        );
        expect(body.code).toBe(code);
        expect(body.instance).toBe(probePath);
        expect(body.errorId).toMatch(/^[0-9a-f]{32}$/);

        expect(failedLogs()).toHaveLength(1);
        expect(failedLogs()[0]).toMatchObject({
          level: 'ERROR',
          message: 'Operation failed',
          annotations: {
            event: operationFailedEvent,
            kind: 'failure',
            module: 'probe',
            operation: ProbeOperation.read,
            userId: probeId,
            reason,
            errorId: body.errorId,
            errorChain: [
              { tag: failure._tag },
              { tag: 'ProbeRepositoryError', operation: 'getById' },
              { tag: 'SqlError' },
              { tag: 'ConnectionError' },
            ],
          },
        });
        expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
        expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      }),
  );

  it.effect.each([
    {
      header: 'traceparent',
      headers: { traceparent: `00-${clientTraceId}-b7ad6b7169203331-01` },
      clientValue: clientTraceId,
    },
    {
      header: 'x-b3-traceid',
      headers: { 'x-b3-traceid': forgedTraceId, 'x-b3-spanid': 'x' },
      clientValue: forgedTraceId,
    },
    {
      header: 'b3',
      headers: { b3: `${forgedTraceId}-x` },
      clientValue: forgedTraceId,
    },
  ])('ignores an incoming $header header', ({ headers, clientValue }) =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeApp(
            Effect.fail(new ProbeInternalError({ cause: sensitiveMarker })),
          ),
        ),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() => app.handler(request(headers)));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(InternalHttpError)(json);

      expect(body.errorId).toMatch(/^[0-9a-f]{32}$/);
      expect(failedLogs()[0]?.annotations).toMatchObject({
        errorId: body.errorId,
      });
      expect(JSON.stringify(json)).not.toContain(clientValue);
      expect(JSON.stringify(logs)).not.toContain(clientValue);
    }),
  );

  it.effect('generates a new errorId for every failure', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeApp(
            Effect.fail(new ProbeInternalError({ cause: sensitiveMarker })),
          ),
        ),
        (started) => Effect.promise(() => started.dispose()),
      );

      const first = yield* Effect.promise(() => app.handler(request()));
      const second = yield* Effect.promise(() => app.handler(request()));
      const firstBody = yield* Schema.decodeUnknownEffect(InternalHttpError)(
        yield* Effect.promise(() => first.json()),
      );
      const secondBody = yield* Schema.decodeUnknownEffect(InternalHttpError)(
        yield* Effect.promise(() => second.json()),
      );

      expect(firstBody.errorId).not.toBe(secondBody.errorId);
      expect(failedLogs().map((log) => log.annotations.errorId)).toEqual([
        firstBody.errorId,
        secondBody.errorId,
      ]);
    }),
  );
});

describe('DefectBoundaryMiddleware', () => {
  it.effect('answers a defect with a safe 500 and one failure log', () =>
    Effect.gen(function* () {
      const consoleOutput = yield* captureConsole;
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.die(new Error(sensitiveMarker)))),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() => app.handler(request()));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(InternalHttpError)(json);

      expect(resp.status).toBe(500);
      expect(resp.headers.get('content-type')).toBe('application/problem+json');
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.instance).toBe(probePath);
      expect(body.errorId).toMatch(/^[0-9a-f]{32}$/);
      expect(failedLogs()).toHaveLength(1);
      expect(failedLogs()[0]).toMatchObject({
        level: 'ERROR',
        annotations: {
          kind: 'defect',
          module: 'probe',
          operation: ProbeOperation.read,
          userId: null,
          reason: 'internal',
          errorChain: [],
          errorId: body.errorId,
        },
      });
      expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
      expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      expect(consoleOutput.join('\n')).not.toContain(sensitiveMarker);
    }),
  );

  it.effect('keeps the chain of a tagged error turned into a defect', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.die(repositoryCause))),
        (started) => Effect.promise(() => started.dispose()),
      );

      yield* Effect.promise(() => app.handler(request()));

      expect(failedLogs()[0]?.annotations.errorChain).toEqual([
        { tag: 'ProbeRepositoryError', operation: 'getById' },
        { tag: 'SqlError' },
        { tag: 'ConnectionError' },
      ]);
    }),
  );

  it.effect('does not log typed failures a second time', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeApp(Effect.fail(new ProbeUnavailableError({ cause: null }))),
        ),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() => app.handler(request()));

      expect(resp.status).toBe(503);
      expect(failedLogs()).toHaveLength(1);
      expect(failedLogs()[0]?.annotations).toMatchObject({ kind: 'failure' });
    }),
  );

  it.effect('does not turn an interruption into a 500', () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.interrupt)),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() => app.handler(request()));

      expect(resp.status).not.toBe(500);
      expect(failedLogs()).toHaveLength(0);
    }),
  );
});

const defectDetailsLogs = () =>
  logs.filter((log) => log.annotations.event === defectDetailsEvent);

describe('defect details', () => {
  it.effect.each([
    {
      name: 'flag unset in development',
      env: { MODE: 'development' },
      printed: false,
    },
    {
      name: 'flag set in development',
      env: { MODE: 'development', LOG_DEFECT_DETAILS: 'true' },
      printed: true,
    },
    {
      name: 'flag set in test',
      env: { MODE: 'test', LOG_DEFECT_DETAILS: 'true' },
      printed: true,
    },
    {
      name: 'flag set in production',
      env: { MODE: 'production', LOG_DEFECT_DETAILS: 'true' },
      printed: false,
    },
    {
      name: 'flag set without MODE',
      env: { LOG_DEFECT_DETAILS: 'true' },
      printed: false,
    },
  ])('$name → printed: $printed', ({ env, printed }) =>
    Effect.gen(function* () {
      const consoleOutput = yield* captureConsole;
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeApp(Effect.die(new Error(sensitiveMarker)), env)),
        (started) => Effect.promise(() => started.dispose()),
      );

      const resp = yield* Effect.promise(() => app.handler(request()));
      const json = yield* Effect.promise(() => resp.json());
      const body = yield* Schema.decodeUnknownEffect(InternalHttpError)(json);

      expect(resp.status).toBe(500);
      expect(JSON.stringify(json)).not.toContain(sensitiveMarker);
      expect(failedLogs()).toHaveLength(1);
      expect(JSON.stringify(failedLogs())).not.toContain(sensitiveMarker);
      expect(defectDetailsLogs()).toHaveLength(printed ? 1 : 0);

      if (printed) {
        expect(defectDetailsLogs()[0]).toMatchObject({
          level: 'ERROR',
          annotations: { errorId: body.errorId },
        });
        expect(JSON.stringify(defectDetailsLogs())).toContain(sensitiveMarker);
      } else {
        expect(JSON.stringify(logs)).not.toContain(sensitiveMarker);
        expect(consoleOutput.join('\n')).not.toContain(sensitiveMarker);
      }
    }),
  );
});

const getRaw = (port: number, path: string) =>
  Effect.callback<{ readonly body: string; readonly status: number }>(
    (resume) => {
      const req = httpRequest(
        { host: '127.0.0.1', port, path, method: 'GET' },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            body += chunk;
          });
          res.on('end', () => {
            resume(Effect.succeed({ status: res.statusCode ?? 0, body }));
          });
        },
      );
      req.on('error', (error) => resume(Effect.die(error)));
      req.end();
    },
  );

describe('instance on a Node HTTP server', () => {
  it.effect.each([
    { path: probePath, instance: probePath },
    { path: `/${probePath}`, instance: `/${probePath}` },
    { path: `//${probePath}?x=1`, instance: `//${probePath}` },
  ])('$path → $instance', ({ path, instance }) =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        HttpRouter.serve(
          makeProbeLive(
            Effect.fail(new ProbeInternalError({ cause: sensitiveMarker })),
          ),
        ).pipe(
          Layer.provideMerge(NodeHttpServer.layer(createServer, { port: 0 })),
        ),
      );
      const { address } = Context.get(context, HttpServer.HttpServer);

      if (address._tag !== 'TcpAddress') {
        return yield* Effect.die(new Error('Expected a TCP address'));
      }

      const resp = yield* getRaw(address.port, path);
      const body = yield* Schema.decodeEffect(
        Schema.fromJsonString(InternalHttpError),
      )(resp.body);

      expect(resp.status).toBe(500);
      expect(body.instance).toBe(instance);
    }),
  );
});
