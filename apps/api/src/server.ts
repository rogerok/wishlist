import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { createServer } from 'node:http';

import { AppApiLive } from '#infra/api/api-live.js';
import { AppConfig } from '#infra/config/config.js';

export const HttpLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;

    const ApiRoutes = AppApiLive.pipe(
      Layer.provide(
        HttpRouter.cors({
          allowedOrigins: config.corsAllowedOrigins,
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          credentials: config.corsCredentials,
          maxAge: 600,
        }),
      ),
    );

    return HttpRouter.serve(ApiRoutes).pipe(
      HttpServer.withLogAddress,
      Layer.provide(
        NodeHttpServer.layer(createServer, { port: config.appPort }),
      ),
    );
  }),
);
