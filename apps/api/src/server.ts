import { HttpApiBuilder, HttpMiddleware, HttpServer } from '@effect/platform';
import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { createServer } from 'node:http';

import { WishlistApiLive } from '#api.js';
import { AppConfig } from '#config/config.js';

export const HttpLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* AppConfig;

    return HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
      Layer.provide(
        HttpApiBuilder.middlewareCors({
          allowedOrigins: config.corsAllowedOrigins,
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          credentials: config.corsCredentials,
          maxAge: 600,
        }),
      ),
      Layer.provide(WishlistApiLive),
      HttpServer.withLogAddress,
      Layer.provide(
        NodeHttpServer.layer(createServer, { port: config.appPort }),
      ),
    );
  }),
);
